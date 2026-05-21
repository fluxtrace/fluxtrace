import type { TFunction } from "i18next";
import type { UnifiedMitreCompareViewModel } from "@shared/virusTotal/unifiedMitreCompareViewModel";
import * as XLSX from "xlsx";
import { unifiedMitreVtApiLine } from "./unifiedMitreVtApiLine";

type Ta0005View = Extract<UnifiedMitreCompareViewModel, { kind: "ta0005_map" }>;

const CSV_SEP = ";";
const BOM = "\uFEFF";

function csvEscapeCell(value: string): string {
  const needsQuote = /[";\r\n]/.test(value);
  const inner = value.replace(/"/g, '""');
  return needsQuote ? `"${inner}"` : inner;
}

function csvRow(cells: string[]): string {
  return cells.map(csvEscapeCell).join(CSV_SEP);
}

function joinTech(ids: string[]): string {
  return ids.join("; ");
}

export function downloadUnifiedMitreCompareCsv(view: Ta0005View, t: TFunction): void {
  const s = view.summary;
  const lines: string[] = [];

  lines.push(csvRow([t("vtJsonCompare.unifiedExportMetricCol"), t("vtJsonCompare.unifiedExportValueCol")]));
  lines.push(csvRow([t("vtJsonCompare.unifiedExportMetricImported"), String(s.hashesImported)]));
  lines.push(csvRow([t("vtJsonCompare.unifiedExportMetricFlux"), String(s.hashesFluxtrace)]));
  lines.push(csvRow([t("vtJsonCompare.unifiedExportMetricIntersection"), String(s.intersection)]));
  lines.push(csvRow([t("vtJsonCompare.unifiedExportMetricOnlyImported"), String(s.onlyImported)]));
  lines.push(csvRow([t("vtJsonCompare.unifiedExportMetricOnlyFlux"), String(s.onlyFluxtrace)]));
  lines.push("");
  lines.push(
    csvRow([
      "sha256",
      t("vtJsonCompare.unifiedExportColSample"),
      t("vtJsonCompare.unifiedExportColBatch"),
      t("vtJsonCompare.unifiedExportColSandboxes"),
      t("vtJsonCompare.unifiedExportColTa0005Export"),
      t("vtJsonCompare.unifiedExportColTa0005Flux"),
      t("vtJsonCompare.unifiedExportColInBoth"),
      t("vtJsonCompare.unifiedExportColOnlyExport"),
      t("vtJsonCompare.unifiedExportColOnlyFlux"),
      t("vtJsonCompare.unifiedExportColVtApi"),
    ]),
  );
  for (const h of view.perHash) {
    lines.push(
      csvRow([
        h.sha,
        h.sampleName,
        h.batchId,
        joinTech(h.sandboxes),
        joinTech(h.exportVtTa0005),
        joinTech(h.fluxTa0005),
        joinTech(h.inBoth),
        joinTech(h.onlyExportVt),
        joinTech(h.onlyFluxtrace),
        unifiedMitreVtApiLine(h.virusTotalFileReport, t),
      ]),
    );
  }

  if (view.onlyImportedRows.length > 0) {
    lines.push("");
    lines.push(csvRow(["sha256", t("vtJsonCompare.unifiedExportColTa0005Export")]));
    for (const r of view.onlyImportedRows) {
      lines.push(csvRow([r.sha, joinTech(r.exportVtTa0005)]));
    }
  }

  if (view.onlyFluxtraceRows.length > 0) {
    lines.push("");
    lines.push(csvRow(["sha256", t("vtJsonCompare.unifiedExportColSample"), t("vtJsonCompare.unifiedExportColTa0005Flux")]));
    for (const r of view.onlyFluxtraceRows) {
      lines.push(csvRow([r.sha, r.sampleName, joinTech(r.fluxTa0005)]));
    }
  }

  const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `mitre-ta0005-unificado-${stamp}.csv`);
}

export function downloadUnifiedMitreCompareXlsx(view: Ta0005View, t: TFunction): void {
  const s = view.summary;
  const wb = XLSX.utils.book_new();

  const resumoRows: (string | number)[][] = [
    [t("vtJsonCompare.unifiedExportMetricCol"), t("vtJsonCompare.unifiedExportValueCol")],
    [t("vtJsonCompare.unifiedExportMetricImported"), s.hashesImported],
    [t("vtJsonCompare.unifiedExportMetricFlux"), s.hashesFluxtrace],
    [t("vtJsonCompare.unifiedExportMetricIntersection"), s.intersection],
    [t("vtJsonCompare.unifiedExportMetricOnlyImported"), s.onlyImported],
    [t("vtJsonCompare.unifiedExportMetricOnlyFlux"), s.onlyFluxtrace],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoRows), t("vtJsonCompare.unifiedResultSummaryTitle").slice(0, 31));

  const hashHeader = [
    "sha256",
    t("vtJsonCompare.unifiedExportColSample"),
    t("vtJsonCompare.unifiedExportColBatch"),
    t("vtJsonCompare.unifiedExportColSandboxes"),
    t("vtJsonCompare.unifiedExportColTa0005Export"),
    t("vtJsonCompare.unifiedExportColTa0005Flux"),
    t("vtJsonCompare.unifiedExportColInBoth"),
    t("vtJsonCompare.unifiedExportColOnlyExport"),
    t("vtJsonCompare.unifiedExportColOnlyFlux"),
    t("vtJsonCompare.unifiedExportColVtApi"),
  ];
  const hashRows = view.perHash.map((h) => [
    h.sha,
    h.sampleName,
    h.batchId,
    joinTech(h.sandboxes),
    joinTech(h.exportVtTa0005),
    joinTech(h.fluxTa0005),
    joinTech(h.inBoth),
    joinTech(h.onlyExportVt),
    joinTech(h.onlyFluxtrace),
    unifiedMitreVtApiLine(h.virusTotalFileReport, t),
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([hashHeader, ...hashRows]),
    t("vtJsonCompare.unifiedExportSheetPerHash").slice(0, 31),
  );

  if (view.onlyImportedRows.length > 0) {
    const hOnly = ["sha256", t("vtJsonCompare.unifiedExportColTa0005Export")];
    const rows = view.onlyImportedRows.map((r) => [r.sha, joinTech(r.exportVtTa0005)]);
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([hOnly, ...rows]),
      t("vtJsonCompare.unifiedExportSheetOnlyImported").slice(0, 31),
    );
  }

  if (view.onlyFluxtraceRows.length > 0) {
    const hOnly = ["sha256", t("vtJsonCompare.unifiedExportColSample"), t("vtJsonCompare.unifiedExportColTa0005Flux")];
    const rows = view.onlyFluxtraceRows.map((r) => [r.sha, r.sampleName, joinTech(r.fluxTa0005)]);
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([hOnly, ...rows]),
      t("vtJsonCompare.unifiedExportSheetOnlyFlux").slice(0, 31),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `mitre-ta0005-unificado-${stamp}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
