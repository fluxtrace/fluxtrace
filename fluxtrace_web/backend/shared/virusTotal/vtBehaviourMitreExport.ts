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

/** Técnicas e nomes VT a partir da raíz `data` de `behaviour_mitre_trees` (API VirusTotal ou export compatível). */
export type FlattenVtBehaviourMitreSandbox = {
  /** IDs canónicos (casing da 1ª ocorrência na VT). */
  techniqueIdsSorted: string[];
  ta0005TechniqueIdsSorted: string[];
  /** Chave sempre `technique.id` em maiúsculas. */
  techniqueNameByUpper: Map<string, string>;
};

const mitreCmp = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/**
 * Extrai lista de todas as técnicas + só TA0005 + nomes, num único passe sobre as sandboxes.
 */
export function flattenVtBehaviourMitreSandboxData(data: unknown): FlattenVtBehaviourMitreSandbox {
  const empty = (): FlattenVtBehaviourMitreSandbox => ({
    techniqueIdsSorted: [],
    ta0005TechniqueIdsSorted: [],
    techniqueNameByUpper: new Map(),
  });

  if (data === null || typeof data !== "object" || Array.isArray(data)) return empty();

  const canonByUpperAll = new Map<string, string>();
  const canonByUpperTa5 = new Map<string, string>();
  const nameByUpper = new Map<string, string>();

  for (const sandbox of Object.values(data as Record<string, unknown>)) {
    if (sandbox === null || typeof sandbox !== "object" || Array.isArray(sandbox)) continue;
    const tactics = (sandbox as { tactics?: unknown }).tactics;
    if (!Array.isArray(tactics)) continue;
    for (const tac of tactics) {
      if (tac === null || typeof tac !== "object" || Array.isArray(tac)) continue;
      const tacIdRaw = (tac as { id?: string }).id;
      const tacNorm = typeof tacIdRaw === "string" ? tacIdRaw.trim() : "";
      const tacticsTechniques = (tac as { techniques?: unknown }).techniques;
      if (!Array.isArray(tacticsTechniques)) continue;
      const isDefense = tacNorm.toUpperCase() === "TA0005";

      for (const tech of tacticsTechniques) {
        if (tech === null || typeof tech !== "object" || Array.isArray(tech)) continue;
        const tidRaw = (tech as { id?: string }).id;
        if (typeof tidRaw !== "string" || !tidRaw.trim()) continue;
        const tidCanon = tidRaw.trim();
        const u = tidCanon.toUpperCase();
        const nm =
          typeof (tech as { name?: unknown }).name === "string"
            ? (tech as { name: string }).name.trim()
            : "";

        if (!canonByUpperAll.has(u)) canonByUpperAll.set(u, tidCanon);
        if (nm && !nameByUpper.has(u)) nameByUpper.set(u, nm);
        if (isDefense && !canonByUpperTa5.has(u)) canonByUpperTa5.set(u, tidCanon);
      }
    }
  }

  const techniqueIdsSorted = [...canonByUpperAll.keys()]
    .sort(mitreCmp)
    .map((u) => canonByUpperAll.get(u)!);

  const ta0005TechniqueIdsSorted = [...canonByUpperTa5.keys()]
    .sort(mitreCmp)
    .map((u) => canonByUpperTa5.get(u)!);

  return { techniqueIdsSorted, ta0005TechniqueIdsSorted, techniqueNameByUpper: nameByUpper };
}

/**
 * {@link collectFluxtraceDefenseEvasionTechniqueIds}: IDs canónicos com nomes onde existem em `mitreDefenseEvasion`.
 */
export function fluxDefenseEvasionCanonAndNames(mitre: unknown): {
  canonIdsSorted: string[];
  nameByUpper: Map<string, string>;
} {
  if (mitre === null || typeof mitre !== "object") {
    return { canonIdsSorted: [], nameByUpper: new Map() };
  }
  const techniques = (mitre as { techniques?: unknown }).techniques;
  if (!Array.isArray(techniques)) return { canonIdsSorted: [], nameByUpper: new Map() };

  const canonByUpper = new Map<string, string>();
  const nameByUpper = new Map<string, string>();

  for (const t of techniques) {
    if (!t || typeof t !== "object") continue;
    const idRaw = (t as { id?: unknown }).id;
    if (typeof idRaw !== "string" || !idRaw.trim()) continue;
    const canon = idRaw.trim();
    const u = canon.toUpperCase();
    if (!canonByUpper.has(u)) canonByUpper.set(u, canon);
    const nm = typeof (t as { name?: unknown }).name === "string" ? (t as { name: string }).name.trim() : "";
    if (nm && !nameByUpper.has(u)) nameByUpper.set(u, nm);
  }

  const canonIdsSorted = [...canonByUpper.keys()].sort(mitreCmp).map((upper) => canonByUpper.get(upper)!);

  return { canonIdsSorted, nameByUpper };
}

/** Técnicas TA0005 registadas no insight FluxTrace (`mitreDefenseEvasion.techniques[].id`). */
export function collectFluxtraceDefenseEvasionTechniqueIds(mitre: unknown): string[] {
  return fluxDefenseEvasionCanonAndNames(mitre).canonIdsSorted;
}

/**
 * Recolhe IDs de técnicas MITRE em todas as táticas e sandboxes a partir da raiz `data` da resposta
 * `GET /api/v3/files/{id}/behaviour_mitre_trees` (documentação VirusTotal).
 */
export function collectAllBehaviourMitreTechniqueIdsFromVtSandboxMap(data: unknown): string[] {
  const idSet = new Set<string>();
  if (data === null || typeof data !== "object" || Array.isArray(data)) return [];

  for (const sandbox of Object.values(data as Record<string, unknown>)) {
    if (sandbox === null || typeof sandbox !== "object" || Array.isArray(sandbox)) continue;
    const tactics = (sandbox as { tactics?: unknown }).tactics;
    if (!Array.isArray(tactics)) continue;
    for (const tac of tactics) {
      if (tac === null || typeof tac !== "object" || Array.isArray(tac)) continue;
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
