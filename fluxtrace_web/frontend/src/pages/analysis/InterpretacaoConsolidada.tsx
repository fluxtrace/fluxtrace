import DashboardLayout, { useDashboardShell } from "@/components/layout/DashboardLayout";
import FlowCorrelationGraph from "@/components/flow/FlowCorrelationGraph";
import FlowJourneyDiagram from "@/components/flow/FlowJourneyDiagram";
import { MetricCard } from "@/components/widgets/MetricCard";
import { LogEvidenceCorrelatedIcons } from "@/components/log-evidence/LogEvidenceCorrelatedIcons";
import { LogEvidenceShellContext } from "@/components/log-evidence/LogEvidenceShellContext";
import { LogEvidenceFileMetricsContext } from "@/components/log-evidence/LogEvidenceFileMetricsContext";
import { MitreDefenseEvasionPanel } from "@/components/mitre/MitreDefenseEvasionPanel";
import { VirusTotalIntegratedPanel } from "@/components/virus-total/VirusTotalIntegratedPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildFlowJourneyNarrative, getFlowNodeDetailsWithFallback } from "@/lib/analysis/flowGraph";
import { formatBytes, formatDateTimeManaus } from "@/lib/core/format";
import { downloadAnalysisFlowGraphJson, downloadAnalysisSummaryJson } from "@/lib/analysis/analysisJsonExport";
import { downloadReduceLogsAnalysisExcel, downloadReduceLogsFlowExcel } from "@/lib/reduce-logs/reduceLogsExcelExport";
import { removeTrackedBatchIdFromStorage } from "@/lib/reduce-logs/reduceLogsSession";
import { asRecord } from "@/lib/core/payload";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/api/trpc";
import type { MitreEvidenceOccurrence } from "@shared/analysis";
import { buildContradefFlowchartMermaid, buildContradefMindmapMermaid } from "@shared/flowGraph/flowGraphMermaidDiagrams";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Cpu,
  ExternalLink,
  FileDown,
  FileText,
  FileSpreadsheet,
  Filter,
  Hash,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "wouter";
import { toast } from "sonner";
import { buildMermaidAiLiveViewUrl } from "@/lib/analysis/mermaidLiveLink";
import { useAuth } from "@/_core/hooks/useAuth";

/** Últimos 5 hex do SHA ou do hash embutido no nome da amostra (submissões longas sem coluna SHA). */
function sampleHashTail5(batchRow: { sampleSha256?: string | null; sampleName: string }): string {
  const sha = typeof batchRow.sampleSha256 === "string" ? batchRow.sampleSha256.trim().toLowerCase() : "";
  if (/^[a-f0-9]{64}$/.test(sha)) {
    return sha.slice(-5);
  }
  const long = batchRow.sampleName.match(/(?:^|[\s_–-])([a-f0-9]{64})\b/i)?.[1];
  if (long) {
    return long.toLowerCase().slice(-5);
  }
  const mid = batchRow.sampleName.match(/(?:^|[\s_–-])([a-f0-9]{40,63})\b/i)?.[1];
  if (mid) {
    return mid.toLowerCase().slice(-5);
  }
  return "—";
}

/** Rótulo único compacto para o `<Select>` da interpretação consolidada. */
function consolidatedBatchSelectLabel(batchRow: {
  batchId: string;
  sampleName: string;
  sampleSha256?: string | null;
  createdAt: Date | string;
}): string {
  const dt = formatDateTimeManaus(batchRow.createdAt);
  return `${dt} - ${batchRow.batchId} - ${sampleHashTail5(batchRow)}`;
}

/** `title`/pesquisa: nome completo e hash quando existirem (atalho ⌘K / filtro). */
function consolidatedBatchSelectTitle(batchRow: {
  sampleName: string;
  sampleSha256?: string | null;
}): string {
  const parts = [batchRow.sampleName.trim()];
  const sha = batchRow.sampleSha256?.trim();
  if (sha && /^[a-f0-9]{64}$/i.test(sha)) {
    parts.push(`SHA-256: ${sha}`);
  }
  return parts.filter(Boolean).join("\n");
}

/** Download do log reduzido em texto (mesmo endpoint que em Reduzir logs). */
function buildReducedLogTxtDownloadUrl(batchId: string, fileName: string) {
  return `/api/analysis-artifacts/reduced-log-by-file?${new URLSearchParams({ batchId, fileName }).toString()}`;
}

/** Preferir `event:` quando existir no grafo; caso contrário `phase:` (evita foco em ID órfão). */
function resolveMitreFlowGraphNodeId(
  occ: MitreEvidenceOccurrence,
  flowNodes: Array<{ id: string }> | undefined,
): string | null {
  if (!flowNodes?.length) return null;
  const ids = new Set(flowNodes.map((n) => n.id));
  if (occ.graphNodeId && ids.has(occ.graphNodeId)) return occ.graphNodeId;
  if (ids.has(occ.phaseNodeId)) return occ.phaseNodeId;
  return null;
}

