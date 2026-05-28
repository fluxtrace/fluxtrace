import * as XLSX_Module from "xlsx";

import { getAnalysisBatchByBatchId } from "../../models/db";
import { getAnalysisBatchDetail } from "../analysis/analysisService";
import { normalizeOptionalSampleSha256 } from "../../shared/virusTotal";
import { fluxDefenseEvasionCanonAndNames } from "../../shared/virusTotal/vtBehaviourMitreExport";
import { virusTotalFetchBehaviourMitreTrees } from "./virusTotalLookup";
import { resolveBatchIdsForUnifiedExport } from "./fluxtraceUnifiedMitreExport";

const VT_INTER_REQUEST_DELAY_MS = 150;

/** SheetJS (xlsx) sob ESM: mesma resolução que `legacyArtifactsRouter`. */
function xl(): typeof import("xlsx") {
  type X = typeof import("xlsx");
  const top = XLSX_Module as unknown as X;
  const d = (XLSX_Module as unknown as { default?: X }).default;
  const resolved =
    typeof top.read === "function"
      ? top
      : d && typeof d.read === "function"
        ? d
        : top.utils && typeof top.write === "function"
          ? top
          : d && d.utils && typeof d.write === "function"
            ? d
            : null;
  if (!resolved || !resolved.utils || typeof resolved.write !== "function") {
    throw new Error(
      "[mitreFluxtraceVtXlsx] Biblioteca «xlsx» não carregou correctamente neste servidor (interop ESM/CommonJS).",
    );
  }
  return resolved;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sortMitreTechniqueIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

function normalizeMitreUpper(id: string): string {
  return id.trim().toUpperCase();
}

function mitreCanonDisplay(
  canonId: string,
  fluxNames: Map<string, string>,
  vtNames: Map<string, string>,
  preferVtNames: boolean,
): string {
  const u = normalizeMitreUpper(canonId);
  const nm = preferVtNames ? (vtNames.get(u) ?? fluxNames.get(u)) : (fluxNames.get(u) ?? vtNames.get(u));
  return nm ? `${canonId} (${nm})` : canonId;
}

function joinMitreTechniquesDisplays(
  canonIdsSorted: string[],
  fluxNames: Map<string, string>,
  vtNames: Map<string, string>,
  preferVtNames: boolean,
): string {
  if (canonIdsSorted.length === 0) return "";
  return canonIdsSorted
    .map((id) => mitreCanonDisplay(id, fluxNames, vtNames, preferVtNames))
    .join("; ");
}

function pctNumberForChart(n: number, unionSize: number): number | "" {
  if (unionSize === 0) return "";
  return Math.round((n / unionSize) * 1000) / 10;
}

function formatPercentAndTechniqueLine(
  pctLabel: string,
  canonIdsSorted: string[],
  fluxNames: Map<string, string>,
  vtNames: Map<string, string>,
  preferVtNames: boolean,
): string {
  if (!pctLabel) return "";
  const lineTech = joinMitreTechniquesDisplays(canonIdsSorted, fluxNames, vtNames, preferVtNames);
  return lineTech.length > 0 ? `${pctLabel}\n${lineTech}` : pctLabel;
}

export type ComparativeBcSlice = {
  /** Percentual + segunda linha `ID (nome)` por técnica. */
  cellText: string;
  pctForChart: number | "";
  /** IDs canónicos ordenados (iguais nas células quando sem nome). */
  techniqueIdsSorted: string[];
};

export type ComparativeBreakdownBc = {
  match: ComparativeBcSlice;
  onlyFlux: ComparativeBcSlice;
  onlyVt: ComparativeBcSlice;
};

/**
 * Compara B (Flux TA0005) × C (TA0005 VT): percentuais sobre |B∪C| com rótulos explícitos nas listas.
 */
export function comparativeBreakdownFromBcIdLists(params: {
  fluxCanonSorted: string[];
  vtTa0005CanonSorted: string[];
  fluxNameByUpper: Map<string, string>;
  vtNameByUpper: Map<string, string>;
}): ComparativeBreakdownBc {
  const fluxCanonByUpper = new Map(params.fluxCanonSorted.map((id) => [normalizeMitreUpper(id), id]));
  const vtCanonByUpper = new Map(params.vtTa0005CanonSorted.map((id) => [normalizeMitreUpper(id), id]));

  const fluxU = new Set(fluxCanonByUpper.keys());
  const vtU = new Set(vtCanonByUpper.keys());
  const unionU = new Set<string>([...fluxU, ...vtU]);
  const u = unionU.size;

  const emptySlice = (): ComparativeBcSlice => ({
    cellText: "",
    pctForChart: "",
    techniqueIdsSorted: [],
  });

  const { fluxNameByUpper, vtNameByUpper } = params;

  if (u === 0) {
    return { match: emptySlice(), onlyFlux: emptySlice(), onlyVt: emptySlice() };
  }

  const matchU = sortMitreTechniqueIds([...fluxU].filter((id) => vtU.has(id)));
  const matchCanon = matchU.map((id) => fluxCanonByUpper.get(id)!);

  const onlyFluxU = sortMitreTechniqueIds([...fluxU].filter((id) => !vtU.has(id)));
  const onlyFluxCanon = onlyFluxU.map((id) => fluxCanonByUpper.get(id)!);

  const onlyVtU = sortMitreTechniqueIds([...vtU].filter((id) => !fluxU.has(id)));
  const onlyVtCanon = onlyVtU.map((id) => vtCanonByUpper.get(id)!);

  const inter = matchCanon.length;
  const nFlux = onlyFluxCanon.length;
  const nVt = onlyVtCanon.length;

  const pctLabel = (n: number) => `${((n / u) * 100).toFixed(1)}%`;

  return {
    match: {
      techniqueIdsSorted: matchCanon,
      pctForChart: pctNumberForChart(inter, u),
      // Intersecção: alinhar com col. B (`fluxtrace_mitre_TA0005`): nome Flux primeiro, fallback VT.
      cellText: formatPercentAndTechniqueLine(pctLabel(inter), matchCanon, fluxNameByUpper, vtNameByUpper, false),
    },
    onlyFlux: {
      techniqueIdsSorted: onlyFluxCanon,
      pctForChart: pctNumberForChart(nFlux, u),
      cellText: formatPercentAndTechniqueLine(
        pctLabel(nFlux),
        onlyFluxCanon,
        fluxNameByUpper,
        vtNameByUpper,
        false,
      ),
    },
    onlyVt: {
      techniqueIdsSorted: onlyVtCanon,
      pctForChart: pctNumberForChart(nVt, u),
      cellText: formatPercentAndTechniqueLine(pctLabel(nVt), onlyVtCanon, fluxNameByUpper, vtNameByUpper, true),
    },
  };
}

export type MitreFluxtraceVsVtExportMeta = {
  exportedAt: string;
  rowsWritten: number;
  skippedNoHash: number;
  skippedNotCompleted: number;
  skippedNoDetail: number;
  vtUnavailableNoKey: boolean;
  vtOkRows: number;
  vtFailedRows: number;
};

export type MitreFluxtraceVsVtXlsxResult = {
  /** Workbook `.xlsx` codificado em Base64: folhas `Comparativo` (7 cols) + `Grafico` (dados p/ barras empilhadas). */
  xlsxBase64: string;
  meta: MitreFluxtraceVsVtExportMeta;
};

const HEADERS = [
  "sha256_amostra",
  "fluxtrace_mitre_TA0005",
  "TA0005 Virus Total",
  "virustotal_behaviour_mitre",
  "Match",
  "Apenas FluxTrace",
  "Apenas Virus Total",
] as const;
const SHEET_NAME = "Comparativo";
/** Dados numéricos B×C para o utilizador criar barras empilhadas 100 % no Excel (SheetJS OSS não inclui drawings). */
const SHEET_CHART_DATA = "Grafico";

/**
 * Planilha **Comparativo** (7 cols): A–D com `ID (nome)`; E–G com % e segunda linha com as mesmas listas etiquetadas.
 */
export async function buildMitreFluxtraceVsVtTableXlsx(params: {
  apiKey: string | null;
  batchIds: string[];
}): Promise<MitreFluxtraceVsVtXlsxResult> {
  const chartDataRows: (string | number)[][] = [
    ["sha256_amostra", "Match (%)", "Apenas FluxTrace (%)", "Apenas Virus Total (%)"],
  ];

  const meta: MitreFluxtraceVsVtExportMeta = {
    exportedAt: new Date().toISOString(),
    rowsWritten: 0,
    skippedNoHash: 0,
    skippedNotCompleted: 0,
    skippedNoDetail: 0,
    vtUnavailableNoKey: !(params.apiKey && params.apiKey.trim().length > 0),
    vtOkRows: 0,
    vtFailedRows: 0,
  };

  const rows: string[][] = [HEADERS.slice() as string[]];

  const apiKey = params.apiKey?.trim() ?? "";
  let vtCallIndex = 0;

  const emptyNameMap = new Map<string, string>();

  for (const batchId of params.batchIds) {
    const row = await getAnalysisBatchByBatchId(batchId);
    if (!row) {
      meta.skippedNoDetail += 1;
      continue;
    }
    if (row.status !== "completed") {
      meta.skippedNotCompleted += 1;
      continue;
    }

    const sha = normalizeOptionalSampleSha256(row.sampleSha256 ?? "");
    if (!sha) {
      meta.skippedNoHash += 1;
      continue;
    }

    const detail = await getAnalysisBatchDetail(batchId, { includeServerProcess: false });
    if (!detail) {
      meta.skippedNoDetail += 1;
      continue;
    }

    const fluxMeta = fluxDefenseEvasionCanonAndNames(detail.mitreDefenseEvasion);
    const vtNames = new Map<string, string>();
    let colVtTa0005Canon: string[] = [];
    let colVtAllCanon: string[] = [];

    if (!apiKey) {
      meta.vtFailedRows += 1;
    } else {
      if (vtCallIndex > 0) {
        await sleep(VT_INTER_REQUEST_DELAY_MS);
      }
      vtCallIndex += 1;
      const trees = await virusTotalFetchBehaviourMitreTrees(apiKey, sha);
      if (trees.ok) {
        meta.vtOkRows += 1;
        for (const [k, v] of trees.vtTechniqueNameByUpper.entries()) vtNames.set(k, v);
        colVtTa0005Canon = trees.ta0005TechniqueIds;
        colVtAllCanon = trees.techniqueIds;
      } else {
        meta.vtFailedRows += 1;
      }
    }

    const colB =
      fluxMeta.canonIdsSorted.length > 0
        ? joinMitreTechniquesDisplays(fluxMeta.canonIdsSorted, fluxMeta.nameByUpper, vtNames, false)
        : "";
    const colC =
      colVtTa0005Canon.length > 0
        ? joinMitreTechniquesDisplays(colVtTa0005Canon, fluxMeta.nameByUpper, vtNames, true)
        : "";
    const colD =
      colVtAllCanon.length > 0
        ? joinMitreTechniquesDisplays(colVtAllCanon, fluxMeta.nameByUpper, vtNames, true)
        : "";

    const bd = comparativeBreakdownFromBcIdLists({
      fluxCanonSorted: fluxMeta.canonIdsSorted,
      vtTa0005CanonSorted: colVtTa0005Canon,
      fluxNameByUpper: fluxMeta.nameByUpper,
      vtNameByUpper: vtNames.size > 0 ? vtNames : emptyNameMap,
    });

    rows.push([sha, colB, colC, colD, bd.match.cellText, bd.onlyFlux.cellText, bd.onlyVt.cellText]);
    chartDataRows.push([sha, bd.match.pctForChart, bd.onlyFlux.pctForChart, bd.onlyVt.pctForChart]);
    meta.rowsWritten += 1;
  }

  const X = xl();
  const wb = X.utils.book_new();
  const ws = X.utils.aoa_to_sheet(rows);
  X.utils.book_append_sheet(wb, ws, SHEET_NAME);
  const wsChart = X.utils.aoa_to_sheet(chartDataRows);
  X.utils.book_append_sheet(wb, wsChart, SHEET_CHART_DATA);
  const buf = X.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;

  return { xlsxBase64: buf.toString("base64"), meta };
}

export async function buildMitreFluxtraceVsVtTableXlsxForUserScope(params: {
  userId: number;
  isGlobalScope: boolean;
  batchIdsFilter?: string[];
  maxBatches: number;
  apiKey: string | null;
}): Promise<MitreFluxtraceVsVtXlsxResult> {
  const batchIds = await resolveBatchIdsForUnifiedExport({
    userId: params.userId,
    isGlobalScope: params.isGlobalScope,
    batchIdsFilter: params.batchIdsFilter,
    maxBatches: params.maxBatches,
    ...(params.batchIdsFilter?.length ? {} : { listStatus: ["completed"] }),
  });
  return buildMitreFluxtraceVsVtTableXlsx({ apiKey: params.apiKey, batchIds });
}
