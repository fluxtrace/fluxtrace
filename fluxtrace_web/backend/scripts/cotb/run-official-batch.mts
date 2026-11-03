/**
 * A5 — lote oficial CotB (motor trace-discovery-2, CONTRADEF_SKIP_LLM=1).
 *
 * Lê os .cdf já extraídos em G:\cotb-pin-100\fluxtrace-upload (A2).
 * Não volta a descompactar logs.7z. Não mistura o Eixo A histórico.
 *
 *   cd fluxtrace_web
 *   npx tsx backend/scripts/cotb/run-official-batch.mts
 *   npx tsx backend/scripts/cotb/run-official-batch.mts --limit 2
 *   npx tsx backend/scripts/cotb/run-official-batch.mts --force
 */
import "dotenv/config";

import { mkdir, readdir, readFile, stat, writeFile, appendFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeCdfPathOffline } from "../../services/analysis/analysisService";
import {
  buildTraceIndexDocument,
  firstSeenApis,
  sha256OfPath,
  TRACE_ENGINE_VERSION,
  type TraceIndexHit,
} from "../../services/analysis/traceIndexArtifact";

const WEB_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const UPLOAD_ROOT = process.env.COTB_UPLOAD_ROOT?.trim() || "G:\\cotb-pin-100\\fluxtrace-upload";
const ARTIFACT_ROOT = process.env.COTB_ARTIFACT_ROOT?.trim() || "G:\\cotb-pin-100\\fluxtrace-artifacts";
const MANIFEST = join(UPLOAD_ROOT, "manifest-cdf.csv");
const METRICS_CSV = join("G:\\cotb-pin-100", "fluxtrace-metrics-oficial.csv");
const SUMMARY_JSON = join("G:\\cotb-pin-100", "fluxtrace-summary-oficial.json");
const PAPER_MD = join("G:\\cotb-pin-100", "fluxtrace-paper-snippet-oficial.md");
const EVENT_CAP = 320;

type ManifestRow = {
  hash: string;
  label: string;
  n_cdf: string;
  interceptor_bytes: string;
  m1_bytes: string;
  m2_bytes: string;
  memory_bytes: string;
  dasm_bytes: string;
  instr_bytes: string;
  complete: string;
  dest: string;
};

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const limitIdx = argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number.parseInt(argv[limitIdx + 1] ?? "0", 10) : 0;
  const onlyIdx = argv.indexOf("--only");
  const only = onlyIdx >= 0 ? (argv[onlyIdx + 1] ?? "").trim().toLowerCase() : "";
  return { force, limit: Number.isFinite(limit) && limit > 0 ? limit : 0, only };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): ManifestRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row as ManifestRow;
  });
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const METRIC_FIELDS = [
  "hash",
  "label",
  "engine",
  "n_cdf",
  "complete6",
  "orig_lines",
  "red_lines",
  "rho",
  "suspicious_events",
  "trigger_count",
  "alarm_susp",
  "alarm_trigger",
  "n_apis_all",
  "n_apis_target",
  "n_apis_pin",
  "n_apis_unknown",
  "hit_count",
  "hits_truncated",
  "origin_target_hits",
  "origin_pin_hits",
  "origin_unknown_hits",
  "techniques",
  "apis_target",
  "index_sha256",
] as const;

function metricLine(row: Record<string, string | number>): string {
  return METRIC_FIELDS.map((k) => csvEscape(row[k] ?? "")).join(",") + "\n";
}

function classifyCdf(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("functioninterceptor")) return "interceptor";
  if (n.includes("tracefcncall.m1")) return "m1";
  if (n.includes("tracefcncall.m2")) return "m2";
  if (n.includes("tracememory")) return "memory";
  if (n.includes("tracedisassembly")) return "dasm";
  if (n.includes("traceinstructions")) return "instr";
  return "other";
}

async function listCdfs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".cdf"))
    .map((e) => join(dir, e.name))
    .sort((a, b) => {
      const ka = classifyCdf(basename(a));
      const kb = classifyCdf(basename(b));
      const order = ["interceptor", "m1", "m2", "memory", "dasm", "instr", "other"];
      return order.indexOf(ka) - order.indexOf(kb) || a.localeCompare(b);
    });
}