/** Identificação visível para o modo de interpretação textual (modelo registado pela análise). */
function InterpretationSourceBadge({ modelName }: { modelName?: string | null }) {
  const { t } = useTranslation();
  const trimmed = typeof modelName === "string" ? modelName.trim() : "";
  const isSkippedEnv = trimmed === "deterministic-skipped-env";
  const isFallback = trimmed === "deterministic-fallback";
  const isDeterministic = isSkippedEnv || isFallback;

  const modeLabel = !trimmed
    ? t("interpretacao.llmBadgeUnknownShort")
    : isSkippedEnv
      ? t("interpretacao.llmBadgeSkippedEnvShort")
      : isFallback
        ? t("interpretacao.llmBadgeFallbackShort")
        : t("interpretacao.llmBadgeLlmShort");

  const modelLine = !trimmed ? t("interpretacao.llmBadgeNoModelRecorded") : trimmed;

  return (
    <div className="flex max-w-[min(100%,26rem)] shrink-0 flex-col items-end gap-1 text-right">
      <Badge
        variant="outline"
        className="gap-1.5 border-cyan-500/45 bg-cyan-500/[0.13] px-3 py-1 text-xs font-medium text-cyan-950 shadow-sm dark:border-cyan-400/40 dark:bg-cyan-950/55 dark:text-cyan-50"
      >
        {isDeterministic ? <Cpu className="h-3.5 w-3.5 opacity-95" aria-hidden /> : <Sparkles className="h-3.5 w-3.5 opacity-95" aria-hidden />}
        <span>{modeLabel}</span>
      </Badge>
      <span className="break-all font-mono text-[11px] leading-snug text-muted-foreground opacity-95" translate="no">
        {modelLine}
      </span>
      {isDeterministic ? (
        <p className="max-w-[20rem] text-[10px] leading-snug text-muted-foreground opacity-95">
          {t("interpretacao.llmBadgeDeterministicExplain")}
        </p>
      ) : null}
    </div>
  );
}

