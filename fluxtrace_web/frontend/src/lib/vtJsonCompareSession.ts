/** Lote escolhido na página «Analisar JSON VT» — só em sessionStorage, nunca na URL. */
export const VT_JSON_COMPARE_BATCH_STORAGE_KEY = "fluxtrace.vtJsonCompare.batchId";

export function readVtJsonCompareBatchId(): string | null {
  try {
    const v = sessionStorage.getItem(VT_JSON_COMPARE_BATCH_STORAGE_KEY);
    return v?.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function persistVtJsonCompareBatchId(batchId: string): void {
  try {
    sessionStorage.setItem(VT_JSON_COMPARE_BATCH_STORAGE_KEY, batchId);
  } catch {
    /* quota / modo privado */
  }
}