function buildReport(params: {
  hash: string;
  label: string;
  engine: string;
  complete6: number;
  files: Array<{ fileName: string; sizeBytes: string; sha256: string; lines: number; rho: number; truncated: boolean }>;
  origLines: number;
  redLines: number;
  rho: number;
  suspicious: number;
  trigger: number;
  techniques: string[];
  apisTarget: string[];
  apisAll: string[];
  originCounts: { "pin-runtime": number; target: number; unknown: number };
  indexSha256: string;
  hitsTruncated: boolean;
}): string {
  const lines = [
    `# FluxTrace — ${params.hash.slice(0, 12)} (${params.label})`,
    "",
    `- Motor: \`${params.engine}\``,
    `- SKIP_LLM: 1 (relatório determinístico)`,
    `- Completa 6 módulos > 0: **${params.complete6 ? "sim" : "não"}**`,
    `- Linhas: ${params.origLines.toLocaleString("pt-PT")} → ${params.redLines.toLocaleString("pt-PT")} (ρ=${params.rho.toFixed(4)})`,
    `- Eventos suspeitos (origem *target*): ${params.suspicious}`,
    `- Gatilho RW→RX / WriteProcessMemory / CreateRemoteThread (etiqueta): ${params.trigger}`,
    `- APIs no rastro (todas as origens): ${params.apisAll.length}`,
    `- APIs *target* (comportamento da amostra): ${params.apisTarget.length}`,
    `- Origem dos hits: target=${params.originCounts.target} pin-runtime=${params.originCounts["pin-runtime"]} unknown=${params.originCounts.unknown}`,
    `- Índice SHA-256: \`${params.indexSha256}\``,
    `- Hits truncados no JSON (TI enorme; únicas + contagem preservadas): ${params.hitsTruncated ? "sim" : "não"}`,
    "",
    "## Ficheiros",
    "",
  ];
  for (const f of params.files) {
    lines.push(
      `- \`${f.fileName}\` ${f.sizeBytes} B  linhas=${f.lines}  ρ=${f.rho.toFixed(4)}  sha256=${f.sha256}${f.truncated ? "  (hits colapsados)" : ""}`,
    );
  }
  lines.push("", "## Técnicas (só *target*)", "");
  if (params.techniques.length) {
    for (const t of params.techniques) lines.push(`- ${t}`);
  } else {
    lines.push("- (nenhuma etiqueta no rastro *target*)");
  }
  lines.push("", "## APIs *target* (ordem de primeira ocorrência)", "");
  if (params.apisTarget.length) {
    for (const api of params.apisTarget) lines.push(`- \`${api}\``);
  } else {
    lines.push("- (o Pin não gravou API com origem amostra neste conjunto de `.cdf`)");
  }
  lines.push("");
  return lines.join("\n");
}