function InterpretacaoConsolidadaContent() {
  const { t } = useTranslation();
  const { sidebarCollapsed } = useDashboardShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [interpretationTab, setInterpretationTab] = useState("overview");
  const [flowLayoutMode, setFlowLayoutMode] = useState<"timeline" | "network">("timeline");
  const [overviewIntelTab, setOverviewIntelTab] = useState("mitre");
  const [mitreTraceTarget, setMitreTraceTarget] = useState<{
    batchId: string;
    targetNodeId: string;
    phaseNodeId: string;
    eventNodeId: string | null;
    evidenceFileName: string;
    evidenceLineNumber: number;
  } | null>(null);
  const [graphFitViewPulse, setGraphFitViewPulse] = useState(0);

  /** Evita limpar `mitreTraceTarget` quando o próprio rastreio MITRE atualiza o nó. */
  const skipClearTraceOnGraphSelect = useRef(false);

  const selectedBatchId = searchParams.get("batch");

  const batchesQuery = trpc.analysis.list.useQuery(
    { limit: 50 },
    { refetchInterval: 5000 },
  );

  /** Mais recente primeiro (última actividade → início como desempate). */
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

  const selectedBatchFromList = useMemo(
    () => (selectedBatchId ? (batchesRecentFirst.find((j) => j.batchId === selectedBatchId) ?? null) : null),
    [batchesRecentFirst, selectedBatchId],
  );

  const deleteBatchMutation = trpc.analysis.deleteBatch.useMutation();

  const canDeleteSelectedBatch = Boolean(
    !authLoading
      && user
      && selectedBatchFromList
      && typeof selectedBatchFromList.createdByUserId === "number"
      && selectedBatchFromList.createdByUserId === user.id,
  );

  useEffect(() => {
    if (selectedBatchId) return;
    const first = batchesRecentFirst[0]?.batchId;
    if (!first) return;
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("batch", first);
        return p;
      },
      { replace: true },
    );
  }, [batchesRecentFirst, selectedBatchId, setSearchParams]);

  useEffect(() => {
    if (skipClearTraceOnGraphSelect.current) {
      skipClearTraceOnGraphSelect.current = false;
      return;
    }
    setMitreTraceTarget(null);
  }, [selectedGraphNodeId]);

  useEffect(() => {
    setSelectedGraphNodeId(null);
    setInterpretationTab("overview");
    setOverviewIntelTab("mitre");
    setMitreTraceTarget(null);
    setGraphFitViewPulse(0);
  }, [selectedBatchId]);

  const detailQuery = trpc.analysis.detail.useQuery(
    { batchId: selectedBatchId ?? "" },
    {
      enabled: Boolean(selectedBatchId),
      refetchInterval: (query) => {
        const status = query.state.data?.batch.status;
        return status === "running" || status === "queued" ? 4000 : false;
      },
    },
  );

  const selectedDetail = detailQuery.data ?? null;

  const filteredEvents = useMemo(() => {
    const events = selectedDetail?.events ?? [];
    const query = eventSearch.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) => {
      const payload = JSON.stringify(event.payloadJson ?? {}).toLowerCase();
      return `${event.eventType} ${event.stage ?? ""} ${event.message ?? ""} ${payload}`.toLowerCase().includes(query);
    });
  }, [eventSearch, selectedDetail?.events]);

  const effectiveGraphNodeId = useMemo(() => {
    const nodes = selectedDetail?.flowGraph.nodes ?? [];
    if (!nodes.length) return null;
    if (selectedGraphNodeId && nodes.some((n) => n.id === selectedGraphNodeId)) {
      return selectedGraphNodeId;
    }
    return nodes[0]!.id;
  }, [selectedDetail?.flowGraph.nodes, selectedGraphNodeId]);

  const logEvidenceShellValue = useMemo(
    () => ({
      onBackToSummary: () => setInterpretationTab("overview"),
    }),
    [],
  );

  const focusFlowNode = useCallback((nodeId: string) => {
    const nodes = selectedDetail?.flowGraph.nodes;
    if (!nodes?.some((n) => n.id === nodeId)) return;
    setSelectedGraphNodeId(nodeId);
    setGraphFitViewPulse((p) => p + 1);
    requestAnimationFrame(() => {
      document.querySelector(`[data-flow-node-id="${CSS.escape(nodeId)}"]`)?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  }, [selectedDetail?.flowGraph.nodes]);

  const selectedGraphNode = useMemo(
    () => selectedDetail?.flowGraph.nodes.find((node) => node.id === effectiveGraphNodeId) ?? null,
    [selectedDetail?.flowGraph.nodes, effectiveGraphNodeId],
  );
  const selectedGraphNodeDetails = useMemo(
    () => getFlowNodeDetailsWithFallback(selectedGraphNode, selectedDetail?.flowGraph ?? null),
    [selectedGraphNode, selectedDetail?.flowGraph],
  );
  const selectedGraphNodeIncomingEdge = useMemo(() => {
    if (!selectedDetail?.flowGraph.edges.length || !selectedGraphNode) return null;
    return selectedDetail.flowGraph.edges.find((edge) => edge.target === selectedGraphNode.id) ?? null;
  }, [selectedDetail?.flowGraph.edges, selectedGraphNode]);
  const selectedGraphNodeIncomingEdgeSourceNode = useMemo(() => {
    if (!selectedDetail?.flowGraph.nodes.length || !selectedGraphNodeIncomingEdge) return null;
    return selectedDetail.flowGraph.nodes.find((node) => node.id === selectedGraphNodeIncomingEdge.source) ?? null;
  }, [selectedDetail?.flowGraph.nodes, selectedGraphNodeIncomingEdge]);

  const flowJourneyNarrativeText = useMemo(() => {
    if (!selectedDetail) return "";
    return buildFlowJourneyNarrative({
      flowGraph: selectedDetail.flowGraph,
      classification: selectedDetail.classification,
      riskLevel: selectedDetail.riskLevel,
      currentPhase: selectedDetail.currentPhase,
    });
  }, [selectedDetail]);

  const hasFlowGraphDiagram = Boolean(selectedDetail?.flowGraph.nodes.length);

  const mermaidDirectedDiagramHref = useMemo(() => {
    if (!selectedDetail || !hasFlowGraphDiagram) return null;
    return buildMermaidAiLiveViewUrl(buildContradefFlowchartMermaid(selectedDetail.flowGraph));
  }, [selectedDetail, hasFlowGraphDiagram]);

  const mermaidMindmapHref = useMemo(() => {
    if (!selectedDetail || !hasFlowGraphDiagram) return null;
    return buildMermaidAiLiveViewUrl(
      buildContradefMindmapMermaid(selectedDetail.flowGraph, selectedDetail.classification),
    );
  }, [selectedDetail, hasFlowGraphDiagram]);

  function selectBatchId(batchId: string) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("batch", batchId);
      return p;
    });
  }

  function handleExportAnalysisExcel() {
    if (!selectedDetail) {
      toast.error(t("interpretacao.toastNoAnalysis"));
      return;
    }
    try {
      downloadReduceLogsAnalysisExcel({ detail: selectedDetail, batchId: selectedBatchId });
      toast.success(t("interpretacao.toastExcelOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("interpretacao.toastExcelFail"));
    }
  }

  const handleMitreTrace = useCallback(
    (occ: MitreEvidenceOccurrence) => {
      if (!selectedBatchId) {
        toast.error(t("interpretacao.toastSelectBatch"));
        return;
      }
      const flowNodes = selectedDetail?.flowGraph.nodes;
      const target = resolveMitreFlowGraphNodeId(occ, flowNodes);

      setInterpretationTab("graph");
      skipClearTraceOnGraphSelect.current = true;
      setMitreTraceTarget({
        batchId: selectedBatchId,
        targetNodeId: target ?? occ.graphNodeId ?? occ.phaseNodeId,
        phaseNodeId: occ.phaseNodeId,
        eventNodeId: occ.graphNodeId,
        evidenceFileName: occ.fileName,
        evidenceLineNumber: occ.lineNumber,
      });

      const applyFocus = () => {
        if (target) {
          focusFlowNode(target);
        } else if (flowNodes?.length) {
          toast.warning(t("interpretacao.mitreTraceNoGraphNode"));
        }
      };

      queueMicrotask(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(applyFocus);
        });
      });

      toast.info(
        t("interpretacao.mitreToast", {
          file: occ.fileName,
          line: occ.lineNumber,
          stage: occ.stage,
        }),
      );
    },
    [selectedBatchId, selectedDetail?.flowGraph.nodes, focusFlowNode, t],
  );

  function handleExportFlowExcel() {
    if (!selectedDetail?.flowGraph.nodes.length) {
      toast.error(t("interpretacao.toastNoFlow"));
      return;
    }
    try {
      downloadReduceLogsFlowExcel({ detail: selectedDetail, batchId: selectedBatchId });
      toast.success(t("interpretacao.toastFlowExcelOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("interpretacao.toastFlowExcelFail"));
    }
  }

  function handleExportFlowGraphJson() {
    if (!selectedDetail) {
      toast.error(t("interpretacao.toastNoAnalysis"));
      return;
    }
    try {
      downloadAnalysisFlowGraphJson({ detail: selectedDetail, batchId: selectedBatchId });
      toast.success(t("interpretacao.toastJsonFlowOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("interpretacao.toastJsonFlowFail"));
    }
  }

  function handleExportSummaryJson() {
    if (!selectedDetail) {
      toast.error(t("interpretacao.toastNoAnalysis"));
      return;
    }
    try {
      downloadAnalysisSummaryJson({ detail: selectedDetail, batchId: selectedBatchId });
      toast.success(t("interpretacao.toastSummaryOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("interpretacao.toastSummaryFail"));
    }
  }

  async function handleConfirmDeleteBatch() {
    if (!selectedBatchId || !canDeleteSelectedBatch) return;
    const deletedId = selectedBatchId;
    const nextId = batchesRecentFirst.map((b) => b.batchId).filter((id) => id !== deletedId)[0];
    try {
      await deleteBatchMutation.mutateAsync({ batchId: deletedId });
      toast.success(t("interpretacao.deleteToastOk"));
      setDeleteConfirmOpen(false);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (nextId) {
            p.set("batch", nextId);
          } else {
            p.delete("batch");
          }
          return p;
        },
        { replace: true },
      );
      await utils.analysis.list.invalidate();
      await utils.analysis.detail.invalidate({ batchId: deletedId });
      removeTrackedBatchIdFromStorage(deletedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("interpretacao.deleteToastFail"));
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6 text-foreground">
        {batchesQuery.isError ? (
          <section
            role="alert"
            className="rounded-lg border border-destructive/45 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:bg-red-950/35 dark:text-red-100"
          >
            <p className="font-semibold">{t("interpretacao.listLoadErrorTitle")}</p>
            <p className="mt-1 break-words font-mono text-xs opacity-90">{batchesQuery.error.message}</p>
            <p className="mt-2 text-xs opacity-90">{t("interpretacao.listLoadErrorHint")}</p>
          </section>
        ) : null}
        <section>
          <Card className="min-w-0 border-border bg-card text-card-foreground shadow-md dark:border-white/10 dark:bg-slate-950/80 dark:shadow-xl dark:shadow-slate-950/30">
            <CardHeader className="space-y-0">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  {selectedDetail ? (
                    <>
                      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{t("interpretacao.exportToolbarKicker")}</p>
                      <div className="flex min-h-11 flex-nowrap gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-cyan-600/40 text-cyan-900 hover:bg-cyan-500/15 dark:border-cyan-400/35 dark:text-cyan-100"
                          onClick={handleExportAnalysisExcel}
                        >
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          {t("interpretacao.exportAnalysisExcel")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-border text-foreground hover:bg-muted dark:border-white/15"
                          onClick={handleExportFlowGraphJson}
                          title={t("interpretacao.exportFlowJsonTitle")}
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          {t("interpretacao.exportFlowJson")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-border text-foreground hover:bg-muted dark:border-white/15"
                          onClick={handleExportSummaryJson}
                          title={t("interpretacao.exportSummaryTitle")}
                        >
                          <FileDown className="mr-2 h-4 w-4 shrink-0" />
                          {t("interpretacao.exportSummaryJson")}
                        </Button>
                        {mermaidDirectedDiagramHref ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            asChild
                            title={t("interpretacao.mermaidDirectedTitle")}
                          >
                            <a href={mermaidDirectedDiagramHref} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t("interpretacao.mermaidDirected")}
                            </a>
                          </Button>
                        ) : null}
                        {mermaidMindmapHref ? (
                          <Button variant="outline" size="sm" className="shrink-0" asChild title={t("interpretacao.mermaidMindmapTitle")}>
                            <a href={mermaidMindmapHref} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t("interpretacao.mermaidMindmap")}
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  <Select
                    value={selectedBatchId ?? ""}
                    onValueChange={selectBatchId}
                    disabled={batchesRecentFirst.length === 0}
                  >
                    <SelectTrigger
                      className="h-auto min-h-11 w-full max-w-xl border-border bg-background px-3 py-2 text-left text-sm shadow-xs dark:bg-slate-950/80 [&_svg]:shrink-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:block *:data-[slot=select-value]:w-full *:data-[slot=select-value]:min-w-0"
                      aria-label={t("interpretacao.selectBatchAria")}
                    >
                      <SelectValue placeholder={t("interpretacao.noBatchPlaceholder")}>
                        {selectedBatchFromList ? (
                          <span
                            className="block truncate text-left tabular-nums"
                            title={consolidatedBatchSelectTitle(selectedBatchFromList)}
                          >
                            {consolidatedBatchSelectLabel(selectedBatchFromList)}
                          </span>
                        ) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-w-[min(100vw-2rem,36rem)]">
                      {batchesRecentFirst.map((batchRow) => (
                        <SelectItem
                          key={batchRow.batchId}
                          value={batchRow.batchId}
                          className="py-2"
                          textValue={`${batchRow.sampleName} ${batchRow.batchId} ${batchRow.sampleSha256 ?? ""} ${consolidatedBatchSelectLabel(batchRow)}`}
                          title={consolidatedBatchSelectTitle(batchRow)}
                        >
                          <span className="block truncate tabular-nums">{consolidatedBatchSelectLabel(batchRow)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canDeleteSelectedBatch && selectedBatchId ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="shrink-0 border-rose-600/50 bg-rose-600/90 text-white hover:bg-rose-600 dark:border-rose-500/60 dark:bg-rose-700/90 dark:hover:bg-rose-600"
                        disabled={deleteBatchMutation.isPending}
                        onClick={() => setDeleteConfirmOpen(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                        {t("interpretacao.deleteBatch")}
                      </Button>
                    </div>
                  ) : null}
                </div>
                {selectedBatchId ? (
                  <div
                    className="w-full shrink-0 lg:w-auto lg:max-w-[min(100%,23rem)] lg:self-start"
                    title={t("interpretacao.chipTitleId", { id: selectedBatchId })}
                  >
                    <div className="rounded-xl border-2 border-cyan-500/50 bg-cyan-500/15 px-3 py-2.5 shadow-sm dark:border-cyan-400/40 dark:bg-cyan-950/40">
                      <div className="flex items-start gap-2.5">
                        <Hash className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500 dark:text-cyan-300" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-900 dark:text-cyan-200/95">
                              {t("interpretacao.chipKickerId")}
                            </p>
                            {selectedDetail ? (
                              <Badge variant="outline" className="shrink-0 border-border text-[11px] text-foreground dark:border-white/20">
                                {selectedDetail.classification}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 break-all font-mono text-sm font-semibold leading-snug text-foreground">{selectedBatchId}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="min-w-0">
              {!selectedDetail ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center text-muted-foreground dark:border-white/10 dark:bg-white/5">
                  {t("interpretacao.nothingSelected")}
                </div>
              ) : (
                <div className="min-w-0 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard icon={ShieldAlert} label={t("interpretacao.metricCategory")} value={selectedDetail.classification} helper={selectedDetail.currentPhase} />
                    <MetricCard icon={AlertTriangle} label={t("interpretacao.metricRisk")} value={selectedDetail.riskLevel.toUpperCase()} helper={t("interpretacao.metricRiskHelper", { n: selectedDetail.techniques.length })} />
                    <MetricCard icon={Filter} label={t("interpretacao.metricReduction")} value={`${selectedDetail.metrics.reductionPercent.toFixed(1)}%`} helper={t("interpretacao.metricReductionHelper", { n: selectedDetail.metrics.reducedLineCount })} />
                    <MetricCard icon={BrainCircuit} label={t("interpretacao.metricApis")} value={String(selectedDetail.suspiciousApis.length)} helper={t("interpretacao.metricApisHelper", { n: selectedDetail.metrics.triggerCount })} />
                  </div>

                  <Tabs value={interpretationTab} onValueChange={setInterpretationTab} className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("interpretacao.overviewContentKicker")}</p>
                      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 rounded-xl border border-border bg-muted p-1.5 dark:border-white/12 dark:bg-slate-950/85">
                        <TabsTrigger
                          value="overview"
                          className="rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-cyan-500/45 data-[state=active]:bg-cyan-500/20 data-[state=active]:font-medium data-[state=active]:text-cyan-900 dark:data-[state=active]:border-cyan-400/45 dark:data-[state=active]:text-cyan-50"
                        >
                          {t("interpretacao.tabOverview")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="graph"
                          className="rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-cyan-500/45 data-[state=active]:bg-cyan-500/20 data-[state=active]:font-medium data-[state=active]:text-cyan-900 dark:data-[state=active]:border-cyan-400/45 dark:data-[state=active]:text-cyan-50"
                        >
                          {t("interpretacao.tabFlow")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="artifacts"
                          className="rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-cyan-500/45 data-[state=active]:bg-cyan-500/20 data-[state=active]:font-medium data-[state=active]:text-cyan-900 dark:data-[state=active]:border-cyan-400/45 dark:data-[state=active]:text-cyan-50"
                        >
                          {t("interpretacao.tabArtifacts")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="events"
                          className="rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-cyan-500/45 data-[state=active]:bg-cyan-500/20 data-[state=active]:font-medium data-[state=active]:text-cyan-900 dark:data-[state=active]:border-cyan-400/45 dark:data-[state=active]:text-cyan-50"
                        >
                          {t("interpretacao.tabEvents")}
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="overview" className="space-y-4">
                      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                        <Card className="border-border bg-card text-card-foreground shadow-sm dark:border-white/10 dark:bg-white/5">
                          <CardHeader>
                            <CardTitle className="text-lg">{t("interpretacao.verdictTitle")}</CardTitle>
                            <CardAction>
                              <InterpretationSourceBadge modelName={selectedDetail.insight?.modelName} />
                            </CardAction>
                          </CardHeader>
                          <CardContent className="pb-6 pt-2">
                            <div className="prose max-w-none text-foreground dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground dark:prose-headings:text-white dark:prose-p:text-muted-foreground">
                              <Streamdown>{selectedDetail.insight?.summaryMarkdown ?? t("interpretacao.summaryUnavailable")}</Streamdown>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-border bg-card text-card-foreground shadow-sm dark:border-white/10 dark:bg-white/5">
                          <CardHeader>
                            <CardTitle className="text-lg">{t("interpretacao.indicatorsTitle")}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-border bg-muted/70 p-3 dark:border-white/10 dark:bg-slate-950/80">
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("interpretacao.linesOriginal")}</p>
                                <p className="mt-2 text-lg font-semibold text-foreground">{selectedDetail.metrics.originalLineCount}</p>
                              </div>
                              <div className="rounded-2xl border border-border bg-muted/70 p-3 dark:border-white/10 dark:bg-slate-950/80">
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("interpretacao.linesReduced")}</p>
                                <p className="mt-2 text-lg font-semibold text-foreground">{selectedDetail.metrics.reducedLineCount}</p>
                              </div>
                              <div className="rounded-2xl border border-border bg-muted/70 p-3 dark:border-white/10 dark:bg-slate-950/80">
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("interpretacao.sizeOriginal")}</p>
                                <p className="mt-2 text-lg font-semibold text-foreground">{formatBytes(selectedDetail.metrics.originalBytes)}</p>
                              </div>
                              <div className="rounded-2xl border border-border bg-muted/70 p-3 dark:border-white/10 dark:bg-slate-950/80">
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("interpretacao.sizeReduced")}</p>
                                <p className="mt-2 text-lg font-semibold text-foreground">{formatBytes(selectedDetail.metrics.reducedBytes)}</p>
                              </div>
                            </div>
                            <Separator />
                            <Tabs value={overviewIntelTab} onValueChange={setOverviewIntelTab} className="space-y-3">
                              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 rounded-xl border border-border bg-muted p-1.5 dark:border-white/12 dark:bg-slate-950/85">
                                <TabsTrigger
                                  value="mitre"
                                  className="rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-cyan-500/45 data-[state=active]:bg-cyan-500/20 data-[state=active]:font-medium data-[state=active]:text-cyan-900 dark:data-[state=active]:border-cyan-400/45 dark:data-[state=active]:text-cyan-50"
                                >
                                  {t("interpretacao.intelMitre")}
                                </TabsTrigger>
                                <TabsTrigger
                                  value="virustotal"
                                  className="rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-cyan-500/45 data-[state=active]:bg-cyan-500/20 data-[state=active]:font-medium data-[state=active]:text-cyan-900 dark:data-[state=active]:border-cyan-400/45 dark:data-[state=active]:text-cyan-50"
                                >
                                  {t("interpretacao.intelVt")}
                                </TabsTrigger>
                              </TabsList>
                              <TabsContent value="mitre" className="mt-2 space-y-0 outline-none focus-visible:outline-none">
                                <MitreDefenseEvasionPanel
                                  mitre={selectedDetail.mitreDefenseEvasion}
                                  heuristicTags={selectedDetail.techniques}
                                  onEvidenceTrace={handleMitreTrace}
                                />
                              </TabsContent>
                              <TabsContent value="virustotal" className="mt-2 space-y-3 outline-none focus-visible:outline-none">
                                <VirusTotalIntegratedPanel
                                  batchId={selectedDetail.batch.batchId}
                                  sampleSha256={selectedDetail.batch.sampleSha256}
                                />
                              </TabsContent>
                            </Tabs>
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-foreground">{t("interpretacao.heuristicTitle")}</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedDetail.techniques.length ? selectedDetail.techniques.map((technique) => (
                                  <Badge key={technique} variant="outline" className="border-border bg-muted/50 text-foreground dark:border-white/10 dark:bg-white/5">
                                    {technique}
                                  </Badge>
                                )) : <p className="text-sm text-muted-foreground">{t("interpretacao.noTechniques")}</p>}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-foreground">{t("interpretacao.recommendationsTitle")}</p>
                              <ul className="space-y-2 text-sm text-muted-foreground">
                                {selectedDetail.recommendations.map((recommendation) => (
                                  <li key={recommendation} className="rounded-xl border border-border bg-muted/40 p-3 dark:border-white/10 dark:bg-white/5">
                                    {recommendation}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="graph" className="space-y-4">
                      <LogEvidenceFileMetricsContext.Provider value={selectedDetail.fileMetrics}>
                      <LogEvidenceShellContext.Provider value={logEvidenceShellValue}>
                      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 dark:border-cyan-400/25 dark:bg-cyan-500/[0.07]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-200/90">
                              {t("interpretacao.graphBannerTitle")}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("interpretacao.graphBannerDesc")}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="default"
                              className="shrink-0 gap-2 border-2 border-cyan-600/50 font-semibold text-cyan-950 shadow-sm hover:bg-cyan-500/25 dark:border-cyan-400/45 dark:text-cyan-50 dark:hover:bg-cyan-500/20"
                              onClick={() => setInterpretationTab("overview")}
                            >
                              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                              {t("interpretacao.backOverview")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-cyan-600/40 text-cyan-900 hover:bg-cyan-500/15 dark:border-cyan-400/35 dark:text-cyan-100"
                              onClick={handleExportFlowExcel}
                            >
                              <FileSpreadsheet className="mr-2 h-4 w-4" />
                              {t("interpretacao.exportFlowExcelBtn")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-border text-foreground hover:bg-muted dark:border-white/15"
                              onClick={handleExportFlowGraphJson}
                              title={t("interpretacao.exportFlowUiTitle")}
                            >
                              <FileDown className="mr-2 h-4 w-4" />
                              {t("interpretacao.exportFlowUiJson")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-border text-foreground hover:bg-muted dark:border-white/15"
                              onClick={handleExportSummaryJson}
                              title={t("interpretacao.exportSummaryEnvelope")}
                            >
                              <FileDown className="mr-2 h-4 w-4" />
                              {t("interpretacao.exportSummaryJson")}
                            </Button>
                          </div>
                        </div>
                        <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                          {flowJourneyNarrativeText || t("interpretacao.narrativeFallback")}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "grid min-w-0 gap-4",
                          sidebarCollapsed
                            ? "xl:grid-cols-[minmax(0,1.2fr),min(400px,32vw)] xl:gap-5 2xl:grid-cols-[minmax(0,1.35fr),400px]"
                            : "lg:grid-cols-[minmax(0,1fr),320px]",
                        )}
                      >
                        <div className="min-w-0 max-w-full rounded-3xl border border-border bg-gradient-to-br from-muted/80 via-background to-cyan-500/10 p-4 dark:border-white/10 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/40">
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <Sparkles className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
                              <span>{t("interpretacao.graphTip")}</span>
                            </div>
                            <div className="flex shrink-0 flex-col gap-1">
                              <label htmlFor="flow-graph-layout-select" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("interpretacao.graphViewModeLabel")}
                              </label>
                              <Select
                                value={flowLayoutMode}
                                onValueChange={(v) => setFlowLayoutMode(v === "network" ? "network" : "timeline")}
                              >
                                <SelectTrigger id="flow-graph-layout-select" className="h-9 w-[min(100vw-2rem,260px)] border-border bg-background dark:bg-slate-950/80">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="timeline">{t("interpretacao.graphViewTimeline")}</SelectItem>
                                  <SelectItem value="network">{t("interpretacao.graphViewNetwork")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {selectedDetail.flowGraph.nodes.length ? selectedDetail.flowGraph.nodes.map((node) => (
                              <button
                                key={node.id}
                                type="button"
                                data-flow-node-id={node.id}
                                onClick={() => focusFlowNode(node.id)}
                                className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${effectiveGraphNodeId === node.id ? "border-cyan-500/50 bg-cyan-500/15 text-foreground dark:border-cyan-400/40 dark:bg-cyan-500/10 dark:text-white" : "border-border bg-muted/50 text-foreground hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"}`}
                              >
                                <span className="font-medium">{node.label}</span>
                                <Badge variant="outline" className="ml-2 border-border text-xs text-muted-foreground dark:border-white/10">{node.kind}</Badge>
                              </button>
                            )) : (
                              <p className="text-sm text-muted-foreground">{t("interpretacao.flowNodesEmpty")}</p>
                            )}
                          </div>
                          <div className="mt-4 space-y-3">
                            {mitreTraceTarget ? (
                              <p className="text-[11px] leading-relaxed text-muted-foreground">
                                {t("interpretacao.mitreTraceIntro")}{" "}
                                <span className="break-all font-mono text-foreground/90">
                                  {mitreTraceTarget.evidenceFileName}:{mitreTraceTarget.evidenceLineNumber}
                                </span>
                                {t("interpretacao.mitreTraceHint")}
                              </p>
                            ) : null}
                            <FlowCorrelationGraph
                              key={`flow-graph-${selectedBatchId ?? "none"}-${flowLayoutMode}`}
                              graph={selectedDetail.flowGraph}
                              selectedNodeId={effectiveGraphNodeId}
                              onSelectNode={focusFlowNode}
                              expandedHeight={sidebarCollapsed}
                              batchId={selectedBatchId}
                              layoutMode={flowLayoutMode}
                              phaseLogPeekOverride={
                                mitreTraceTarget && !mitreTraceTarget.eventNodeId
                                  ? {
                                      phaseNodeId: mitreTraceTarget.phaseNodeId,
                                      batchId: mitreTraceTarget.batchId,
                                      fileName: mitreTraceTarget.evidenceFileName,
                                      lineNumber: mitreTraceTarget.evidenceLineNumber,
                                    }
                                  : null
                              }
                              focusFitNodeId={effectiveGraphNodeId}
                              graphFitPulse={graphFitViewPulse}
                            />
                          </div>
                          <div className="mt-4 space-y-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("interpretacao.journeyByPhase")}</p>
                            <FlowJourneyDiagram
                              graph={selectedDetail.flowGraph}
                              selectedNodeId={effectiveGraphNodeId}
                              onSelectNode={focusFlowNode}
                              batchId={selectedBatchId}
                              phaseLogPeekOverride={
                                mitreTraceTarget && !mitreTraceTarget.eventNodeId
                                  ? {
                                      phaseNodeId: mitreTraceTarget.phaseNodeId,
                                      batchId: mitreTraceTarget.batchId,
                                      fileName: mitreTraceTarget.evidenceFileName,
                                      lineNumber: mitreTraceTarget.evidenceLineNumber,
                                    }
                                  : null
                              }
                            />
                          </div>
                          <details className="mt-4 rounded-2xl border border-border bg-muted/40 px-3 py-2 dark:border-white/10 dark:bg-black/15">
                            <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
                              {t("interpretacao.edgesToggle", { n: selectedDetail.flowGraph.edges.length })}
                            </summary>
                            <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto text-xs text-muted-foreground">
                              {selectedDetail.flowGraph.edges.map((edge) => (
                                <div key={`${edge.source}-${edge.target}-${edge.relation}`} className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-1 dark:border-white/10 dark:bg-white/5">
                                  <span>{edge.source.replace("phase:", "").replace("event:", "")}</span>
                                  <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-800 dark:border-cyan-400/25 dark:text-cyan-200">{edge.relation}</span>
                                  <ArrowRight className="h-3 w-3 shrink-0" />
                                  <span>{edge.target.replace("phase:", "").replace("event:", "")}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                        <div className="min-w-0 rounded-2xl border border-border bg-muted/50 p-4 dark:border-white/10 dark:bg-black/20">
                          <p className="text-sm font-medium text-foreground">{t("interpretacao.selectedNodeTitle")}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{selectedGraphNode?.label ?? t("interpretacao.pickNodePrompt")}</p>
                          {selectedGraphNode ? (
                            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                              <div className="rounded-xl border border-border bg-muted/80 p-3 dark:border-white/10 dark:bg-slate-950/70">
                                <p><span className="text-muted-foreground">{t("interpretacao.originFile")}</span> {selectedGraphNodeDetails.sourceFile ?? "—"}</p>
                                <p><span className="text-muted-foreground">{t("interpretacao.logTypeLabel")}</span> {selectedGraphNodeDetails.sourceLogType ?? "—"}</p>
                                <p><span className="text-muted-foreground">{t("interpretacao.lineLabel")}</span> {selectedGraphNodeDetails.sourceLineNumber ?? "—"}</p>
                                <p><span className="text-muted-foreground">{t("interpretacao.phaseLabel")}</span> {selectedGraphNodeDetails.stage ?? "—"}</p>
                                <p>
                                  <span className="text-muted-foreground">{t("interpretacao.transitionLabel")}</span>{" "}
                                  {selectedGraphNodeIncomingEdge
                                    ? selectedGraphNodeIncomingEdgeSourceNode
                                      ? t("interpretacao.transitionFrom", {
                                          relation: selectedGraphNodeIncomingEdge.relation,
                                          label: selectedGraphNodeIncomingEdgeSourceNode.label,
                                        })
                                      : selectedGraphNodeIncomingEdge.relation
                                    : "—"}
                                </p>
                                {selectedGraphNode.kind === "phase" ? (
                                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                    {t("interpretacao.phaseNote")}
                                  </p>
                                ) : null}
                                {selectedGraphNodeDetails.phaseOriginNote ? (
                                  <p className="mt-2 text-xs leading-relaxed text-amber-900 dark:text-amber-100/95">
                                    {selectedGraphNodeDetails.phaseOriginNote}
                                  </p>
                                ) : null}
                              </div>
                              {selectedBatchId &&
                              selectedGraphNode.kind === "api" &&
                              selectedGraphNodeDetails.sourceFile &&
                              !selectedGraphNodeDetails.sourceFile.includes("(+") &&
                              typeof selectedGraphNodeDetails.sourceLineNumber === "number" ? (
                                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2 dark:border-white/12 dark:bg-slate-950/65">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {t("interpretacao.pngStripe")}
                                  </span>
                                  <LogEvidenceCorrelatedIcons
                                    batchId={selectedBatchId}
                                    fileName={selectedGraphNodeDetails.sourceFile}
                                    lineNumber={selectedGraphNodeDetails.sourceLineNumber}
                                    variant="icon"
                                    caption={selectedGraphNode.label}
                                    onBeforeOpen={() => {
                                      if (effectiveGraphNodeId) focusFlowNode(effectiveGraphNodeId);
                                    }}
                                  />
                                </div>
                              ) : null}
                              <div className="rounded-xl border border-border bg-muted/80 p-3 dark:border-white/10 dark:bg-slate-950/70">
                                <p className="text-foreground">
                                  <span className="text-muted-foreground">{t("interpretacao.howIdentified")}</span>{" "}
                                  {selectedGraphNodeDetails.identification ??
                                    selectedGraphNodeDetails.identifiedBy ??
                                    t("interpretacao.noIdentification")}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                                  {selectedGraphNodeDetails.evidence ?? t("interpretacao.noEvidenceText")}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(selectedGraphNodeDetails.suspiciousApis.length
                                  ? selectedGraphNodeDetails.suspiciousApis
                                  : [t("interpretacao.noApisMappedFallback")]
                                ).map((api) => (
                                  <Badge key={api} variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:border-amber-400/25 dark:text-amber-200">{api}</Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      </LogEvidenceShellContext.Provider>
                      </LogEvidenceFileMetricsContext.Provider>
                    </TabsContent>

                    <TabsContent value="artifacts" className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {t("interpretacao.artifactsIntro")}
                      </p>
                      <div className="space-y-2">
                        {selectedDetail.artifacts.length ? (
                          selectedDetail.artifacts.flatMap((artifact) => {
                            const baseKey = `${artifact.artifactType}-${artifact.relativePath}`;
                            const canDownload = Boolean(artifact.downloadUrl || artifact.storageUrl);
                            const isReducedLog = artifact.artifactType === "reduced-log";
                            const linkClass = `flex items-center justify-between rounded-2xl border border-border bg-muted/80 p-4 transition dark:border-white/10 dark:bg-slate-950/70 ${canDownload ? "hover:border-cyan-400/30 hover:bg-cyan-500/10" : "pointer-events-none opacity-60"}`;

                            const rows: ReactNode[] = [
                              <a
                                key={baseKey}
                                href={artifact.downloadUrl ?? artifact.storageUrl ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                className={linkClass}
                              >
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {isReducedLog ? t("interpretacao.artifactReducedLogJson") : artifact.label}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {artifact.artifactType}
                                    {isReducedLog ? " · JSON" : ""} · {formatBytes(artifact.sizeBytes ?? undefined)}
                                  </p>
                                </div>
                                <FileDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              </a>,
                            ];

                            if (isReducedLog && selectedBatchId) {
                              const completedFiles = selectedDetail.fileMetrics.filter(
                                (m) => m.status === "completed" && m.fileName.trim().length > 0,
                              );
                              for (const fm of completedFiles) {
                                rows.push(
                                  <a
                                    key={`${baseKey}-txt-${fm.fileName}`}
                                    href={buildReducedLogTxtDownloadUrl(selectedBatchId, fm.fileName)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between rounded-2xl border border-border border-l-4 border-l-emerald-500/50 bg-muted/60 p-4 pl-3 transition hover:border-cyan-400/30 hover:bg-cyan-500/10 dark:border-white/10 dark:bg-slate-950/50"
                                  >
                                    <div className="min-w-0 pr-2">
                                      <p className="break-words text-sm font-medium text-foreground">
                                        {t("interpretacao.artifactReducedLogTxt", { file: fm.fileName })}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {t("interpretacao.artifactReducedLogTxtFormat")} ·{" "}
                                        {t("interpretacao.metricReductionHelper", { n: fm.reducedLineCount })}
                                      </p>
                                    </div>
                                    <FileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  </a>,
                                );
                              }
                            }

                            return rows;
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground">{t("interpretacao.noArtifacts")}</p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="events" className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-[1fr,220px]">
                        <Input
                          value={eventSearch}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => setEventSearch(event.target.value)}
                          placeholder={t("interpretacao.eventsFilterPlaceholder")}
                          className="border-border bg-background dark:bg-slate-950/80"
                        />
                        <div className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
                          {t("interpretacao.eventsCount", { n: filteredEvents.length })}
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-border bg-muted/30 dark:border-white/10 dark:bg-slate-950/40">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("interpretacao.thPhase")}</TableHead>
                              <TableHead>{t("interpretacao.thEvent")}</TableHead>
                              <TableHead>{t("interpretacao.thFile")}</TableHead>
                              <TableHead>{t("interpretacao.thApis")}</TableHead>
                              <TableHead>{t("interpretacao.thDetail")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredEvents.map((event, index) => {
                              const payload = asRecord(event.payloadJson);
                              const apis = Array.isArray(payload.suspiciousApis) ? payload.suspiciousApis as string[] : [];
                              return (
                                <TableRow key={`${event.eventType}-${index}-${String(event.createdAt)}`}>
                                  <TableCell>{event.stage ?? "—"}</TableCell>
                                  <TableCell>{event.eventType}</TableCell>
                                  <TableCell>{typeof payload.fileName === "string" ? payload.fileName : "—"}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-2">
                                      {apis.length ? apis.map((api) => (
                                        <Badge key={api} className="border-amber-500/35 bg-amber-500/10 text-amber-900 dark:border-amber-400/25 dark:text-amber-300">{api}</Badge>
                                      )) : <span className="text-muted-foreground">—</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-md text-muted-foreground">{event.message ?? "—"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("interpretacao.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("interpretacao.deleteConfirmDesc", { id: selectedBatchId ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBatchMutation.isPending}>{t("interpretacao.deleteCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBatchMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteBatch();
              }}
            >
              {deleteBatchMutation.isPending ? t("interpretacao.deletePending") : t("interpretacao.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function InterpretacaoConsolidada() {
  return (
    <DashboardLayout>
      <InterpretacaoConsolidadaContent />
    </DashboardLayout>
  );
}
