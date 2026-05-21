import { getAnalysisBatchByBatchId, listAnalysisBatches } from "../../models/db";
import { getAnalysisBatchDetail } from "../analysis/analysisService";
import { normalizeOptionalSampleSha256 } from "../../shared/virusTotal";
import type { VirusTotalBatchLookupResult } from "../../shared/virusTotal/virusTotalReport";
import { virusTotalLookupFile } from "./virusTotalLookup";

/** Uma entrada por SHA-256 (minúsculas). Compatível com o padrão de mapa por hash do export externo. */
export type FluxtraceUnifiedMitreVtEntry = {
  _fluxtrace: {
    schema: "fluxtrace.unified_mitre_vt.v1";
    exportedAt: string;
    batchId: string;
    sampleName: string;
    /** TA0005 + correlacionação completa tal como na UI. */
    mitreDefenseEvasion: unknown;
    virusTotalFileReport: VirusTotalBatchLookupResult;
  };
};

export type FluxtraceUnifiedMitreVtMap = Record<string, FluxtraceUnifiedMitreVtEntry>;

export type BuildFluxtraceUnifiedMitreExportResult = {
  bySha: FluxtraceUnifiedMitreVtMap;
  meta: {
    included: number;
    skippedNoHash: number;
    skippedDuplicateSha: number;
    skippedNoDetail: number;
  };
};

/**
 * Agrega vários lotes com SHA-256 num único objecto JSON (chaves = hash da amostra).
 * Útil para comparar com exports de terceiros que já unificam vários hashes.
 */
export async function buildFluxtraceUnifiedMitreVtExport(params: {
  apiKey: string;
  batchIds: string[];
  /** Chamadas a `getAnalysisBatchDetail` em série para não sobrecarregar DB/API VT. */
}): Promise<BuildFluxtraceUnifiedMitreExportResult> {
  const meta = {
    included: 0,
    skippedNoHash: 0,
    skippedDuplicateSha: 0,
    skippedNoDetail: 0,
  };

  const bySha: FluxtraceUnifiedMitreVtMap = {};
  const seenSha = new Set<string>();

  const apiKey = params.apiKey.trim();

  for (const batchId of params.batchIds) {
    const row = await getAnalysisBatchByBatchId(batchId);
    if (!row) {
      meta.skippedNoDetail += 1;
      continue;
    }

    const sha = normalizeOptionalSampleSha256(row.sampleSha256 ?? "");
    if (!sha) {
      meta.skippedNoHash += 1;
      continue;
    }

    if (seenSha.has(sha)) {
      meta.skippedDuplicateSha += 1;
      continue;
    }
    seenSha.add(sha);

    const detail = await getAnalysisBatchDetail(batchId, { includeServerProcess: false });
    if (!detail) {
      meta.skippedNoDetail += 1;
      continue;
    }

    const virusTotalFileReport: VirusTotalBatchLookupResult =
      apiKey.length > 0
        ? await virusTotalLookupFile({ sha256Lowercase: sha, apiKey })
        : ({
            ok: false,
            code: "unconfigured",
            message: "VIRUSTOTAL_API_KEY em falta no servidor.",
          } as VirusTotalBatchLookupResult);

    bySha[sha] = {
      _fluxtrace: {
        schema: "fluxtrace.unified_mitre_vt.v1",
        exportedAt: new Date().toISOString(),
        batchId,
        sampleName: detail.batch.sampleName,
        mitreDefenseEvasion: detail.mitreDefenseEvasion,
        virusTotalFileReport,
      },
    };
    meta.included += 1;
  }

  return { bySha, meta };
}

/** Resolve IDs de lote a incluir: lista explícita ou últimos N lotes visíveis pelo utilizador. */
export async function resolveBatchIdsForUnifiedExport(params: {
  userId: number;
  isGlobalScope: boolean;
  batchIdsFilter?: string[];
  maxBatches: number;
}): Promise<string[]> {
  if (params.batchIdsFilter?.length) {
    const uniq = [...new Set(params.batchIdsFilter)];
    const allowed: string[] = [];
    for (const id of uniq) {
      const row = await getAnalysisBatchByBatchId(id);
      if (!row) continue;
      if (!params.isGlobalScope) {
        if (row.createdByUserId == null || row.createdByUserId !== params.userId) continue;
      }
      allowed.push(id);
    }
    return allowed.slice(0, params.maxBatches);
  }

  const rows = await listAnalysisBatches({
    limit: params.maxBatches,
    ...(params.isGlobalScope ? {} : { createdByUserId: params.userId }),
  });
  return rows.map((r) => r.batchId);
}
