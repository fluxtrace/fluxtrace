import DashboardLayout from "@/components/layout/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UnifiedMitreCompareResult } from "@/components/analysis/UnifiedMitreCompareResult";
import { trpc } from "@/lib/api/trpc";
import {
  persistVtJsonCompareBatchId,
  readVtJsonCompareBatchId,
} from "@/lib/vtJsonCompareSession";
import type { VtJsonKeyRow } from "@shared/virusTotal/vtJsonExternalSummary";
import { summarizeVtJsonForUi } from "@shared/virusTotal/vtJsonExternalSummary";
import type { UnifiedMitreCompareViewModel } from "@shared/virusTotal/unifiedMitreCompareViewModel";
import { VT_COMPARE_EXTERNAL_JSON_MAX_CHARS } from "@shared/virusTotal/vtJsonCompareLimits";
import { AlertTriangle, ArrowRight, Database, FileJson } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const MAX_MB_HINT = Math.round(VT_COMPARE_EXTERNAL_JSON_MAX_CHARS / 1_000_000);

function VtJsonCompareContent() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(readVtJsonCompareBatchId);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [jsonText, setJsonText] = useState<string | null>(null);
  const [oversizeChars, setOversizeChars] = useState<number | null>(null);
  const [resultMarkdown, setResultMarkdown] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<"single" | "unified" | null>(null);
  const [unifiedComparisonView, setUnifiedComparisonView] = useState<
    Extract<UnifiedMitreCompareViewModel, { kind: "ta0005_map" }> | null
  >(null);
  const [unifiedLlmText, setUnifiedLlmText] = useState<string | null>(null);
  const [unifiedMaxBatches, setUnifiedMaxBatches] = useState(25);
  const [includeLlm, setIncludeLlm] = useState(false);
  /** Passo 3: utilizador associou explicitamente o agregado do servidor à comparação unificada (sem depender do nome do ficheiro externo como “segundo ficheiro”). */
  const [unifiedAggregateReady, setUnifiedAggregateReady] = useState(false);
  const [unifiedPreviewHashCount, setUnifiedPreviewHashCount] = useState<number | null>(null);
  const [unifiedBindLoading, setUnifiedBindLoading] = useState(false);

  const utils = trpc.useUtils();
  const batchesQuery = trpc.analysis.list.useQuery({ limit: 50 }, { refetchInterval: 5000 });

  const batchesRecentFirst = useMemo(() => {
    const rows = batchesQuery.data ?? [];
    return [...rows].sort((a, b) => {
      const ub = new Date(b.updatedAt).getTime();
      const ua = new Date(a.updatedAt).getTime();
      if (!Number.isFinite(ua) || !Number.isFinite(ub)) return 0;
      if (ub !== ua) return ub - ua;
      const cb = new Date(b.createdAt).getTime();
      const ca = new Date(a.createdAt).getTime();
      return cb - ca;
    });
  }, [batchesQuery.data]);

  /** Migração: links antigos com `?batch=` — guarda no sessionStorage e remove da barra de endereços. */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (u.pathname !== "/analisar-json-vt" || !u.search) return;
    const fromUrl = u.searchParams.get("batch")?.trim();
    if (fromUrl) {
      persistVtJsonCompareBatchId(fromUrl);
      setSelectedBatchId(fromUrl);
    }
    setLocation("/analisar-json-vt", { replace: true });
  }, [setLocation]);

  /** Garante lote válido quando a lista carrega. */
  useEffect(() => {
    if (!batchesRecentFirst.length) return;
    const valid = new Set(batchesRecentFirst.map((b) => b.batchId));
    if (selectedBatchId && valid.has(selectedBatchId)) return;
    const fallback = batchesRecentFirst[0]!.batchId;
    setSelectedBatchId(fallback);
    persistVtJsonCompareBatchId(fallback);
  }, [batchesRecentFirst, selectedBatchId]);

  useEffect(() => {
    setUnifiedAggregateReady(false);
    setUnifiedPreviewHashCount(null);
  }, [unifiedMaxBatches]);

  const selectedRow = useMemo(
    () => batchesRecentFirst.find((b) => b.batchId === selectedBatchId) ?? null,
    [batchesRecentFirst, selectedBatchId],
  );

  const jsonPreview = useMemo(() => {
    if (!jsonText?.trim()) return { kind: "empty" as const };
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      const summary = summarizeVtJsonForUi(parsed);
      return { kind: "ok" as const, summary };
    } catch {
      return { kind: "invalid" as const };
    }
  }, [jsonText]);

  const compareMut = trpc.analysis.compareVtJsonExport.useMutation({
    onSuccess: (data) => {
      if (!data.ok) {
        toast.error(data.message);
        setResultMarkdown(null);
        setResultMode(null);
        setUnifiedComparisonView(null);
        setUnifiedLlmText(null);
        return;
      }
      setUnifiedComparisonView(null);
      setUnifiedLlmText(null);
      setResultMarkdown(data.summaryMarkdown);
      setResultMode("single");
    },
    onError: (err) => {
      toast.error(err.message || t("vtJsonCompare.parseFail"));
      setResultMarkdown(null);
      setResultMode(null);
      setUnifiedComparisonView(null);
      setUnifiedLlmText(null);
    },
  });

  const mitreXlsxMut = trpc.analysis.mitreFluxtraceVsVtTableXlsxExport.useMutation();

  const unifiedCompareMut = trpc.analysis.compareUnifiedVtMitreExport.useMutation({
    onSuccess: (data) => {
      if (!data.ok) {
        toast.error(data.message);
        setResultMarkdown(null);
        setResultMode(null);
        setUnifiedComparisonView(null);
        setUnifiedLlmText(null);
        return;
      }
      setResultMarkdown(null);
      setUnifiedComparisonView(data.comparisonView);
      setUnifiedLlmText(data.llmInterpretation);
      setResultMode("unified");
    },
    onError: (err) => {
      toast.error(err.message || t("vtJsonCompare.parseFail"));
      setResultMarkdown(null);
      setResultMode(null);
      setUnifiedComparisonView(null);
      setUnifiedLlmText(null);
    },
  });

  const canSendToApi = Boolean(jsonText?.trim() && jsonPreview.kind === "ok");

  function formatNoteKey(note: VtJsonKeyRow["noteKey"]): string {
    switch (note) {
      case "vtMitreHashMap":
        return t("vtJsonCompare.formatNoteVtMitre");
      case "fluxtraceUnifiedEntry":
        return t("vtJsonCompare.formatNoteFluxUnified");
      case "nestedObject":
        return t("vtJsonCompare.formatNoteNested");
      default:
        return t("vtJsonCompare.formatNoteNone");
    }
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFileName(f.name);
    setFileSizeBytes(f.size);
    setOversizeChars(null);
    setResultMarkdown(null);
    setResultMode(null);
    setUnifiedComparisonView(null);
    setUnifiedLlmText(null);
    setUnifiedAggregateReady(false);
    setUnifiedPreviewHashCount(null);
    try {
      const text = await f.text();
      if (text.length > VT_COMPARE_EXTERNAL_JSON_MAX_CHARS) {
        setJsonText(null);
        setOversizeChars(text.length);
        toast.error(
          t("vtJsonCompare.tooLarge", {
            maxMb: MAX_MB_HINT,
          }),
        );
        return;
      }
      setJsonText(text);
    } catch {
      toast.error(t("vtJsonCompare.parseFail"));
      setJsonText(null);
      setFileName(null);
      setFileSizeBytes(null);
    }
  }

  function clearFile() {
    setFileName(null);
    setFileSizeBytes(null);
    setJsonText(null);
    setOversizeChars(null);
    setResultMarkdown(null);
    setResultMode(null);
    setUnifiedComparisonView(null);
    setUnifiedLlmText(null);
    setUnifiedAggregateReady(false);
    setUnifiedPreviewHashCount(null);
  }

  function runCompare() {
    if (!selectedBatchId) {
      toast.error(t("vtJsonCompare.needBatch"));
      return;
    }
    if (!canSendToApi) {
      toast.error(t("vtJsonCompare.noFile"));
      return;
    }
    compareMut.mutate({ batchId: selectedBatchId, externalJson: jsonText! });
  }

  function runUnifiedCompare() {
    if (!canSendToApi) {
      toast.error(t("vtJsonCompare.unifiedNoFile"));
      return;
    }
    if (!unifiedAggregateReady) {
      toast.error(t("vtJsonCompare.unifiedNeedBind"));
      return;
    }
    unifiedCompareMut.mutate({
      externalJson: jsonText!,
      includeLlmInterpretation: includeLlm,
      maxBatches: unifiedMaxBatches,
    });
  }

  async function downloadMitreFluxVsVtXlsx() {
    try {
      const data = await mitreXlsxMut.mutateAsync({
        maxBatches: unifiedMaxBatches,
      });
      const bytes = Uint8Array.from(atob(data.xlsxBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fluxtrace-mitre-flux-vs-vt-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (data.meta.rowsWritten === 0) {
        toast.warning(t("vtJsonCompare.xlsxMitreFluxVsVtEmpty"));
      } else {
        toast.success(
          t("vtJsonCompare.xlsxMitreFluxVsVtOk", {
            rows: data.meta.rowsWritten,
            vtOk: data.meta.vtOkRows,
            vtFail: data.meta.vtFailedRows,
          }),
        );
      }
    } catch {
      toast.error(t("vtJsonCompare.xlsxMitreFluxVsVtFail"));
    }
  }

  async function downloadUnifiedJson() {
    try {
      const data = await utils.analysis.unifiedVtMitreFluxtraceExport.fetch({ maxBatches: unifiedMaxBatches });
      const blob = new Blob([JSON.stringify(data.bySha, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fluxtrace-unified-mitre-vt-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        `${t("vtJsonCompare.unifiedDownloadOk")} (${data.meta.included} ${t("vtJsonCompare.unifiedHashesIncluded")}).`,
      );
    } catch {
      toast.error(t("vtJsonCompare.unifiedDownloadFail"));
    }
  }

  async function bindUnifiedAggregateFromServer() {
    if (!canSendToApi) return;
    setUnifiedBindLoading(true);
    try {
      const data = await utils.analysis.unifiedVtMitreFluxtraceExport.fetch({ maxBatches: unifiedMaxBatches });
      setUnifiedPreviewHashCount(data.meta.included);
      setUnifiedAggregateReady(true);
      toast.success(
        t("vtJsonCompare.unifiedBindOk", {
          n: data.meta.included,
          maxBatches: unifiedMaxBatches,
        }),
      );
    } catch {
      toast.error(t("vtJsonCompare.unifiedBindFail"));
      setUnifiedAggregateReady(false);
      setUnifiedPreviewHashCount(null);
    } finally {
      setUnifiedBindLoading(false);
    }
  }

  const hasValidHash =
    Boolean(selectedRow?.sampleSha256) && /^[a-f0-9]{64}$/i.test(selectedRow!.sampleSha256!);
  const shaFull = hasValidHash ? selectedRow!.sampleSha256!.toLowerCase() : null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start gap-3">
        <FileJson className="mt-1 h-8 w-8 shrink-0 text-[var(--auth-brand)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{t("vtJsonCompare.title")}</h1>
          {t("vtJsonCompare.intro").trim() ? (
            <p className="mt-1 max-w-[80ch] text-sm leading-relaxed text-muted-foreground">{t("vtJsonCompare.intro")}</p>
          ) : null}
        </div>
      </div>

      <Card className="border-border/80 dark:border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("vtJsonCompare.uploadTitle")}</CardTitle>
          {t("vtJsonCompare.uploadDesc").trim() ? (
            <CardDescription>{t("vtJsonCompare.uploadDesc")}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="vt-json-file">{t("vtJsonCompare.pickFile")}</Label>
              <Input
                id="vt-json-file"
                type="file"
                accept=".json,application/json"
                className="max-w-md cursor-pointer border-border bg-background file:mr-3 dark:bg-slate-950/80"
                onChange={onPickFile}
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={clearFile}>
              {t("vtJsonCompare.clearFile")}
            </Button>
          </div>

          {oversizeChars != null && fileName ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>{t("vtJsonCompare.oversizeTitle")}</AlertTitle>
              <AlertDescription className="leading-relaxed">
                <p className="mt-1 font-medium">{fileName}</p>
                <p className="mt-2 text-sm leading-relaxed">
                  {t("vtJsonCompare.oversizeBody", {
                    actualMb: (oversizeChars / 1_000_000).toFixed(2),
                    actualChars: oversizeChars.toLocaleString(),
                    maxMb: MAX_MB_HINT,
                    maxChars: VT_COMPARE_EXTERNAL_JSON_MAX_CHARS.toLocaleString(),
                  })}
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          {fileName && jsonText != null && !oversizeChars ? (
            <div className="rounded-lg border border-border/70 bg-muted/25 p-4 dark:border-white/10 dark:bg-slate-950/50">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <h3 className="text-base font-medium text-foreground">{t("vtJsonCompare.loadedCardTitle")}</h3>
                <Badge variant="default" className="shrink-0 text-xs font-normal">
                  {t("vtJsonCompare.loadedInMemory")}
                </Badge>
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>
                    <span className="text-muted-foreground">{t("vtJsonCompare.compareFlowExternal")}: </span>
                    <span className="font-medium text-foreground">{fileName}</span>
                  </span>
                  {fileSizeBytes != null ? (
                    <span className="text-muted-foreground">
                      {t("vtJsonCompare.bytesShort", { size: formatBytes(fileSizeBytes) })}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {t("vtJsonCompare.charsShort", { n: jsonText.length.toLocaleString() })}
                  </span>
                </div>

                {jsonPreview.kind === "invalid" ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>{t("vtJsonCompare.loadedInvalidJson")}</AlertTitle>
                  </Alert>
                ) : jsonPreview.kind === "ok" && jsonPreview.summary.ok ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="text-muted-foreground">{t("vtJsonCompare.rootLabel")}:</span>
                      {jsonPreview.summary.root === "object" ? (
                        <span>{t("vtJsonCompare.rootObject", { n: jsonPreview.summary.primaryCount })}</span>
                      ) : jsonPreview.summary.root === "array" ? (
                        <span>{t("vtJsonCompare.rootArray", { n: jsonPreview.summary.primaryCount })}</span>
                      ) : (
                        <span>{t("vtJsonCompare.rootOther")}</span>
                      )}
                      {jsonPreview.summary.root === "object" ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          {t("vtJsonCompare.shaSummary", { n: jsonPreview.summary.sha256LikeKeyCount })}
                        </Badge>
                      ) : null}
                      {jsonPreview.summary.isVtMitreHashMap ? (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {t("vtJsonCompare.vtMitreDetected")}
                        </Badge>
                      ) : null}
                    </div>
                    {jsonPreview.summary.keyRows.length > 0 ? (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("vtJsonCompare.tableColKey")}</TableHead>
                              <TableHead>{t("vtJsonCompare.tableColType")}</TableHead>
                              <TableHead className="hidden sm:table-cell">{t("vtJsonCompare.tableColFormat")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {jsonPreview.summary.keyRows.map((row) => (
                              <TableRow key={row.key}>
                                <TableCell className="max-w-[min(28rem,55vw)] truncate font-mono text-xs" title={row.key}>
                                  {row.key}
                                </TableCell>
                                <TableCell className="text-xs">{row.valueKind}</TableCell>
                                <TableCell className="hidden text-xs sm:table-cell">{formatNoteKey(row.noteKey)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {jsonPreview.summary.truncated ? (
                          <p className="text-xs text-muted-foreground">
                            {t("vtJsonCompare.truncatedKeys", {
                              shown: jsonPreview.summary.keyRows.length,
                              more: jsonPreview.summary.truncatedOmitted,
                            })}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {canSendToApi ? (
            <div className="rounded-lg border border-primary/25 bg-muted/30 p-4 dark:border-primary/20 dark:bg-slate-950/30">
              <h3 className="mb-3 text-base font-medium text-foreground">{t("vtJsonCompare.compareFlowTitle")}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-md border border-border/80 bg-background/80 p-3 text-sm shadow-sm dark:border-white/10 dark:bg-slate-950/50">
                  <p className="font-medium text-foreground">{t("vtJsonCompare.compareFlowBatchMode")}</p>
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <FileJson className="size-4 shrink-0" />
                    <span className="min-w-0 truncate font-medium text-foreground">{fileName}</span>
                    <ArrowRight className="size-4 shrink-0" />
                    <span className="min-w-0 break-words text-foreground">
                      {selectedRow && shaFull
                        ? t("vtJsonCompare.compareTargetBatch", {
                            name: selectedRow.sampleName,
                            batchId: selectedRow.batchId,
                            sha: shaFull,
                          })
                        : selectedRow
                          ? t("vtJsonCompare.compareTargetBatchNoSha", {
                              name: selectedRow.sampleName,
                              batchId: selectedRow.batchId,
                            })
                          : "—"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 rounded-md border border-border/80 bg-background/80 p-3 text-sm shadow-sm dark:border-white/10 dark:bg-slate-950/50">
                  <p className="font-medium text-foreground">{t("vtJsonCompare.compareFlowUnifiedMode")}</p>
                  {!unifiedAggregateReady ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{t("vtJsonCompare.compareFlowUnifiedPlaceholder")}</p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-2">
                        <FileJson className="mt-0.5 size-4 shrink-0 text-[var(--auth-brand)]" aria-hidden />
                        <div className="min-w-0">
                          <span className="text-muted-foreground">{t("vtJsonCompare.unifiedSideExternal")} </span>
                          <span className="break-all font-medium text-foreground">{fileName}</span>
                          <span className="ml-1 text-muted-foreground">({t("vtJsonCompare.unifiedSideExternalRole")})</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Database className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        <div className="min-w-0">
                          <span className="text-muted-foreground">{t("vtJsonCompare.unifiedSideFluxtrace")} </span>
                          <span className="text-foreground">
                            {t("vtJsonCompare.unifiedSideFluxtraceDetail", {
                              hashes: unifiedPreviewHashCount ?? 0,
                              n: unifiedMaxBatches,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/80 dark:border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("vtJsonCompare.batchTitle")}</CardTitle>
          <CardDescription>{t("vtJsonCompare.batchDesc")}</CardDescription>
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <Select
              value={selectedBatchId ?? ""}
              onValueChange={(id) => {
                setSelectedBatchId(id);
                persistVtJsonCompareBatchId(id);
              }}
            >
              <SelectTrigger className="w-full max-w-xl border-border bg-background dark:bg-slate-950/80">
                <SelectValue placeholder={t("interpretacao.noBatchPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {batchesRecentFirst.map((row) => (
                  <SelectItem key={row.batchId} value={row.batchId}>
                    <span className="truncate">{row.sampleName}</span>{" "}
                    <span className="tabular-nums text-muted-foreground">· {row.batchId.slice(-8)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasValidHash && shaFull ? (
              <Badge variant="outline" className="max-w-full truncate font-mono text-xs dark:border-white/15" title={shaFull}>
                {t("vtJsonCompare.hashChip")}: {shaFull.slice(0, 12)}…{shaFull.slice(-8)}
              </Badge>
            ) : selectedBatchId ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : null}
          </div>
          <div className="pt-4">
            <Button
              type="button"
              className="gap-2"
              disabled={
                compareMut.isPending || unifiedCompareMut.isPending || !selectedBatchId || !canSendToApi
              }
              onClick={runCompare}
            >
              {compareMut.isPending ? t("vtJsonCompare.analyzing") : t("vtJsonCompare.analyzeIndividual")}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/80 dark:border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("vtJsonCompare.unifiedSectionTitle")}</CardTitle>
          <CardDescription>{t("vtJsonCompare.unifiedSectionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="vt-unified-max">{t("vtJsonCompare.unifiedMaxBatchesLabel")}</Label>
              <Input
                id="vt-unified-max"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                className="w-28 border-border bg-background dark:bg-slate-950/80"
                value={unifiedMaxBatches}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(n)) return;
                  setUnifiedMaxBatches(Math.min(50, Math.max(1, n)));
                }}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={includeLlm} onCheckedChange={(v) => setIncludeLlm(v === true)} />
              <span>{t("vtJsonCompare.unifiedLlmLabel")}</span>
            </label>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={unifiedBindLoading || compareMut.isPending || unifiedCompareMut.isPending || !canSendToApi}
                onClick={() => void bindUnifiedAggregateFromServer()}
              >
                {unifiedBindLoading ? t("vtJsonCompare.unifiedBindLoading") : t("vtJsonCompare.unifiedBindAggregate")}
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("vtJsonCompare.unifiedBindHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={
                mitreXlsxMut.isPending ||
                unifiedCompareMut.isPending ||
                compareMut.isPending
              }
              onClick={() => void downloadMitreFluxVsVtXlsx()}
            >
              {mitreXlsxMut.isPending
                ? t("vtJsonCompare.xlsxMitreFluxVsVtDownloading")
                : t("vtJsonCompare.xlsxMitreFluxVsVtDownload")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={
                unifiedCompareMut.isPending ||
                compareMut.isPending ||
                mitreXlsxMut.isPending
              }
              onClick={downloadUnifiedJson}
            >
              {t("vtJsonCompare.unifiedDownload")}
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={
                unifiedCompareMut.isPending ||
                compareMut.isPending ||
                !canSendToApi ||
                !unifiedAggregateReady
              }
              onClick={runUnifiedCompare}
            >
              {unifiedCompareMut.isPending ? t("vtJsonCompare.unifiedAnalyzing") : t("vtJsonCompare.unifiedCompare")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultMarkdown != null ||
      (resultMode === "unified" && unifiedComparisonView != null) ? (
        <Card className="border-border/80 dark:border-white/10">
          <CardHeader>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{t("vtJsonCompare.resultTitle")}</CardTitle>
                {resultMode ? (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {resultMode === "unified"
                      ? t("vtJsonCompare.resultModeUnified")
                      : t("vtJsonCompare.resultModeSingle")}
                  </Badge>
                ) : null}
              </div>
              {fileName ? (
                <p className="text-sm text-muted-foreground">
                  {t("vtJsonCompare.resultUsingFilePrefix")}{" "}
                  <strong className="text-foreground">{fileName}</strong>
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {resultMode === "unified" && unifiedComparisonView ? (
              <UnifiedMitreCompareResult view={unifiedComparisonView} llmText={unifiedLlmText} />
            ) : resultMarkdown ? (
              <div className="prose max-w-none text-foreground dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground dark:prose-headings:text-white dark:prose-p:text-muted-foreground prose-table:text-sm">
                <Streamdown>{resultMarkdown}</Streamdown>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function VtJsonCompare() {
  return (
    <DashboardLayout>
      <VtJsonCompareContent />
    </DashboardLayout>
  );
}