async function processSample(row: ManifestRow, destDir: string): Promise<Record<string, string | number>> {
  await mkdir(destDir, { recursive: true });
  const cdfs = await listCdfs(row.dest);
  const hits: TraceIndexHit[] = [];
  const sourceFiles: Array<{ fileName: string; sha256: string; sizeBytes: number }> = [];
  const fileSummaries: Array<{
    fileName: string;
    sizeBytes: string;
    sha256: string;
    lines: number;
    rho: number;
    truncated: boolean;
  }> = [];
  const techniques = new Set<string>();
  let origLines = 0;
  let redLines = 0;
  let suspicious = 0;
  let trigger = 0;
  let hitCount = 0;
  let hitsTruncated = false;

  for (const cdfPath of cdfs) {
    const fileName = basename(cdfPath);
    const sizeBytes = (await stat(cdfPath)).size;
    const t0 = Date.now();
    process.stdout.write(`    ${fileName} ${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB ... `);
    const parsed = await analyzeCdfPathOffline(cdfPath, {
      fileName,
      onProgress: (n, bytes, total) => {
        const pct = total > 0 ? ((bytes / total) * 100).toFixed(0) : "?";
        process.stdout.write(`\n      ${n.toLocaleString("pt-PT")} lin  ${pct}%`);
      },
    });
    const sha = await sha256OfPath(cdfPath);
    const rho = parsed.originalLineCount ? 1 - parsed.reducedLineCount / parsed.originalLineCount : 0;
    sourceFiles.push({ fileName, sha256: sha, sizeBytes });
    fileSummaries.push({
      fileName,
      sizeBytes: String(sizeBytes),
      sha256: sha,
      lines: parsed.originalLineCount,
      rho,
      truncated: parsed.observedHitsTruncated,
    });
    origLines += parsed.originalLineCount;
    redLines += parsed.reducedLineCount;
    suspicious += parsed.suspiciousEventCount;
    trigger += parsed.triggerCount;
    hitCount += parsed.observedHitCount;
    hitsTruncated = hitsTruncated || parsed.observedHitsTruncated;
    parsed.techniqueTags.forEach((t) => techniques.add(t));
    if (parsed.observedHitsTruncated) {
      for (const stat of parsed.observedApiStats) {
        hits.push({
          fileName,
          logType: parsed.logType,
          lineNumber: stat.lineNumber,
          apis: [stat.api],
          mapped: stat.mapped,
          origin: stat.origin,
          originEvidence: stat.originEvidence,
          occurrences: stat.occurrences,
        });
      }
    } else {
      for (const hit of parsed.observedHits) {
        hits.push({
          fileName,
          logType: parsed.logType,
          lineNumber: hit.lineNumber,
          apis: hit.apis,
          mapped: hit.mapped,
          origin: hit.origin,
          originEvidence: hit.originEvidence,
        });
      }
    }
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    process.stdout.write(` ok ${parsed.originalLineCount} lin ${dt}s\n`);
  }

  const indexDoc = buildTraceIndexDocument({
    sourceFiles,
    hits,
    eventCapInGraph: EVENT_CAP,
  });
  const observedTarget = firstSeenApis(hits, { origin: "target" });
  const observedAll = firstSeenApis(hits);
  const observedPin = firstSeenApis(hits, { origin: "pin-runtime" });
  const observedUnknown = firstSeenApis(hits, { origin: "unknown" });
  const observedApiGraph = {
    engine: TRACE_ENGINE_VERSION,
    indexSha256: indexDoc.indexSha256,
    nodes: observedTarget.map((item, index) => ({
      id: `api:${index}:${item.api}`,
      label: item.api,
      kind: "api",
      metadata: {
        sourceFile: item.fileName,
        sourceLogType: item.logType,
        sourceLineNumber: item.lineNumber,
        occurrences: item.occurrences,
        origin: item.origin,
      },
    })),
    edges: observedTarget.slice(1).map((item, index) => ({
      source: `api:${index}:${observedTarget[index]!.api}`,
      target: `api:${index + 1}:${item.api}`,
      relation: "seguida no rastro",
    })),
  };

  const rho = origLines ? 1 - redLines / origLines : 0;
  const report = buildReport({
    hash: row.hash,
    label: row.label,
    engine: TRACE_ENGINE_VERSION,
    complete6: Number(row.complete) === 1 ? 1 : 0,
    files: fileSummaries,
    origLines,
    redLines,
    rho,
    suspicious,
    trigger,
    techniques: [...techniques].sort(),
    apisTarget: observedTarget.map((a) => a.api),
    apisAll: observedAll.map((a) => a.api),
    originCounts: indexDoc.originCounts,
    indexSha256: indexDoc.indexSha256,
    hitsTruncated,
  });

  const indexJson = hitsTruncated ? JSON.stringify(indexDoc) : JSON.stringify(indexDoc, null, 2);
  await writeFile(join(destDir, "trace-index.json"), indexJson, "utf8");
  await writeFile(join(destDir, "observed-api-graph.json"), JSON.stringify(observedApiGraph, null, 2), "utf8");
  await writeFile(join(destDir, "report.md"), report, "utf8");
  await writeFile(
    join(destDir, "file-metrics.json"),
    JSON.stringify(
      {
        hash: row.hash,
        label: row.label,
        engine: TRACE_ENGINE_VERSION,
        skipLlm: true,
        files: fileSummaries,
        origLines,
        redLines,
        rho,
        suspicious,
        trigger,
        hitCount,
        hitsTruncated,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    hash: row.hash,
    label: row.label,
    engine: TRACE_ENGINE_VERSION,
    n_cdf: cdfs.length,
    complete6: Number(row.complete) === 1 ? 1 : 0,
    orig_lines: origLines,
    red_lines: redLines,
    rho: Number(rho.toFixed(6)),
    suspicious_events: suspicious,
    trigger_count: trigger,
    alarm_susp: suspicious > 0 ? 1 : 0,
    alarm_trigger: trigger > 0 ? 1 : 0,
    n_apis_all: observedAll.length,
    n_apis_target: observedTarget.length,
    n_apis_pin: observedPin.length,
    n_apis_unknown: observedUnknown.length,
    hit_count: hitCount,
    hits_truncated: hitsTruncated ? 1 : 0,
    origin_target_hits: indexDoc.originCounts.target,
    origin_pin_hits: indexDoc.originCounts["pin-runtime"],
    origin_unknown_hits: indexDoc.originCounts.unknown,
    techniques: [...techniques].sort().join("|"),
    apis_target: observedTarget.map((a) => a.api).join("|"),
    index_sha256: indexDoc.indexSha256,
  };
}

function writePaper(rows: Array<Record<string, string | number>>) {
  const num = (k: string) => rows.map((r) => Number(r[k] ?? 0));
  const subset = (pred: (r: Record<string, string | number>) => boolean) => rows.filter(pred);
  const infected = subset((r) => r.label === "infected");
  const benign = subset((r) => r.label === "benign");
  const complete = subset((r) => Number(r.complete6) === 1);
  const withTarget = subset((r) => Number(r.n_apis_target) > 0);
  const infTarget = subset((r) => r.label === "infected" && Number(r.n_apis_target) > 0);
  const benTarget = subset((r) => r.label === "benign" && Number(r.n_apis_target) > 0);
  const pooledOrig = num("orig_lines").reduce((a, b) => a + b, 0);
  const pooledRed = num("red_lines").reduce((a, b) => a + b, 0);
  const rho = pooledOrig ? 1 - pooledRed / pooledOrig : 0;
  const apiFreq = new Map<string, number>();
  for (const r of rows) {
    const apis = String(r.apis_target ?? "").split("|").filter(Boolean);
    for (const api of new Set(apis)) apiFreq.set(api, (apiFreq.get(api) ?? 0) + 1);
  }
  const top = [...apiFreq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const fmtGroup = (g: Array<Record<string, string | number>>, name: string) => {
    const o = g.reduce((a, r) => a + Number(r.orig_lines), 0);
    const d = g.reduce((a, r) => a + Number(r.red_lines), 0);
    const sus = g.reduce((a, r) => a + Number(r.alarm_susp), 0);
    const trg = g.reduce((a, r) => a + Number(r.alarm_trigger), 0);
    const rrho = o ? 1 - d / o : 0;
    return `- ${name}: n=${g.length}  L=${o.toLocaleString("pt-PT")}→${d.toLocaleString("pt-PT")}  ρ=${rrho.toFixed(4)}  alarme_susp=${sus}/${g.length}  alarme_gatilho=${trg}/${g.length}`;
  };

  const md = [
    "# FluxTrace — lote oficial CotB (A5, motor `trace-discovery-2`)",
    "",
    `- Gerado por \`backend/scripts/cotb/run-official-batch.mts\` (cwd \`${WEB_ROOT}\`).`,
    `- Fontes: **todos** os \`.cdf\` da pasta A2 (Interceptor, M1, M2, Memory, Disassembly, Instructions). Nenhum módulo ignorado.`,
    `- \`CONTRADEF_SKIP_LLM=1\`. Eixo A histórico dos 14 lotes **não** entra nesta tabela.`,
    `- n manifesto A2: **${rows.length}** (infectadas ${infected.length}, benignas ${benign.length}). Falta a benigna \`be6e32a5\` se n<100.`,
    `- Completas (6 módulos size>0): **${complete.length}/${rows.length}**.`,
    `- Com API origem *target*: **${withTarget.length}/${rows.length}**.`,
    "",
    "## Volume (ρ) — todos os `.cdf`",
    fmtGroup(rows, "Todas"),
    fmtGroup(infected, "Infectadas"),
    fmtGroup(benign, "Benignas"),
    fmtGroup(complete, "Completas 6 módulos"),
    fmtGroup(infTarget, "Infectadas com API *target*"),
    fmtGroup(benTarget, "Benignas com API *target*"),
    "",
    "## Eixo B (etiquetas, não ground truth)",
    `- Alarme suspeito em infectadas com API *target*: ${infTarget.filter((r) => Number(r.alarm_susp) === 1).length}/${infTarget.length}`,
    `- Alarme gatilho em infectadas com API *target*: ${infTarget.filter((r) => Number(r.alarm_trigger) === 1).length}/${infTarget.length}`,
    `- Alarme suspeito em benignas com API *target*: ${benTarget.filter((r) => Number(r.alarm_susp) === 1).length}/${benTarget.length}`,
    `- Alarme gatilho em benignas com API *target*: ${benTarget.filter((r) => Number(r.alarm_trigger) === 1).length}/${benTarget.length}`,
    "",
    `ρ pooled (n=${rows.length}): **${rho.toFixed(4)}**`,
    "",
    "## APIs *target* (nº de amostras, não linhas)",
    "",
  ];
  for (const [api, n] of top) md.push(`- \`${api}\`: ${n}`);
  md.push("");
  return md.join("\n");
}

async function main() {
  process.env.CONTRADEF_SKIP_LLM = process.env.CONTRADEF_SKIP_LLM?.trim() || "1";
  const args = parseArgs(process.argv.slice(2));
  const text = await readFile(MANIFEST, "utf8");
  let rows = parseCsv(text);
  if (args.only) {
    rows = rows.filter((r) => r.hash.toLowerCase().startsWith(args.only) || r.hash.toLowerCase() === args.only);
  }
  rows.sort((a, b) => Number(a.instr_bytes || 0) - Number(b.instr_bytes || 0));
  if (args.limit) rows = rows.slice(0, args.limit);

  await mkdir(ARTIFACT_ROOT, { recursive: true });
  const existingCsv = await readFile(METRICS_CSV, "utf8").catch(() => "");
  const done = new Set<string>();
  if (existingCsv && !args.force) {
    for (const line of existingCsv.split(/\r?\n/).slice(1)) {
      const hash = splitCsvLine(line)[0]?.replace(/"/g, "").toLowerCase();
      if (hash && hash.length === 64) done.add(hash);
    }
  }

  if (!existingCsv || args.force) {
    await writeFile(METRICS_CSV, METRIC_FIELDS.join(",") + "\n", "utf8");
    done.clear();
  }

  console.log(
    `A5 oficial  engine=${TRACE_ENGINE_VERSION}  SKIP_LLM=${process.env.CONTRADEF_SKIP_LLM}  n=${rows.length}  já=${done.size}  force=${args.force}`,
  );
  console.log(`upload=${UPLOAD_ROOT}`);
  console.log(`artifacts=${ARTIFACT_ROOT}`);

  const metricsRows: Array<Record<string, string | number>> = [];
  if (existingCsv && !args.force) {
    const parsed = parseCsv(existingCsv);
    for (const r of parsed) metricsRows.push(r as unknown as Record<string, string | number>);
  }

  let i = 0;
  for (const row of rows) {
    i += 1;
    const hash = row.hash.toLowerCase();
    const destDir = join(ARTIFACT_ROOT, hash);
    const indexPath = join(destDir, "trace-index.json");
    let skip = false;
    if (!args.force && done.has(hash)) {
      try {
        await stat(indexPath);
        skip = true;
      } catch {
        skip = false;
      }
    }
    console.log(`[${i}/${rows.length}] ${row.label} ${hash.slice(0, 12)} instr=${row.instr_bytes}${skip ? " reuse" : ""}`);
    if (skip) continue;
    try {
      const metric = await processSample(row, destDir);
      metricsRows.push(metric);
      await appendFile(METRICS_CSV, metricLine(metric), "utf8");
      done.add(hash);
    } catch (err) {
      console.error(`  FALHA ${hash.slice(0, 12)}:`, err);
    }
  }

  const unique = new Map<string, Record<string, string | number>>();
  for (const r of metricsRows) unique.set(String(r.hash).toLowerCase(), r);
  const all = [...unique.values()];
  const summary = {
    engine: TRACE_ENGINE_VERSION,
    skipLlm: true,
    n: all.length,
    n_infected: all.filter((r) => r.label === "infected").length,
    n_benign: all.filter((r) => r.label === "benign").length,
    n_complete6: all.filter((r) => Number(r.complete6) === 1).length,
    n_target_api: all.filter((r) => Number(r.n_apis_target) > 0).length,
    note: "A5 official. All CDF modules including TraceInstructions. Labels not ground truth. Not mixed with historical Eixo A.",
  };
  await writeFile(SUMMARY_JSON, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(PAPER_MD, writePaper(all), "utf8");
  console.log(`pronto n=${all.length}  metrics=${METRICS_CSV}`);
  console.log(`summary=${SUMMARY_JSON}`);
  console.log(`paper=${PAPER_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
