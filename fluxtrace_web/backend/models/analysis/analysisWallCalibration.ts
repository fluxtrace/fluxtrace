/**
 * Tempos Σ(upload + processamento) por lote no dashboard.
 * Sem métricas persistidas, estimação por regressão ms/Byte (dos lotos ancorados) ou duração do lote.
 */

export type WallMsSource = "measured" | "estimated_size" | "estimated_job_span" | "estimated_fallback";

export type WallCalibrationInputRow = {
  batchId: string;
  sampleName: string;
  summaryJson: unknown | null | undefined;
  completedAt: Date | null | undefined;
  updatedAt: Date;
  createdAt: Date;
};

export type ResolvedCompletedWallEntry = {
  batchId: string;
  sampleName: string;
  wallMs: number;
  endedAtIso: string;
  wallMsSource: WallMsSource;
  /** Σ bytes originais dos logs do lote (base alinhada ao «tamanho consolidado» em Reduzir logs). */
  totalOriginalBytes: number;
};

/** Lotes com Σ tempos ≥ isto e bytes suficientes calibram ms/Byte. */
const MIN_ANCHOR_MEASURED_MS = 300;
const MIN_ANCHOR_BYTES = 512;
const MIN_SPAN_FOR_CALIBRATION_MS = 2000;
/** Heurística quando não há referência nenhuma (ms por MiB de original). */
const FALLBACK_MS_PER_MB = 3500;

export function sumWallMsFromInsightSummary(summaryJson: unknown): number {
  if (!summaryJson || typeof summaryJson !== "object" || Array.isArray(summaryJson)) {
    return 0;
  }
  const fm = (summaryJson as Record<string, unknown>).fileMetrics;
  if (!Array.isArray(fm)) {
    return 0;
  }
  let total = 0;
  for (const row of fm) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const r = row as Record<string, unknown>;
    const upload =
      typeof r.uploadDurationMs === "number" && Number.isFinite(r.uploadDurationMs) ? r.uploadDurationMs : 0;
    const processing =
      typeof r.processingDurationMs === "number" && Number.isFinite(r.processingDurationMs)
        ? r.processingDurationMs
        : 0;
    total += upload + processing;
  }
  return Math.max(0, Math.round(total));
}

function sumCompletedFileOriginalBytes(summaryJson: unknown): number {
  if (!summaryJson || typeof summaryJson !== "object" || Array.isArray(summaryJson)) {
    return 0;
  }
  const fm = (summaryJson as Record<string, unknown>).fileMetrics;
  if (!Array.isArray(fm)) {
    return 0;
  }
  let total = 0;
  for (const row of fm) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const r = row as Record<string, unknown>;
    const st = typeof r.status === "string" ? r.status : "";
    if (st && st !== "completed") continue;
    const b = typeof r.originalBytes === "number" && Number.isFinite(r.originalBytes) ? r.originalBytes : 0;
    if (b > 0) total += b;
  }
  return Math.max(0, Math.round(total));
}

function sumAnyFileOriginalBytes(summaryJson: unknown): number {
  if (!summaryJson || typeof summaryJson !== "object" || Array.isArray(summaryJson)) {
    return 0;
  }
  const fm = (summaryJson as Record<string, unknown>).fileMetrics;
  if (!Array.isArray(fm)) {
    return 0;
  }
  let total = 0;
  for (const row of fm) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const b = typeof r.originalBytes === "number" && Number.isFinite(r.originalBytes) ? r.originalBytes : 0;
    if (b > 0) total += b;
  }
  return Math.max(0, Math.round(total));
}

function metricsOriginalBytes(summaryJson: unknown): number {
  if (!summaryJson || typeof summaryJson !== "object" || Array.isArray(summaryJson)) {
    return 0;
  }
  const m = (summaryJson as Record<string, unknown>).metrics;
  if (!m || typeof m !== "object") return 0;
  const b = (m as Record<string, unknown>).originalBytes;
  return typeof b === "number" && Number.isFinite(b) && b > 0 ? Math.round(b) : 0;
}

/** Preferir bytes de ficheiros concluídos, depois agregação `metrics.originalBytes`. */
export function getBatchByteFootprint(summaryJson: unknown): number {
  const fromCompleted = sumCompletedFileOriginalBytes(summaryJson);
  if (fromCompleted > 0) return fromCompleted;
  const fromMetrics = metricsOriginalBytes(summaryJson);
  if (fromMetrics > 0) return fromMetrics;
  return sumAnyFileOriginalBytes(summaryJson);
}

