import { virusTotalAnalysisStatsSchema, type VirusTotalAnalysisStats } from "./virusTotalReport";

const SHA256_HEX = /^[a-f0-9]{64}$/i;

export type VtExportFingerprint = {
  sha256: string | null;
  stats: VirusTotalAnalysisStats | null;
  meaningfulName: string | null;
  typeDescription: string | null;
  /** Unix segundos quando presente no export. */
  lastAnalysisDate: number | null;
  /** Notas para o analista (ex.: onde se encontraram os campos). */
  parseNotes: string[];
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Procura pela primeira chave `key` em profundidade (limite de nós para evitar explosão). */
export function deepFindKey(root: unknown, key: string, maxNodes = 50_000): unknown {
  let visited = 0;
  const stack: unknown[] = [root];
  while (stack.length && visited < maxNodes) {
    const cur = stack.pop();
    visited += 1;
    if (cur === null || cur === undefined) continue;
    if (typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      for (let i = cur.length - 1; i >= 0; i -= 1) {
        stack.push(cur[i]);
      }
      continue;
    }
    const o = cur as Record<string, unknown>;
    if (key in o) {
      return o[key];
    }
    for (const v of Object.values(o)) {
      stack.push(v);
    }
  }
  return undefined;
}

/** Extrai SHA-256 de campos conhecidos ou do primeiro campo nomeado sha256 válido. */
function extractSha256(root: unknown): { value: string | null; note?: string } {
  const paths: Array<{ path: string; val: unknown }> = [
    { path: "data.attributes.sha256", val: deepFindNested(root, ["data", "attributes", "sha256"]) },
    { path: "attributes.sha256", val: deepFindNested(root, ["attributes", "sha256"]) },
  ];
  for (const { path, val } of paths) {
    const s = str(val);
    if (s && SHA256_HEX.test(s)) {
      return { value: s.toLowerCase(), note: `sha256 em \`${path}\`` };
    }
  }

  let visited = 0;
  const stack: unknown[] = [root];
  while (stack.length && visited < 40_000) {
    const cur = stack.pop();
    visited += 1;
    if (cur === null || cur === undefined) continue;
    if (typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      for (const x of cur) stack.push(x);
      continue;
    }
    const o = cur as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (k.toLowerCase() === "sha256") {
        const s = str(v);
        if (s && SHA256_HEX.test(s)) {
          return { value: s.toLowerCase(), note: "sha256 encontrado por varredura de campos" };
        }
      }
      stack.push(v);
    }
  }
  return { value: null };
}

function deepFindNested(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const p of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function parseStats(raw: unknown): { stats: VirusTotalAnalysisStats | null; ok: boolean } {
  const parsed = virusTotalAnalysisStatsSchema.safeParse(raw);
  if (parsed.success) {
    return { stats: parsed.data, ok: true };
  }
  return { stats: null, ok: false };
}

/**
 * Tenta interpretar JSON exportado por outra ferramenta (muitas espelham a API pública VT v3:
 * `data.attributes.last_analysis_stats`, ou só `attributes`, ou relatório aninhado).
 */
export function extractVtExportFingerprint(root: unknown): VtExportFingerprint {
  const parseNotes: string[] = [];

  const shaInfo = extractSha256(root);
  if (shaInfo.value) {
    parseNotes.push(shaInfo.note ?? "sha256 detectado");
  } else {
    parseNotes.push("Nenhum campo sha256 (64 hex) identificado de forma inequívoca — confirme o formato do export.");
  }

  let statsRaw = deepFindKey(root, "last_analysis_stats");
  if (statsRaw === undefined) {
    statsRaw = deepFindNested(root, ["data", "attributes", "last_analysis_stats"]);
  }
  const statsParsed = statsRaw !== undefined ? parseStats(statsRaw) : { stats: null, ok: false };
  if (statsParsed.ok && statsParsed.stats) {
    parseNotes.push("`last_analysis_stats` encontrado e validado.");
  } else if (statsRaw !== undefined) {
    parseNotes.push("`last_analysis_stats` presente mas não corresponde ao esquema esperado (números opcionais).");
  } else {
    parseNotes.push("Sem `last_analysis_stats` — não é possível comparar contagens de motores.");
  }

  let meaningfulName = str(deepFindNested(root, ["data", "attributes", "meaningful_name"]));
  if (!meaningfulName) meaningfulName = str(deepFindKey(root, "meaningful_name"));

  let typeDescription = str(deepFindNested(root, ["data", "attributes", "type_description"]));
  if (!typeDescription) {
    const magic = deepFindNested(root, ["data", "attributes", "magic"]);
    const desc = str(magic);
    if (desc) typeDescription = desc;
  }

  let lastAnalysisDate: number | null = num(deepFindNested(root, ["data", "attributes", "last_analysis_date"]));
  if (lastAnalysisDate == null) {
    const lax = deepFindKey(root, "last_analysis_date");
    lastAnalysisDate = num(lax);
  }

  return {
    sha256: shaInfo.value,
    stats: statsParsed.stats,
    meaningfulName,
    typeDescription,
    lastAnalysisDate,
    parseNotes,
  };
}

export type StatsDiffRow = {
  key: string;
  fluxtrace: number;
  exportado: number;
  igual: boolean;
};

const STAT_KEYS = [
  "malicious",
  "suspicious",
  "harmless",
  "undetected",
  "timeout",
  "failure",
  "confirmed_timeout",
  "type_unsupported",
] as const;

export function diffVtStats(
  internal: VirusTotalAnalysisStats | null | undefined,
  external: VirusTotalAnalysisStats | null | undefined,
): StatsDiffRow[] {
  const rows: StatsDiffRow[] = [];
  for (const key of STAT_KEYS) {
    const a = internal && typeof internal[key] === "number" ? (internal[key] as number) : 0;
    const b = external && typeof external[key] === "number" ? (external[key] as number) : 0;
    rows.push({ key, fluxtrace: a, exportado: b, igual: a === b });
  }
  return rows;
}

export function statsTotalEngines(stats: VirusTotalAnalysisStats | null | undefined): number {
  if (!stats) return 0;
  return Object.values(stats).reduce<number>((acc, v) => {
    return typeof v === "number" && Number.isFinite(v) ? acc + v : acc;
  }, 0);
}
