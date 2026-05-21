import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  downloadUnifiedMitreCompareCsv,
  downloadUnifiedMitreCompareXlsx,
} from "@/lib/virus-total/unifiedMitreCompareExport";
import { unifiedMitreVtApiLine } from "@/lib/virus-total/unifiedMitreVtApiLine";
import type { UnifiedMitreCompareViewModel } from "@shared/virusTotal/unifiedMitreCompareViewModel";
import { FileSpreadsheet, Table } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

type Ta0005View = Extract<UnifiedMitreCompareViewModel, { kind: "ta0005_map" }>;

function techniqueClass(variant: "export" | "flux" | "both"): string {
  switch (variant) {
    case "export":
      return "border-blue-500/45 bg-blue-500/[0.12] text-blue-800 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-200";
    case "flux":
      return "border-emerald-500/45 bg-emerald-500/[0.12] text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200";
    case "both":
    default:
      return "border-border/80 bg-muted/40 text-foreground dark:border-white/15";
  }
}

function TechniqueChips({ ids, variant }: { ids: string[]; variant: "export" | "flux" | "both" }) {
  if (!ids.length) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <Badge
          key={id}
          variant="outline"
          className={`font-mono text-xs font-normal ${techniqueClass(variant)}`}
        >
          {id}
        </Badge>
      ))}
    </div>
  );
}