function snapshotSummaryForPatch(summaryJson: unknown): Record<string, unknown> | null {
  if (summaryJson == null) return null;
  try {
    return JSON.parse(JSON.stringify(summaryJson)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Grava distribuição de `processingDurationMs` apenas onde estava ausente/zero,
 * proporcional aos `originalBytes`.
 */
export function applyDistributedProcessingEstimate(
  summaryJson: unknown,
  totalEstimatedWallMs: number,
): Record<string, unknown> | null {
  if (!(totalEstimatedWallMs > 0)) return null;
  const snapshot = snapshotSummaryForPatch(summaryJson);
  if (!snapshot || !Array.isArray(snapshot.fileMetrics)) return null;

  const rows = snapshot.fileMetrics as Record<string, unknown>[];
  if (!rows.length) return null;

  let candidates = rows.filter((r) => {
    const st = typeof r.status === "string" ? r.status : "";
    const pb = typeof r.processingDurationMs === "number" ? (r.processingDurationMs as number) : 0;
    if (pb > 0) return false;
    return st === "completed" || st === "" || !st;
  });
  if (!candidates.length) {
    candidates = [...rows];
  }

  const weights = candidates.map((r) => {
    const b = typeof r.originalBytes === "number" ? (r.originalBytes as number) : 0;
    return Number.isFinite(b) && b > 0 ? b : 1;
  });
  const W = weights.reduce((s, x) => s + x, 0) || weights.length;

  const allocations = weights.map((w) => Math.max(250, Math.floor((totalEstimatedWallMs * w) / W)));
  let totalRounded = allocations.reduce((a, v) => a + v, 0);
  const drift = Math.round(totalEstimatedWallMs - totalRounded);

  if (drift !== 0 && allocations.length) {
    const best = weights.indexOf(Math.max(...weights));
    allocations[best] = Math.max(100, allocations[best] + drift);
  }

  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i];
    const proc = typeof r.processingDurationMs === "number" ? (r.processingDurationMs as number) : 0;
    if (!proc || proc <= 0) {
      r.processingDurationMs = allocations[i];
    }
  }

  snapshot.dashboardEstimatedWallMs = totalEstimatedWallMs;
  snapshot.dashboardEstimatedWallAt = new Date().toISOString();

  return snapshot;
}

function jobSpanMs(row: WallCalibrationInputRow): number {
  const end = row.completedAt ?? row.updatedAt;
  return Math.max(0, end.getTime() - row.createdAt.getTime());
}

function computeMsPerByteFromMeasuredAnchors(rows: WallCalibrationInputRow[]): number {
  let ms = 0;
  let bytes = 0;
  for (const row of rows) {
    const m = sumWallMsFromInsightSummary(row.summaryJson);
    const b = getBatchByteFootprint(row.summaryJson);
    if (m >= MIN_ANCHOR_MEASURED_MS && b >= MIN_ANCHOR_BYTES) {
      ms += m;
      bytes += b;
    }
  }
  return bytes > 0 && ms > 0 ? ms / bytes : 0;
}

function computeMsPerByteFromJobSpans(rows: WallCalibrationInputRow[]): number {
  let ms = 0;
  let bytes = 0;
  for (const row of rows) {
    const span = jobSpanMs(row);
    const b = getBatchByteFootprint(row.summaryJson);
    if (span >= MIN_SPAN_FOR_CALIBRATION_MS && b >= MIN_ANCHOR_BYTES) {
      ms += span;
      bytes += b;
    }
  }
  return bytes > 0 && ms > 0 ? ms / bytes : 0;
}

/**
 * `rows` — mais recente primeiro.
 */
export function resolveDashboardCompletedWallTimes(
  rows: WallCalibrationInputRow[],
  opts?: { maxReturn?: number },
): ResolvedCompletedWallEntry[] {
  const maxReturn = opts?.maxReturn ?? 120;
  const capped = rows.slice(0, 200);

  let msPerByte = computeMsPerByteFromMeasuredAnchors(capped);
  if (msPerByte <= 0) {
    msPerByte = computeMsPerByteFromJobSpans(capped);
  }

  const out: ResolvedCompletedWallEntry[] = [];
  for (const row of capped) {
    const measured = sumWallMsFromInsightSummary(row.summaryJson);
    const bytes = getBatchByteFootprint(row.summaryJson);
    const span = jobSpanMs(row);

    let wallMs: number;
    let wallMsSource: WallMsSource;

    if (measured > 0) {
      wallMs = measured;
      wallMsSource = "measured";
    } else if (msPerByte > 0 && bytes > 0) {
      wallMs = Math.max(300, Math.round(bytes * msPerByte));
      wallMsSource = "estimated_size";
    } else if (span >= 600) {
      wallMs = Math.max(span, 500);
      wallMsSource = "estimated_job_span";
    } else if (bytes > 0) {
      wallMs = Math.max(500, Math.round((bytes / (1024 * 1024)) * FALLBACK_MS_PER_MB));
      wallMsSource = "estimated_fallback";
    } else {
      wallMs = Math.max(span, 2000);
      wallMsSource = span >= 600 ? "estimated_job_span" : "estimated_fallback";
    }

    const ended = row.completedAt ?? row.updatedAt;
    out.push({
      batchId: row.batchId,
      sampleName: row.sampleName,
      wallMs,
      endedAtIso: ended.toISOString(),
      wallMsSource,
      totalOriginalBytes: bytes,
    });

    if (out.length >= maxReturn) break;
  }

  return out;
}
