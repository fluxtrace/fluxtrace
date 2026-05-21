import type { TFunction } from "i18next";
import type {
  VirusTotalAnalysisStats,
  VirusTotalBatchLookupResult,
} from "@shared/virusTotal/virusTotalReport";
import { statsTotalEngines } from "@shared/virusTotal/vtExportFingerprint";

const VT_STATS_KNOWN_ORDER = [
  "malicious",
  "suspicious",
  "harmless",
  "undetected",
  "timeout",
  "confirmed_timeout",
  "failure",
  "type_unsupported",
] as const;

function statBucketLabel(key: string, t: TFunction): string {
  switch (key) {
    case "malicious":
      return t("vtJsonCompare.unifiedResultVtStatMalicious");
    case "suspicious":
      return t("vtJsonCompare.unifiedResultVtStatSuspicious");
    case "harmless":
      return t("vtJsonCompare.unifiedResultVtStatHarmless");
    case "undetected":
      return t("vtJsonCompare.unifiedResultVtStatUndetected");
    case "timeout":
      return t("vtJsonCompare.unifiedResultVtStatTimeout");
    case "confirmed_timeout":
      return t("vtJsonCompare.unifiedResultVtStatConfirmedTimeout");
    case "failure":
      return t("vtJsonCompare.unifiedResultVtStatFailure");
    case "type_unsupported":
      return t("vtJsonCompare.unifiedResultVtStatTypeUnsupported");
    default:
      return key.replace(/_/g, " ");
  }
}

function formatLastAnalysisStatsBreakdown(stats: VirusTotalAnalysisStats | null | undefined, t: TFunction): string {
  if (!stats || typeof stats !== "object") {
    return t("vtJsonCompare.unifiedResultVtStatsBreakdownNone");
  }
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const key of VT_STATS_KNOWN_ORDER) {
    const v = (stats as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      parts.push(`${statBucketLabel(key, t)}: ${v}`);
      seen.add(key);
    }
  }
  const restKeys = Object.keys(stats)
    .filter((k) => !seen.has(k))
    .sort((a, b) => a.localeCompare(b));
  for (const key of restKeys) {
    const v = (stats as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      parts.push(`${statBucketLabel(key, t)}: ${v}`);
    }
  }
  return parts.length ? parts.join("; ") : t("vtJsonCompare.unifiedResultVtStatsBreakdownNone");
}

/** Texto da linha «Relatório VT (API)» — partilhado entre UI e exportações. */
export function unifiedMitreVtApiLine(vt: VirusTotalBatchLookupResult, t: TFunction): string {
  if (vt.ok === false) {
    return t("vtJsonCompare.unifiedResultVtApiFail", { code: vt.code, message: vt.message });
  }
  const total = statsTotalEngines(vt.stats ?? undefined);
  const name = vt.meaningfulName ?? "—";
  const breakdown = formatLastAnalysisStatsBreakdown(vt.stats ?? undefined, t);
  return t("vtJsonCompare.unifiedResultVtApiOk", { name, total, breakdown });
}
