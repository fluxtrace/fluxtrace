import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import bundledCatalog from "../../shared/data/mitreTa0005Catalog.json";

export const MITRE_ENTERPRISE_STIX_URL =
  "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json";

export const MITRE_CATALOG_DAILY_MS = 24 * 60 * 60 * 1000;
const HOURLY_CHECK_MS = 60 * 60 * 1000;
const STIX_TIMEOUT_MS = 120_000;

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "../../shared/data/mitreTa0005Catalog.json");

export type MitreTacticRef = { id: string; name: string };

export type MitreCatalogTechnique = {
  id: string;
  name: string;
  url: string;
  /** Outras tácticas Enterprise da mesma técnica (ex.: T1497 também em TA0007 Discovery). */
  otherTactics?: MitreTacticRef[];
};

export const TA0005_DEFAULT_NAME = "Stealth";
export const TA0005_URL = "https://attack.mitre.org/tactics/TA0005/";

/**
 * Fases STIX da TA0005: `stealth` desde a ATT&CK v19 (Defense Evasion foi dividida em
 * Stealth, que herda TA0005, e Defense Impairment, TA0112); `defense-evasion` em bundles anteriores.
 */
const TA0005_PHASES = new Set(["stealth", "defense-evasion"]);

export type MitreCatalogIdDelta = {
  added: string[];
  removed: string[];
  renamed: Array<{ id: string; previousName: string; name: string }>;
};

export type MitreCatalogFile = {
  tacticId: string;
  tacticName: string;
  source: string;
  generatedAt: string;
  version?: string;
  /** Versão da ATT&CK Enterprise (`x_mitre_version` da colecção STIX, ex.: "20.1"). */
  attackVersion?: string;
  syncedAt?: string | null;
  idDelta?: MitreCatalogIdDelta;
  techniques: MitreCatalogTechnique[];
};

export type MitreCatalogStatus = {
  tacticId: string;
  tacticName: string;
  source: string;
  generatedAt: string;
  version: string;
  attackVersion: string | null;
  syncedAt: string | null;
  techniqueCount: number;
  techniques: MitreCatalogTechnique[];
  idDelta: MitreCatalogIdDelta;
  idsChanged: boolean;
};

type StixObject = Record<string, unknown>;

let catalogCache: MitreCatalogFile | null = null;
let dailyTimer: ReturnType<typeof setInterval> | null = null;

function techniqueUrl(id: string): string {
  const dot = id.indexOf(".");
  if (dot === -1) return `https://attack.mitre.org/techniques/${id}/`;
  return `https://attack.mitre.org/techniques/${id.slice(0, dot)}/${id.slice(dot + 1)}/`;
}

function emptyDelta(): MitreCatalogIdDelta {
  return { added: [], removed: [], renamed: [] };
}

function asCatalog(raw: unknown): MitreCatalogFile {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const techniques = Array.isArray(obj.techniques)
    ? obj.techniques.filter((row): row is MitreCatalogTechnique => {
        return Boolean(row && typeof row === "object" && typeof (row as MitreCatalogTechnique).id === "string");
      })
    : [];
  return {
    tacticId: typeof obj.tacticId === "string" ? obj.tacticId : "TA0005",
    tacticName: typeof obj.tacticName === "string" ? obj.tacticName : TA0005_DEFAULT_NAME,
    source: typeof obj.source === "string" ? obj.source : TA0005_URL,
    generatedAt: typeof obj.generatedAt === "string" ? obj.generatedAt : "",
    version: typeof obj.version === "string" ? obj.version : undefined,
    attackVersion: typeof obj.attackVersion === "string" ? obj.attackVersion : undefined,
    syncedAt: typeof obj.syncedAt === "string" ? obj.syncedAt : null,
    idDelta: obj.idDelta && typeof obj.idDelta === "object" ? (obj.idDelta as MitreCatalogIdDelta) : emptyDelta(),
    techniques,
  };
}