export function UnifiedMitreCompareResult(props: { view: Ta0005View; llmText: string | null }) {
  const { view, llmText } = props;
  const { t } = useTranslation();
  const s = view.summary;

  function handleExportCsv() {
    downloadUnifiedMitreCompareCsv(view, t);
    toast.success(t("vtJsonCompare.unifiedExportToastCsv"));
  }

  function handleExportXlsx() {
    downloadUnifiedMitreCompareXlsx(view, t);
    toast.success(t("vtJsonCompare.unifiedExportToastXlsx"));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/70 bg-muted/20 p-4 dark:border-white/10">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="text-sm font-medium text-foreground">{t("vtJsonCompare.unifiedResultSummaryTitle")}</h3>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleExportCsv}
              aria-label={t("vtJsonCompare.unifiedExportCsvAria")}
            >
              <Table className="size-3.5" aria-hidden />
              {t("vtJsonCompare.unifiedExportCsv")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleExportXlsx}
              aria-label={t("vtJsonCompare.unifiedExportXlsxAria")}
            >
              <FileSpreadsheet className="size-3.5" aria-hidden />
              {t("vtJsonCompare.unifiedExportXlsx")}
            </Button>
          </div>
        </div>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>{t("vtJsonCompare.unifiedResultSummaryImported", { n: s.hashesImported })}</li>
          <li>{t("vtJsonCompare.unifiedResultSummaryFlux", { n: s.hashesFluxtrace })}</li>
          <li>{t("vtJsonCompare.unifiedResultSummaryIntersection", { n: s.intersection })}</li>
          <li>{t("vtJsonCompare.unifiedResultSummaryOnlyImported", { n: s.onlyImported })}</li>
          <li>{t("vtJsonCompare.unifiedResultSummaryOnlyFlux", { n: s.onlyFluxtrace })}</li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("vtJsonCompare.unifiedResultIntro")}</p>
      </div>

      {view.onlyImportedRows.length > 0 ? (
        <div className="space-y-2">
          <h3 className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-800 dark:border-blue-400/35 dark:bg-blue-500/15 dark:text-blue-200">
            {t("vtJsonCompare.unifiedResultOnlyImportedTitle")}
          </h3>
          <ul className="space-y-2 text-sm">
            {view.onlyImportedRows.map((row) => (
              <li
                key={row.sha}
                className="rounded-md border border-blue-500/30 bg-blue-500/[0.06] px-3 py-2 dark:border-blue-400/25 dark:bg-blue-500/10"
              >
                <code className="break-all text-xs text-blue-900 dark:text-blue-100">{row.sha}</code>
                <div className="mt-2">
                  <span className="text-xs text-blue-800/90 dark:text-blue-200/90">
                    {t("vtJsonCompare.unifiedResultTa0005LabelExport")}
                  </span>
                  <div className="mt-1">
                    <TechniqueChips ids={row.exportVtTa0005} variant="export" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view.onlyFluxtraceRows.length > 0 ? (
        <div className="space-y-2">
          <h3 className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-500/15 dark:text-emerald-200">
            {t("vtJsonCompare.unifiedResultOnlyFluxTitle")}
          </h3>
          <ul className="space-y-2 text-sm">
            {view.onlyFluxtraceRows.map((row) => (
              <li
                key={row.sha}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 dark:border-emerald-400/25 dark:bg-emerald-500/10"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <code className="break-all text-xs text-emerald-900 dark:text-emerald-100">{row.sha}</code>
                  <span className="text-xs text-emerald-800/80 dark:text-emerald-200/80">{row.sampleName}</span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-emerald-800/90 dark:text-emerald-200/90">
                    {t("vtJsonCompare.unifiedResultTa0005LabelFlux")}
                  </span>
                  <div className="mt-1">
                    <TechniqueChips ids={row.fluxTa0005} variant="flux" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view.perHash.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{t("vtJsonCompare.unifiedResultPerHashTitle")}</h3>
          {view.perHash.map((h) => (
            <Card
              key={h.sha}
              className="overflow-hidden border-border/80 shadow-sm dark:border-white/12"
            >
              <CardHeader className="space-y-1 border-b border-border/60 bg-muted/30 pb-3 dark:border-white/10 dark:bg-slate-950/40">
                <CardTitle className="break-all font-mono text-sm font-medium leading-snug text-foreground">
                  {h.sha}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  <span className="text-emerald-700 dark:text-emerald-400">{t("vtJsonCompare.unifiedResultSampleFlux")}:</span>{" "}
                  <span className="text-foreground">{h.sampleName}</span>
                  {" · "}
                  <span className="font-mono text-foreground">{h.batchId}</span>
                </p>
                <p className="text-xs">
                  <span className="text-blue-700 dark:text-blue-400">{t("vtJsonCompare.unifiedResultSandboxesExport")}:</span>{" "}
                  <span className="text-blue-900/90 dark:text-blue-100/90">
                    {h.sandboxes.length ? h.sandboxes.join(", ") : "—"}
                  </span>
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                    {t("vtJsonCompare.unifiedResultTa0005ExportFull")}
                  </p>
                  <TechniqueChips ids={h.exportVtTa0005} variant="export" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {t("vtJsonCompare.unifiedResultTa0005FluxFull")}
                  </p>
                  <TechniqueChips ids={h.fluxTa0005} variant="flux" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("vtJsonCompare.unifiedResultInBoth")}</p>
                  <TechniqueChips ids={h.inBoth} variant="both" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-blue-500/25 bg-blue-500/[0.04] p-3 dark:border-blue-400/20">
                    <p className="mb-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                      {t("vtJsonCompare.unifiedResultOnlyExportVt")}
                    </p>
                    <TechniqueChips ids={h.onlyExportVt} variant="export" />
                  </div>
                  <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.04] p-3 dark:border-emerald-400/20">
                    <p className="mb-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {t("vtJsonCompare.unifiedResultOnlyFluxtrace")}
                    </p>
                    <TechniqueChips ids={h.onlyFluxtrace} variant="flux" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{t("vtJsonCompare.unifiedResultVtApi")}:</span>{" "}
                  {unifiedMitreVtApiLine(h.virusTotalFileReport, t)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {llmText ? (
        <div className="rounded-lg border border-border/70 bg-muted/15 p-4 dark:border-white/10">
          <h3 className="mb-2 text-sm font-medium text-foreground">{t("vtJsonCompare.unifiedResultLlmTitle")}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{t("vtJsonCompare.unifiedResultLlmNote")}</p>
          <div className="prose max-w-none text-foreground dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground dark:prose-headings:text-white dark:prose-p:text-muted-foreground prose-table:text-sm">
            <Streamdown>{llmText}</Streamdown>
          </div>
        </div>
      ) : null}
    </div>
  );
}
