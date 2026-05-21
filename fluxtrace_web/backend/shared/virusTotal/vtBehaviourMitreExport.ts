const SHA256_HEX = /^[a-f0-9]{64}$/i;

/** Formato como `respostas_virustotal.json`: mapa SHA-256 → `{ data: { SandboxName: { tactics: [...] } }, links }`. */
export function isBehaviourMitreTreesByHashExport(root: unknown): boolean {
  if (root === null || typeof root !== "object" || Array.isArray(root)) return false;
  let n = 0;
  for (const [k, v] of Object.entries(root as Record<string, unknown>)) {
    if (!SHA256_HEX.test(k)) continue;
    if (v === null || typeof v !== "object" || Array.isArray(v)) continue;
    if (!("data" in (v as object))) continue;
    n += 1;
  }
  return n >= 1;
}

export function listExportRootShaKeys(root: unknown): string[] {
  if (root === null || typeof root !== "object" || Array.isArray(root)) return [];
  return Object.keys(root as Record<string, unknown>)
    .filter((k) => SHA256_HEX.test(k))
    .map((k) => k.toLowerCase())
    .sort();
}

function findRootKeyInsensitive(root: Record<string, unknown>, shaLower: string): string | null {
  for (const k of Object.keys(root)) {
    if (!SHA256_HEX.test(k)) continue;
    if (k.toLowerCase() === shaLower) return k;
  }
  return null;
}

/** Lista nomes de sandboxes (ex.: CAPA, CAPE Sandbox) presentes em `entry.data`. */
export function listSandboxNamesFromMitreEntry(entry: unknown): string[] {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return [];
  const data = (entry as { data?: unknown }).data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.keys(data as Record<string, unknown>).sort();
}

/**
 * Recolhe IDs de técnica MITRE sob a tática **TA0005** (Defense Evasion),
 * em todas as sandboxes do payload — alinhado ao painel FluxTrace (TA0005).
 */
export function collectTa0005TechniqueIdsFromMitreEntry(entry: unknown): string[] {
  const idSet = new Set<string>();
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return [];

  const data = (entry as { data?: unknown }).data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) return [];

  for (const sandbox of Object.values(data as Record<string, unknown>)) {
    if (sandbox === null || typeof sandbox !== "object" || Array.isArray(sandbox)) continue;
    const tactics = (sandbox as { tactics?: unknown }).tactics;
    if (!Array.isArray(tactics)) continue;
    for (const tac of tactics) {
      if (tac === null || typeof tac !== "object" || Array.isArray(tac)) continue;
      if ((tac as { id?: string }).id !== "TA0005") continue;
      const techniques = (tac as { techniques?: unknown }).techniques;
      if (!Array.isArray(techniques)) continue;
      for (const tech of techniques) {
        if (tech === null || typeof tech !== "object" || Array.isArray(tech)) continue;
        const tid = (tech as { id?: string }).id;
        if (typeof tid === "string" && tid.trim()) idSet.add(tid.trim());
      }
    }
  }
  return [...idSet].sort((a, b) => a.localeCompare(b));
}

export type MitreEntryPick = {
  entry: unknown;
  matchedKey: string | null;
  availableHashes: string[];
};

export function pickMitreTreeEntryForBatch(root: unknown, batchShaLower: string | null): MitreEntryPick {
  const availableHashes = listExportRootShaKeys(root);
  if (!batchShaLower || !SHA256_HEX.test(batchShaLower)) {
    return { entry: null, matchedKey: null, availableHashes };
  }
  const norm = batchShaLower.toLowerCase();
  if (root === null || typeof root !== "object" || Array.isArray(root)) {
    return { entry: null, matchedKey: null, availableHashes };
  }
  const rec = root as Record<string, unknown>;
  const key = findRootKeyInsensitive(rec, norm);
  if (!key) {
    return { entry: null, matchedKey: null, availableHashes };
  }
  return { entry: rec[key], matchedKey: norm, availableHashes };
}
