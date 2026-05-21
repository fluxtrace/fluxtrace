import { isBehaviourMitreTreesByHashExport, listExportRootShaKeys } from "./vtBehaviourMitreExport";

export type VtJsonValueKind =
  | "null"
  | "undefined"
  | "boolean"
  | "number"
  | "string"
  | "array"
  | "object"
  | "other";

export type VtJsonKeyRow = {
  key: string;
  valueKind: VtJsonValueKind;
  /** Indicador curto para a UI (ex.: deteção de formato). */
  noteKey: "vtMitreHashMap" | "fluxtraceUnifiedEntry" | "nestedObject" | "none";
};

export type VtJsonLoadedSummary =
  | {
      ok: true;
      root: "object" | "array" | "other";
      /** Número de chaves de primeiro nível (object) ou comprimento (array). */
      primaryCount: number;
      /** Chaves que parecem SHA-256 (hex 64) no primeiro nível (object). */
      sha256LikeKeyCount: number;
      isVtMitreHashMap: boolean;
      keyRows: VtJsonKeyRow[];
      truncated: boolean;
      truncatedOmitted: number;
    }
  | { ok: false; error: string };

function valueKindOf(v: unknown): VtJsonValueKind {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "boolean") return "boolean";
  if (t === "number") return "number";
  if (t === "string") return "string";
  if (t === "object") return "object";
  return "other";
}

function noteForEntry(key: string, value: unknown): VtJsonKeyRow["noteKey"] {
  const isSha = /^[a-f0-9]{64}$/i.test(key);
  if (isSha && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (o._fluxtrace && typeof o._fluxtrace === "object") return "fluxtraceUnifiedEntry";
    if ("data" in o) return "vtMitreHashMap";
    return "nestedObject";
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return "nestedObject";
  }
  return "none";
}

/**
 * Resumo leve da raiz do JSON para tabelas de pré-visualização (sem valores volumosos).
 */
export function summarizeVtJsonForUi(parsed: unknown, maxKeys = 48): VtJsonLoadedSummary {
  try {
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rec = parsed as Record<string, unknown>;
      const keys = Object.keys(rec);
      const shaKeys = listExportRootShaKeys(parsed);
      const isVtMitre = isBehaviourMitreTreesByHashExport(parsed);
      const slice = keys.slice(0, maxKeys);
      const keyRows: VtJsonKeyRow[] = slice.map((key) => {
        const value = rec[key];
        return {
          key,
          valueKind: valueKindOf(value),
          noteKey: noteForEntry(key, value),
        };
      });
      const truncated = keys.length > maxKeys;
      const truncatedOmitted = truncated ? keys.length - maxKeys : 0;
      return {
        ok: true,
        root: "object",
        primaryCount: keys.length,
        sha256LikeKeyCount: shaKeys.length,
        isVtMitreHashMap: isVtMitre,
        keyRows,
        truncated,
        truncatedOmitted,
      };
    }
    if (Array.isArray(parsed)) {
      const n = parsed.length;
      const first = parsed[0];
      return {
        ok: true,
        root: "array",
        primaryCount: n,
        sha256LikeKeyCount: 0,
        isVtMitreHashMap: false,
        keyRows: [
          {
            key: n === 0 ? "(array vazio)" : `[0]${n > 1 ? ` … [${n - 1}] (${n} itens)` : ""}`,
            valueKind: n === 0 ? "undefined" : valueKindOf(first),
            noteKey: "none",
          },
        ],
        truncated: false,
        truncatedOmitted: 0,
      };
    }
    return {
      ok: true,
      root: "other",
      primaryCount: 0,
      sha256LikeKeyCount: 0,
      isVtMitreHashMap: false,
      keyRows: [],
      truncated: false,
      truncatedOmitted: 0,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
