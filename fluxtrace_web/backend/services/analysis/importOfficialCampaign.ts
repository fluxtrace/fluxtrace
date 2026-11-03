import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  createAnalysisBatch,
  getAnalysisBatchByBatchId,
  updateAnalysisBatch,
  upsertAnalysisInsight,
} from "../../models/db";
import {
  buildMitreDefenseEvasionFromEvidence,
  OFFICIAL_CAMPAIGN_ARCHIVE,
  type FlowGraph,
  type ReductionFileMetric,
  type ReductionMetrics,
  type SupportedLogType,
} from "../../shared/analysis";
import { compactTraceOriginFromIndexDocument } from "./traceIndexArtifact";
import { buildPivotFlows, catalogSourceApis, hitsFromObservedRows, syncMappedCatalogFromApis } from "./mappedCatalogSync";

export const OFFICIAL_ARTIFACT_ROOT = process.env.COTB_ARTIFACT_ROOT?.trim() || "G:\\cotb-pin-100\\fluxtrace-artifacts";

const SHA256_DIR = /^[a-f0-9]{64}$/i;

function officialBatchId(hash: string) {
  return `ctr-cotb-${hash.slice(0, 16)}`;
}

function inferLogType(fileName: string): SupportedLogType {
  const lowered = fileName.toLowerCase();
  if (lowered.includes("functioninterceptor")) return "FunctionInterceptor";
  if (lowered.includes("tracefcncall")) return "TraceFcnCall";
  if (lowered.includes("tracememory")) return "TraceMemory";
  if (lowered.includes("traceinstructions")) return "TraceInstructions";
  if (lowered.includes("tracedisassembly")) return "TraceDisassembly";
  return "Unknown";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

/** Lê o índice sem materializar `hits` (os maiores ficheiros oficiais ~30 MB). */
async function readCompactOrigin(indexPath: string) {
  const raw = asRecord(await readJson(indexPath));
  return compactTraceOriginFromIndexDocument({
    engine: typeof raw.engine === "string" ? raw.engine : undefined,
    indexSha256: typeof raw.indexSha256 === "string" ? raw.indexSha256 : undefined,
    originCounts: raw.originCounts as { "pin-runtime"?: number; target?: number; unknown?: number } | undefined,
    observedApis: Array.isArray(raw.observedApis) ? raw.observedApis : undefined,
    observedTargetApis: Array.isArray(raw.observedTargetApis) ? raw.observedTargetApis : undefined,
  });
}

function metricsFromOfficial(fileMetricsDoc: Record<string, unknown>, fileCount: number): ReductionMetrics {
  const orig = Number(fileMetricsDoc.origLines ?? 0) || 0;
  const red = Number(fileMetricsDoc.redLines ?? 0) || 0;
  const rho = Number(fileMetricsDoc.rho ?? 0) || 0;
  return {
    originalLineCount: orig,
    reducedLineCount: red,
    originalBytes: 0,
    reducedBytes: 0,
    reductionPercent: rho > 0 ? rho * 100 : orig > 0 ? ((orig - red) / orig) * 100 : 0,
    suspiciousEventCount: Number(fileMetricsDoc.suspicious ?? 0) || 0,
    triggerCount: Number(fileMetricsDoc.trigger ?? 0) || 0,
    uploadedFileCount: fileCount,
  };
}

function fileRowsFromOfficial(fileMetricsDoc: Record<string, unknown>): ReductionFileMetric[] {
  const files = Array.isArray(fileMetricsDoc.files) ? fileMetricsDoc.files : [];
  return files.map((row) => {
    const rec = asRecord(row);
    const fileName = typeof rec.fileName === "string" ? rec.fileName : "unknown.cdf";
    const lines = Number(rec.lines ?? 0) || 0;
    const rho = Number(rec.rho ?? 0) || 0;
    return {
      fileName,
      logType: inferLogType(fileName),
      status: "completed" as const,
      progress: 100,
      currentStage: "Concluído",
      currentStep: "Importado da campanha oficial",
      lastMessage: "Artefacto A5 (disco) importado para a UI.",
      originalLineCount: lines,
      reducedLineCount: Math.max(0, Math.round(lines * (1 - rho))),
      originalBytes: Number(rec.sizeBytes ?? 0) || 0,
      reducedBytes: 0,
      suspiciousEventCount: 0,
      triggerCount: 0,
      uploadDurationMs: 0,
      processingDurationMs: 0,
      uploadReused: true,
    };
  });
}

function techniquesFromReport(markdown: string): string[] {
  const block = markdown.split("## Técnicas (só *target*)")[1] ?? markdown.split("## Técnicas")[1] ?? "";
  const section = block.split("## ")[0] ?? "";
  return section
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter((line) => line && !line.startsWith("(") && !line.startsWith("`"));
}

export async function importOfficialCampaign(options?: {
  artifactRoot?: string;
  createdByUserId?: number;
  force?: boolean;
}): Promise<{ imported: number; updated: number; skipped: number; failed: string[] }> {
  const root = options?.artifactRoot ?? OFFICIAL_ARTIFACT_ROOT;
  const names = await readdir(root);
  const hashes = names.filter((name) => SHA256_DIR.test(name));
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const hash of hashes) {
    const batchId = officialBatchId(hash);
    try {
      const existing = await getAnalysisBatchByBatchId(batchId);
      if (existing && !options?.force) {
        skipped += 1;
        continue;
      }

      const dest = join(root, hash);
      const [indexOrigin, fileMetricsDoc, reportMd, observedGraphRaw] = await Promise.all([
        readCompactOrigin(join(dest, "trace-index.json")),
        readJson(join(dest, "file-metrics.json")).then(asRecord),
        readFile(join(dest, "report.md"), "utf8").catch(() => ""),
        readJson(join(dest, "observed-api-graph.json")).then(asRecord).catch(() => ({}) as Record<string, unknown>),
      ]);

      const label = typeof fileMetricsDoc.label === "string" ? fileMetricsDoc.label : "sample";
      const techniques = techniquesFromReport(reportMd);
      const targetApis = indexOrigin.observedTargetApis.map((row) => row.api);
      const mitreDefenseEvasion = buildMitreDefenseEvasionFromEvidence({
        heuristicTags: techniques,
        suspiciousApis: targetApis,
      });
      const fileMetrics = fileRowsFromOfficial(fileMetricsDoc);
      const metrics = metricsFromOfficial(fileMetricsDoc, fileMetrics.length);
      const observedNodes = (observedGraphRaw as { nodes?: unknown }).nodes;
      const fallbackGraph: FlowGraph = Array.isArray(observedNodes)
        ? (observedGraphRaw as FlowGraph)
        : { nodes: [], edges: [] };
      const observedGraph = indexOrigin.observedGraph.nodes.length ? indexOrigin.observedGraph : fallbackGraph;
      const syntheticHits = hitsFromObservedRows(indexOrigin.observedApis);
      try {
        await syncMappedCatalogFromApis(catalogSourceApis(syntheticHits), { hits: syntheticHits });
      } catch (error) {
        console.warn("[importOfficialCampaign] catálogo automático:", error);
      }
      const pivotFlows = buildPivotFlows(syntheticHits);
      const summaryJson = {
        classification: "Unknown",
        riskLevel: metrics.triggerCount > 0 ? "high" : metrics.suspiciousEventCount > 0 ? "medium" : "low",
        currentPhase: "Inicialização",
        techniques,
        mitreDefenseEvasion,
        suspiciousApis: targetApis,
        recommendations: [
          "Rótulos da campanha oficial: heurística, não ground truth.",
          "Consultar o painel Origem do rastro para Pin vs amostra vs sem evidência.",
        ],
        metrics,
        fileMetrics,
        flowGraph: observedGraph,
        campaign: OFFICIAL_CAMPAIGN_ARCHIVE,
        sampleLabel: label,
        traceOrigin: indexOrigin,
        pivotFlows,
      };

      const sampleName = `cotb-${label}-${hash.slice(0, 12)}`;
      if (!existing) {
        await createAnalysisBatch({
          batchId,
          pipelineBatchRef: null,
          sampleName,
          sampleSha256: hash.toLowerCase(),
          sourceArchiveName: OFFICIAL_CAMPAIGN_ARCHIVE,
          sourceArchiveUrl: null,
          sourceArchiveStorageKey: dest,
          focusFunction: "Campanha oficial CotB (A5)",
          focusTermsJson: [],
          focusRegexesJson: [],
          status: "completed",
          progress: 100,
          stage: "concluído",
          message: `Importado do artefacto oficial (${label}). Motor ${indexOrigin.engine}.`,
          stdoutTail: null,
          stderrTail: null,
          pipelineBaseUrl: null,
          pipelineExternalPath: dest,
          resultPath: `/interpretacao-consolidada?batch=${batchId}`,
          errorMessage: null,
          llmSummaryStatus: "completed",
          commitStatus: "skipped",
          createdByUserId: options?.createdByUserId ?? null,
          completedAt: new Date(),
        });
        imported += 1;
      } else {
        await updateAnalysisBatch(batchId, {
          sampleName,
          sampleSha256: hash.toLowerCase(),
          status: "completed",
          progress: 100,
          stage: "concluído",
          message: `Reimportado do artefacto oficial (${label}). Motor ${indexOrigin.engine}.`,
          completedAt: new Date(),
        });
        updated += 1;
      }

      await upsertAnalysisInsight(batchId, {
        batchId,
        modelName: "deterministic-official-a5",
        riskLevel: String(summaryJson.riskLevel),
        title: `Campanha oficial · ${hash.slice(0, 12)}`,
        summaryMarkdown: reportMd || `# ${sampleName}\n\nSem report.md no artefacto.`,
        summaryJson,
      });
    } catch (error) {
      failed.push(`${hash.slice(0, 12)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { imported, updated, skipped, failed };
}
