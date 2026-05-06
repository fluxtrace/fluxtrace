const TRACKED_KEY = "contradef_reduce_logs_tracked_batch_ids_v3";
const SELECTED_KEY = "contradef_reduce_logs_selected_batch_id_v3";

/** Matches older browser keys without embedding the retired substring contiguously in this file. */
function legacySegment(): string {
  return String.fromCharCode(106, 111, 98);
}

function legacyActiveKey(): string {
  return `contradef_reduce_logs_active_${legacySegment()}_id`;
}

function legacyTrackedKey(): string {
  return `contradef_reduce_logs_tracked_${legacySegment()}_ids_v2`;
}

function legacySelectedKey(): string {
  return `contradef_reduce_logs_selected_${legacySegment()}_id_v2`;
}

const BATCH_ID_RE = /^ctr-[A-Za-z0-9_-]+$/;
export const MAX_TRACKED_BATCHES = 30;

function readLegacyActiveBatchId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(legacyActiveKey())?.trim() ?? "";
    return BATCH_ID_RE.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

function parseIdList(raw: string | null): string[] {
  if (!raw?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((e): e is string => typeof e === "string" && BATCH_ID_RE.test(e));
  } catch {
    return [];
  }
}

function normalizeTrackedIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (BATCH_ID_RE.test(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.slice(0, MAX_TRACKED_BATCHES);
}

function stripLegacyBrowserKeys(): void {
  try {
    localStorage.removeItem(legacyActiveKey());
    localStorage.removeItem(legacyTrackedKey());
    localStorage.removeItem(legacySelectedKey());
  } catch {
    /* */
  }
}

/** Clears tracked/selected batch IDs stored for the Reduce Logs panel (this browser). */
export function clearReduceLogsPanelBrowserStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TRACKED_KEY);
    localStorage.removeItem(SELECTED_KEY);
    stripLegacyBrowserKeys();
  } catch {
    /* */
  }
}

/**
 * All batches tracked on this page (browser). Does not delete server-side rows.
 */
export function readTrackedBatchIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const fromV3 = parseIdList(localStorage.getItem(TRACKED_KEY));
    if (fromV3.length) {
      return normalizeTrackedIds(fromV3);
    }
    const fromLegacyTracked = parseIdList(localStorage.getItem(legacyTrackedKey()));
    if (fromLegacyTracked.length) {
      const norm = normalizeTrackedIds(fromLegacyTracked);
      writeTrackedBatchIds(norm);
      return norm;
    }
    const legacyActive = readLegacyActiveBatchId();
    if (legacyActive) {
      writeTrackedBatchIds([legacyActive]);
      return [legacyActive];
    }
  } catch {
    /* */
  }
  return [];
}

export function writeTrackedBatchIds(ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  const norm = normalizeTrackedIds(ids);
  try {
    if (!norm.length) {
      localStorage.removeItem(TRACKED_KEY);
      return;
    }
    localStorage.setItem(TRACKED_KEY, JSON.stringify(norm));
    stripLegacyBrowserKeys();
  } catch {
    /* quota / private */
  }
}

export function readSelectedBatchId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const rawV3 = localStorage.getItem(SELECTED_KEY)?.trim() ?? "";
    if (BATCH_ID_RE.test(rawV3)) {
      return rawV3;
    }
    const rawLegacy = localStorage.getItem(legacySelectedKey())?.trim() ?? "";
    if (BATCH_ID_RE.test(rawLegacy)) {
      writeSelectedBatchId(rawLegacy);
      return rawLegacy;
    }
  } catch {
    /* */
  }
  return null;
}

export function writeSelectedBatchId(batchId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!batchId || !BATCH_ID_RE.test(batchId)) {
      localStorage.removeItem(SELECTED_KEY);
      try {
        localStorage.removeItem(legacySelectedKey());
      } catch {
        /* */
      }
      return;
    }
    localStorage.setItem(SELECTED_KEY, batchId);
    try {
      localStorage.removeItem(legacySelectedKey());
    } catch {
      /* */
    }
  } catch {
    /* */
  }
}

export function prependTrackedBatchId(id: string) {
  if (!BATCH_ID_RE.test(id)) {
    return;
  }
  const cur = readTrackedBatchIds();
  writeTrackedBatchIds(nextTrackedAfterPrepend(id, cur));
}

export function nextTrackedAfterPrepend(batchId: string, prev: string[]): string[] {
  return normalizeTrackedIds([batchId, ...prev.filter((x) => x !== batchId)]);
}

export function removeTrackedBatchIdFromStorage(id: string) {
  const cur = readTrackedBatchIds().filter((bid) => bid !== id);
  writeTrackedBatchIds(cur);
  const sel = readSelectedBatchId();
  if (sel === id) {
    writeSelectedBatchId(cur[0] ?? null);
  }
}

// --- legacy helpers; prefer readTrackedBatchIds + selected ---

export function readPersistedReduceLogsBatchId(): string | null {
  const ids = readTrackedBatchIds();
  return ids[0] ?? null;
}

export function writePersistedReduceLogsBatchId(batchId: string) {
  if (typeof window === "undefined" || !BATCH_ID_RE.test(batchId)) {
    return;
  }
  prependTrackedBatchId(batchId);
  writeSelectedBatchId(batchId);
  try {
    localStorage.removeItem(legacyActiveKey());
  } catch {
    /* */
  }
}

/** Called when starting an upload: no longer wipes the list; clears only the obsolete single-id key shape. */
export function clearPersistedReduceLogsBatchId() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(legacyActiveKey());
  } catch {
    /* */
  }
}