export function diffMitreCatalog(
  previous: readonly MitreCatalogTechnique[],
  next: readonly MitreCatalogTechnique[],
): MitreCatalogIdDelta {
  const prevById = new Map(previous.map((row) => [row.id, row]));
  const nextIds = new Set(next.map((row) => row.id));
  const added = next.filter((row) => !prevById.has(row.id)).map((row) => row.id);
  const removed = previous.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
  const renamed = next.flatMap((row) => {
    const prev = prevById.get(row.id);
    if (!prev || prev.name === row.name) return [];
    return [{ id: row.id, previousName: prev.name, name: row.name }];
  });
  return { added, removed, renamed };
}

function attackIdAndUrl(obj: StixObject, pattern = /^T\d{4}/): { id: string; url: string } | null {
  const refs = Array.isArray(obj.external_references) ? obj.external_references : [];
  for (const ref of refs) {
    if (!ref || typeof ref !== "object") continue;
    const row = ref as Record<string, unknown>;
    if (row.source_name !== "mitre-attack" || typeof row.external_id !== "string") continue;
    if (!pattern.test(row.external_id)) continue;
    const id = row.external_id;
    const url = typeof row.url === "string" && row.url.trim() ? row.url : techniqueUrl(id);
    return { id, url };
  }
  return null;
}

function phaseNames(obj: StixObject): string[] {
  const phases = Array.isArray(obj.kill_chain_phases) ? obj.kill_chain_phases : [];
  return phases.flatMap((phase) => {
    if (!phase || typeof phase !== "object") return [];
    const row = phase as Record<string, unknown>;
    if (row.kill_chain_name !== undefined && row.kill_chain_name !== "mitre-attack") return [];
    return typeof row.phase_name === "string" ? [row.phase_name] : [];
  });
}

function isActive(obj: StixObject): boolean {
  return obj.revoked !== true && obj.x_mitre_deprecated !== true;
}

export function extractTa0005CatalogFromStix(bundle: unknown): {
  /** Versão da ATT&CK Enterprise (ex.: "20.1"); "unknown" se a colecção não a declarar. */
  version: string;
  attackSpecVersion: string | null;
  tacticName: string;
  techniques: MitreCatalogTechnique[];
} {
  const objects: StixObject[] =
    bundle && typeof bundle === "object" && Array.isArray((bundle as { objects?: unknown }).objects)
      ? ((bundle as { objects: StixObject[] }).objects)
      : Array.isArray(bundle)
        ? (bundle as StixObject[])
        : [];

  let version = "unknown";
  let attackSpecVersion: string | null = null;
  for (const obj of objects) {
    if (obj.type !== "x-mitre-collection") continue;
    if (typeof obj.x_mitre_version === "string") version = obj.x_mitre_version;
    if (typeof obj.x_mitre_attack_spec_version === "string") attackSpecVersion = obj.x_mitre_attack_spec_version;
    break;
  }

  const tacticByPhase = new Map<string, MitreTacticRef>();
  let tacticName = TA0005_DEFAULT_NAME;
  for (const obj of objects) {
    if (obj.type !== "x-mitre-tactic" || !isActive(obj)) continue;
    const ref = attackIdAndUrl(obj, /^TA\d{4}$/);
    if (!ref || typeof obj.x_mitre_shortname !== "string") continue;
    const name = typeof obj.name === "string" && obj.name.trim() ? obj.name : ref.id;
    tacticByPhase.set(obj.x_mitre_shortname, { id: ref.id, name });
    if (ref.id === "TA0005") tacticName = name;
  }

  const techniques: MitreCatalogTechnique[] = [];
  const seen = new Set<string>();
  for (const obj of objects) {
    if (obj.type !== "attack-pattern" || !isActive(obj)) continue;
    const phases = phaseNames(obj);
    if (!phases.some((p) => TA0005_PHASES.has(p))) continue;
    const idUrl = attackIdAndUrl(obj);
    if (!idUrl || seen.has(idUrl.id)) continue;
    seen.add(idUrl.id);
    const otherTactics = phases
      .filter((p) => !TA0005_PHASES.has(p))
      .map((p) => tacticByPhase.get(p) ?? { id: p, name: p })
      .sort((a, b) => a.id.localeCompare(b.id));
    techniques.push({
      id: idUrl.id,
      name: typeof obj.name === "string" && obj.name.trim() ? obj.name : idUrl.id,
      url: idUrl.url,
      ...(otherTactics.length ? { otherTactics } : {}),
    });
  }
  techniques.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return { version, attackSpecVersion, tacticName, techniques };
}

export function readMitreCatalogFromDisk(): MitreCatalogFile {
  if (catalogCache) return catalogCache;
  try {
    catalogCache = asCatalog(JSON.parse(readFileSync(catalogPath, "utf8")));
    return catalogCache;
  } catch {
    catalogCache = asCatalog(bundledCatalog);
    return catalogCache;
  }
}

export function invalidateMitreCatalogCache() {
  catalogCache = null;
}

export function getMitreCatalogStatus(): MitreCatalogStatus {
  const catalog = readMitreCatalogFromDisk();
  const idDelta = catalog.idDelta ?? emptyDelta();
  return {
    tacticId: catalog.tacticId,
    tacticName: catalog.tacticName,
    source: catalog.source,
    generatedAt: catalog.generatedAt,
    version: catalog.version ?? (catalog.generatedAt ? `bundled-${catalog.generatedAt}` : "bundled"),
    attackVersion: catalog.attackVersion ?? null,
    syncedAt: catalog.syncedAt ?? null,
    techniqueCount: catalog.techniques.length,
    techniques: catalog.techniques,
    idDelta,
    idsChanged: idDelta.added.length + idDelta.removed.length + idDelta.renamed.length > 0,
  };
}

function persistCatalog(next: MitreCatalogFile) {
  writeFileSync(catalogPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  catalogCache = next;
}

export async function syncMitreCatalog(options?: {
  fetcher?: (url: string) => Promise<unknown>;
  now?: Date;
}): Promise<MitreCatalogStatus & { ok: true } | { ok: false; message: string }> {
  const previous = readMitreCatalogFromDisk();
  try {
    const bundle = options?.fetcher
      ? await options.fetcher(MITRE_ENTERPRISE_STIX_URL)
      : await downloadOfficialStix();
    const extracted = extractTa0005CatalogFromStix(bundle);
    if (extracted.techniques.length < 10) {
      return { ok: false, message: "STIX Enterprise não devolveu técnicas TA0005 suficientes." };
    }
    const now = options?.now ?? new Date();
    const syncedAt = now.toISOString();
    const idDelta = diffMitreCatalog(previous.techniques, extracted.techniques);
    persistCatalog({
      tacticId: "TA0005",
      tacticName: extracted.tacticName,
      source: TA0005_URL,
      generatedAt: syncedAt.slice(0, 10),
      version: extracted.version,
      attackVersion: extracted.version,
      syncedAt,
      idDelta,
      techniques: extracted.techniques,
    });
    return { ok: true, ...getMitreCatalogStatus() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Falha ao sincronizar o catálogo MITRE: ${message}` };
  }
}

async function downloadOfficialStix(): Promise<unknown> {
  const response = await fetch(MITRE_ENTERPRISE_STIX_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(STIX_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao descarregar o STIX Enterprise.`);
  }
  return response.json();
}

export function catalogIsStale(now = new Date()): boolean {
  const syncedAt = readMitreCatalogFromDisk().syncedAt;
  if (!syncedAt) return true;
  const then = Date.parse(syncedAt);
  if (!Number.isFinite(then)) return true;
  return now.getTime() - then >= MITRE_CATALOG_DAILY_MS;
}

export async function maybeSyncMitreCatalogIfStale(): Promise<void> {
  if (process.env.MITRE_CATALOG_DAILY_SYNC !== "1") return;
  if (!catalogIsStale()) return;
  const result = await syncMitreCatalog();
  if (!result.ok) {
    console.warn("[mitre.syncCatalog] sync diário ignorado:", result.message);
  }
}

export function scheduleMitreCatalogDailySync(): void {
  if (process.env.MITRE_CATALOG_DAILY_SYNC !== "1") return;
  void maybeSyncMitreCatalogIfStale();
  if (dailyTimer) return;
  dailyTimer = setInterval(() => {
    void maybeSyncMitreCatalogIfStale();
  }, HOURLY_CHECK_MS);
  dailyTimer.unref?.();
}
