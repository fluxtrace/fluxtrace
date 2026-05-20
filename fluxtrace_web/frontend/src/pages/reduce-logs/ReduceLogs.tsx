import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes, formatDateTimeLocale, formatPercentFine, formatPercentRounded } from "@/lib/core/format";
import { isReduceLogsDebugEnabled } from "@/lib/reduce-logs/reduceLogsDebug";
import { downloadReduceLogsExcelWorkbook } from "@/lib/reduce-logs/reduceLogsExcelExport";
import {
  clearPersistedReduceLogsBatchId,
  clearReduceLogsPanelBrowserStorage,
  MAX_TRACKED_BATCHES,
  nextTrackedAfterPrepend,
  readSelectedBatchId,
  readTrackedBatchIds,
  writeSelectedBatchId,
  writeTrackedBatchIds,
} from "@/lib/reduce-logs/reduceLogsSession";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/api/trpc";
import {
  completeReduceLogsUpload,
  getReduceLogsUploadCapabilities,
  initReduceLogsUpload,
  type UploadCompletionFilePayload,
  uploadReduceLogsChunk,
  uploadReduceLogsLegacyWithProgress,
} from "@/services/analysisService";
import { normalizeOptionalSampleSha256 } from "@shared/virusTotal";
import {
  buildMonitoredFiles,
  getFileReductionDisplayPercent,
  getFileInterpretation,
  getFileRecommendation,
  inferLogType,
  isArchiveContainerFile,
  type FileMonitor,
  type ProcessingStatus,
  type SubmittedFileMonitor,
} from "./reduceLogsMonitor";
import {
  AlertTriangle,
  Database,
  Filter,
  FileArchive,
  FileDown,
  FileText,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import i18n from "@/i18n/config";
import type { TFunction } from "i18next";
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "wouter";

/** Lote “virtual” antes do servidor devolver o `batchId` (ctr-…), para acompanhar o envio ficheiro a ficheiro. */
/** Grelha de ficheiros: 12 colunas (incl. tempos envio/processamento antes da etapa actual). */
const FILE_TRACKING_GRID_12 =
  "grid w-full min-w-0 [grid-template-columns:minmax(0,1.08fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,0.48fr)_minmax(0,0.86fr)_minmax(0,0.35fr)_minmax(0,0.35fr)_minmax(0,0.32fr)_minmax(0,0.44fr)_minmax(0,0.35fr)_minmax(0,0.35fr)_minmax(0,0.35fr)] gap-0 text-xs [word-break:break-word]";
const fileTrackTh =
  "text-left min-w-0 border-r border-border/70 bg-muted/50 px-1.5 py-1.5 align-top text-[11px] font-medium leading-tight [overflow-wrap:anywhere] first:bg-muted first:dark:bg-slate-950 last:border-r-0 dark:border-white/10";
const fileTrackThNarrow = `${fileTrackTh} px-1 py-1 text-[10px]`;
const fileTrackTd =
  "text-left min-w-0 border-r border-border/70 px-1.5 py-1.5 align-top [overflow-wrap:anywhere] first:bg-muted first:font-medium first:text-foreground first:dark:bg-slate-950 last:border-r-0 dark:border-white/10";
const fileTrackTdNarrow = `${fileTrackTd} px-0.5 py-1 text-[10px]`;

const LOCAL_UPLOAD_LOT_ID = "__local-uploading__" as const;

/** Ficheiros muito grandes podem demorar minutos entre eventos de ficheiro; evita falso “travado” na UI. */
const STALE_NO_EVENT_MS = 120_000;
const STALE_NO_EVENT_MS_LARGE = 10 * 60_000;
const STALE_SIZE_THRESHOLD_BYTES = 100 * 1024 * 1024;

function fileNameBase(fileName: string) {
  const parts = fileName.split(/[/\\]/);
  return parts.at(-1) ?? fileName;
}

function buildReducedLogDownloadUrl(batchId: string, fileName: string) {
  return `/api/analysis-artifacts/reduced-log-by-file?${new URLSearchParams({ batchId, fileName }).toString()}`;
}

function buildPreservationReportDownloadUrl(batchId: string, fileName: string) {
  return `/api/analysis-artifacts/preservation-report?${new URLSearchParams({ batchId, fileName }).toString()}`;
}

function staleThresholdMsForFile(file: FileMonitor) {
  const big = Math.max(file.originalBytes ?? 0, file.sizeBytes ?? 0);
  return big >= STALE_SIZE_THRESHOLD_BYTES ? STALE_NO_EVENT_MS_LARGE : STALE_NO_EVENT_MS;
}

function getStatusLabel(status: string | null | undefined, t: TFunction) {
  switch (status) {
    case "queued":
      return t("reduceLogs.statusQueued");
    case "uploading":
      return t("reduceLogs.statusUploading");
    case "running":
      return t("reduceLogs.statusRunning");
    case "completed":
      return t("reduceLogs.statusCompleted");
    case "failed":
      return t("reduceLogs.statusFailed");
    case "cancelled":
      return t("reduceLogs.statusCancelled");
    default:
      return t("reduceLogs.statusNone");
  }
}

type LotStatusFilter = "all" | "active" | "completed" | "failed";

function resolveLotPanelStatus(
  lotId: string,
  batchRow: { status: string } | undefined,
  isUploading: boolean,
): string {
  if (lotId === LOCAL_UPLOAD_LOT_ID) {
    return isUploading ? "running" : "queued";
  }
  return batchRow?.status ?? "queued";
}

function lotMatchesPanelFilter(status: string, filter: LotStatusFilter) {
  if (filter === "all") return true;
  if (filter === "active") return status === "queued" || status === "running";
  if (filter === "completed") return status === "completed";
  if (filter === "failed") return status === "failed" || status === "cancelled";
  return true;
}

/** Encurta nomes de validação com SHA-64 para caber numa linha; mantém `full` para tooltip. */
function compactTrackedLotValidationName(raw: string, maxVisual = 72): { display: string; full: string } {
  const full = raw.trim();
  if (!full) return { display: "", full: "" };
  let display = full;
  const hex64 = /[a-fA-F0-9]{64}/;
  const m = hex64.exec(display);
  if (m) {
    const h = m[0];
    display = display.replace(h, `${h.slice(0, 8)}…${h.slice(-6)}`);
  }
  if (display.length > maxVisual) {
    display = `${display.slice(0, maxVisual - 1)}…`;
  }
  return { display, full };
}

function formatTrackedLotIdAbbrev(lotId: string): string {
  if (lotId.length <= 16) return lotId;
  return `${lotId.slice(0, 7)}…${lotId.slice(-6)}`;
}

function getProcessingStatusVisual(status?: string | null) {
  if (status === "completed") {
    return {
      badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
      row: "bg-emerald-500/5",
      label: "text-emerald-200",
      progressTone: "emerald" as const,
    };
  }
  if (status === "running") {
    return {
      badge: "border-cyan-400/35 bg-cyan-500/15 text-cyan-200",
      row: "bg-cyan-500/5",
      label: "text-cyan-200",
      progressTone: "cyan" as const,
    };
  }
  if (status === "queued" || status === "uploading") {
    return {
      badge: "border-amber-400/35 bg-amber-500/15 text-amber-200",
      row: "bg-amber-500/5",
      label: "text-amber-200",
      progressTone: "amber" as const,
    };
  }
  if (status === "failed") {
    return {
      badge: "border-rose-400/35 bg-rose-500/15 text-rose-200",
      row: "bg-rose-500/5",
      label: "text-rose-200",
      progressTone: "rose" as const,
    };
  }
  return {
    badge: "border-border bg-muted/50 text-muted-foreground dark:border-white/10 dark:bg-white/5",
    row: "",
    label: "text-muted-foreground",
    progressTone: "cyan" as const,
  };
}

/** Mesma paleta/estrutura que `getProcessingStatusVisual`, para a coluna Upload alinhar com Processamento. */
function getUploadStatusVisual(status?: string | null) {
  if (status === "completed") {
    return {
      badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
      label: "text-emerald-200",
      progressTone: "emerald" as const,
    };
  }
  if (status === "running") {
    return {
      badge: "border-cyan-400/35 bg-cyan-500/15 text-cyan-200",
      label: "text-cyan-200",
      progressTone: "cyan" as const,
    };
  }
  if (status === "queued" || status === "uploading") {
    return {
      badge: "border-amber-400/35 bg-amber-500/15 text-amber-200",
      label: "text-amber-200",
      progressTone: "amber" as const,
    };
  }
  if (status === "failed") {
    return {
      badge: "border-rose-400/35 bg-rose-500/15 text-rose-200",
      label: "text-rose-200",
      progressTone: "rose" as const,
    };
  }
  return {
    badge: "border-border bg-muted/50 text-muted-foreground dark:border-white/10 dark:bg-white/5",
    label: "text-muted-foreground",
    progressTone: "cyan" as const,
  };
}

function formatLastActivityLabel(value: Date | null | undefined, t: TFunction) {
  if (!value) return t("reduceLogs.activityNoneRecent");
  const diffMs = Date.now() - value.getTime();
  if (diffMs < 15000) return t("reduceLogs.activityNow");
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return t("reduceLogs.lastUpdateSeconds", { count: seconds });
  const minutes = Math.round(seconds / 60);
  return t("reduceLogs.lastUpdateMinutes", { count: minutes });
}

function formatElapsedMs(ms: number, t: TFunction) {
  const safe = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return t("reduceLogs.elapsedH", { h: hours, m: remainingMinutes });
  }
  if (minutes > 0) return t("reduceLogs.elapsedM", { m: minutes, s: seconds });
  return t("reduceLogs.elapsedS", { s: seconds });
}

/**
 * Tempo para o texto «nesta etapa» e heurísticas de atenção: em fila/processamento
 * prefere o pulso do último evento (actualiza em tempo real); lotes concluídos não mostram.
 */
function stageHintElapsedMs(
  processingStatus: FileMonitor["processingStatus"],
  stageSince: Date | undefined,
  lastEventAt: Date | undefined,
  uiNowMs: number,
): number {
  if (processingStatus === "completed" || processingStatus === "failed") {
    return 0;
  }
  if (
    processingStatus === "running"
    || processingStatus === "queued"
    || processingStatus === "uploading"
  ) {
    if (lastEventAt) return Math.max(0, uiNowMs - lastEventAt.getTime());
    if (stageSince) return Math.max(0, uiNowMs - stageSince.getTime());
    return 0;
  }
  if (stageSince) return Math.max(0, uiNowMs - stageSince.getTime());
  return 0;
}

type SemaforoKind = "failed" | "waiting" | "preserved" | "routine" | "analyzing";

function getSemaforoKind(file: FileMonitor): SemaforoKind {
  if (file.processingStatus === "failed") return "failed";
  if (file.processingStatus === "queued" || file.processingStatus === "uploading") return "waiting";
  if (file.triggerCount > 0 || file.suspiciousEventCount > 0) return "preserved";
  /* Concluído sem sinais destacados: não indica falha, apenas caso de rotina de leitura. */
  if (file.processingStatus === "completed") return "routine";
  return "analyzing";
}

function getSemaforoLabel(kind: SemaforoKind, t: TFunction) {
  const key =
    kind === "failed"
      ? "reduceLogs.semaforoFailed"
      : kind === "waiting"
        ? "reduceLogs.semaforoWaiting"
        : kind === "preserved"
          ? "reduceLogs.semaforoPreserved"
          : kind === "routine"
            ? "reduceLogs.semaforoRoutine"
            : "reduceLogs.semaforoAnalyzing";
  return t(key);
}

function getSemaforoToneClass(kind: SemaforoKind) {
  if (kind === "preserved") return "text-emerald-300";
  if (kind === "routine") return "text-cyan-200/90";
  if (kind === "failed") return "text-rose-200";
  return "text-muted-foreground";
}

const DEFAULT_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const STORAGE_CREDENTIALS_MISSING_FRAGMENT = "Storage proxy credentials missing";
const STAGE_WARNING_THRESHOLD_MS = 5 * 60 * 1000;

/** tRPC espera JSON; respostas com `<!DOCTYPE` indicam página HTML (502/503, timeout, proxy) em vez da API. */
function getDetailQueryErrorPresentation(message: string | undefined, t: TFunction): {
  headline: string;
  body: string;
  showTechnical: boolean;
} {
  const raw = String(message ?? "").trim();
  const looksLikeHtmlResponse =
    /Unexpected token ['"]<['"]/i.test(raw) || /DOCTYPE/i.test(raw) || /not valid JSON/i.test(raw);
  if (looksLikeHtmlResponse) {
    return {
      headline: t("reduceLogs.detailHtmlHeadline"),
      body: t("reduceLogs.detailHtmlBody"),
      showTechnical: true,
    };
  }
  return {
    headline: t("reduceLogs.detailGenericHeadline"),
    body: raw || t("reduceLogs.detailGenericFallback"),
    showTechnical: Boolean(raw && raw.length > 120),
  };
}

const REDUCE_LOGS_POLL_MS_KEY = "contradef.reduceLogsPollMs";
const DEFAULT_REDUCE_LOGS_POLL_MS = 5000;
const POLL_MS_OPTIONS = [2000, 5000, 10000, 30000, 60000] as const;

const LOG_FILE_ACCEPT = ".cdf,.csv,.json,.log,.txt,.7z,.zip,.rar";
const LOG_FILE_EXT = new Set(["cdf", "csv", "json", "log", "txt", "7z", "zip", "rar"]);
const RESTORE_BANNER_SESSION_KEY = "contradef_reduce_logs_restore_banner_ack";

function defaultReduceLogsAnalysisPrefix() {
  const lng = i18n.resolvedLanguage ?? i18n.language ?? "pt-BR";
  return i18n.getFixedT(lng)("reduceLogs.analysisNamePrefix");
}
function isAcceptedLogFile(file: File) {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  return LOG_FILE_EXT.has(ext);
}

function logFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function mergeSelectedLogFiles(prev: File[], incoming: File[]) {
  const map = new Map<string, File>();
  for (const f of prev) map.set(logFileKey(f), f);
  for (const f of incoming) {
    if (isAcceptedLogFile(f)) map.set(logFileKey(f), f);
  }
  return Array.from(map.values());
}

function buildInitialSubmittedFiles(files: File[]) {
  return files.map((file) => ({
    fileName: file.name,
    logType: inferLogType(file.name),
    sizeBytes: file.size,
    uploadProgress: 0,
    /** `uploading` logo ao submeter: evita "Na fila" na coluna de upload (confundia com fila de outro lote no servidor). Ainda 0% até `init` e primeiro bloco. */
    uploadStatus: "uploading" as ProcessingStatus,
  }));
}

function updateSubmittedFile(
  current: SubmittedFileMonitor[],
  fileName: string,
  patch: Partial<SubmittedFileMonitor>,
) {
  return current.map((file) => (file.fileName === fileName ? { ...file, ...patch } : file));
}

function isStorageCredentialsMissingError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes(STORAGE_CREDENTIALS_MISSING_FRAGMENT);
}

function formatFileProcessingPercent(p: number | null) {
  if (p == null) return "—";
  const x = Math.round(p * 10) / 10;
  return `${x % 1 === 0 ? x.toFixed(0) : x.toFixed(1)}%`;
}

function ProgressStrip({
  value,
  indeterminate,
  tone = "cyan",
  className,
}: {
  value: number;
  indeterminate?: boolean;
  tone?: "cyan" | "emerald" | "rose" | "amber";
  className?: string;
}) {
  const toneClass = tone === "emerald"
    ? "bg-emerald-400"
    : tone === "rose"
      ? "bg-rose-400"
      : tone === "amber"
        ? "bg-amber-400"
        : "bg-cyan-400";

  if (indeterminate) {
    return (
      <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-white/10", className)}>
        <div className={`${toneClass} h-full w-[38%] animate-pulse rounded-full`} />
      </div>
    );
  }

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-white/10", className)}>
      <div className={`${toneClass} h-full rounded-full transition-all duration-300`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof RefreshCw;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:shadow-slate-950/30">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

export default function ReduceLogs() {
  const { t, i18n } = useTranslation();
  const [analysisName, setAnalysisName] = useState(defaultReduceLogsAnalysisPrefix);
  const lastDefaultAnalysisPrefixRef = useRef(analysisName);

  useEffect(() => {
    const next = i18n.t("reduceLogs.analysisNamePrefix");
    const prev = lastDefaultAnalysisPrefixRef.current;
    lastDefaultAnalysisPrefixRef.current = next;
    setAnalysisName((cur) => (cur.trim() === prev.trim() ? next : cur));
  }, [i18n.language, i18n]);

  const timeLocale = i18n.language.startsWith("en") ? "en-US" : "pt-BR";

  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const logFilesInputRef = useRef<HTMLInputElement>(null);
  /** SHA-256 do executável/amostra (não dos logs); obrigatório para enviar o lote ao servidor. */
  const [sampleSha256Input, setSampleSha256Input] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [trackedBatchIds, setTrackedBatchIds] = useState<string[]>(() => (
    typeof window !== "undefined" ? readTrackedBatchIds() : []
  ));
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const ids = readTrackedBatchIds();
    const sel = readSelectedBatchId();
    if (sel && ids.includes(sel)) {
      return sel;
    }
    return ids[0] ?? null;
  });
  const [uploadSessionBatchId, setUploadSessionBatchId] = useState<string | null>(null);
  const [showRestoreHint, setShowRestoreHint] = useState(false);
  const [logDropHover, setLogDropHover] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  /** Mensagem de alto nível durante init/envio/completação (o usuário vê o que o servidor está a fazer). */
  const [uploadPipelineStatus, setUploadPipelineStatus] = useState<string | null>(null);
  /** Só no envio multipart directo: bytes enviados para a barra / % real (fetch não reporta; usamos XHR). */
  const [directMultipartBytes, setDirectMultipartBytes] = useState<{ loaded: number; total: number } | null>(null);
  const [submittedFiles, setSubmittedFiles] = useState<SubmittedFileMonitor[]>([]);
  const [activeFileTab, setActiveFileTab] = useState<string>("");
  const [uiNowMs, setUiNowMs] = useState(() => Date.now());
  const [fileQuickFilter, setFileQuickFilter] = useState<"all" | "stalled" | "running" | "completed">("all");
  const [sortByPriority, setSortByPriority] = useState(true);
  const [focusCriticalMode, setFocusCriticalMode] = useState(true);
  const [pollIntervalMs, setPollIntervalMs] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_REDUCE_LOGS_POLL_MS;
    try {
      const raw = window.localStorage.getItem(REDUCE_LOGS_POLL_MS_KEY);
      const n = raw ? parseInt(raw, 10) : NaN;
      return POLL_MS_OPTIONS.includes(n as (typeof POLL_MS_OPTIONS)[number]) ? n : DEFAULT_REDUCE_LOGS_POLL_MS;
    } catch {
      return DEFAULT_REDUCE_LOGS_POLL_MS;
    }
  });
  const [lotPanelSearchText, setLotPanelSearchText] = useState("");
  const [lotPanelStatusFilter, setLotPanelStatusFilter] = useState<LotStatusFilter>("all");
  const activityLogRef = useRef<HTMLPreElement | null>(null);

  const normalizedSampleSha256ForUi = useMemo(
    () => normalizeOptionalSampleSha256(sampleSha256Input.trim() || undefined),
    [sampleSha256Input],
  );
  /** Texto opcional só para UX (utilizador a escrever e ainda incompleto). */
  const sampleSha256InvalidHint = sampleSha256Input.trim().length > 0 && !normalizedSampleSha256ForUi;

  const resumeActiveSync = trpc.analysis.resumeActiveSync.useMutation({
    onSuccess: (data) => {
      const resumed = data?.resumedBatches ?? [];
      if (!resumed.length) {
        return;
      }
      setTrackedBatchIds((prev) => {
        const seen = new Set<string>();
        const merged: string[] = [];
        for (const id of [...resumed, ...prev]) {
          if (seen.has(id)) continue;
          seen.add(id);
          merged.push(id);
        }
        return merged.slice(0, MAX_TRACKED_BATCHES);
      });
    },
  });
  const deleteBatchMutation = trpc.analysis.deleteBatch.useMutation();

  useEffect(() => {
    resumeActiveSync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!readTrackedBatchIds().length) return;
    try {
      if (sessionStorage.getItem(RESTORE_BANNER_SESSION_KEY) === "1") return;
    } catch {
      /* private mode */
    }
    setShowRestoreHint(true);
  }, []);

  useEffect(() => {
    writeTrackedBatchIds(trackedBatchIds);
  }, [trackedBatchIds]);

  useEffect(() => {
    writeSelectedBatchId(selectedBatchId);
  }, [selectedBatchId]);

  useEffect(() => {
    if (!trackedBatchIds.length) {
      if (selectedBatchId !== null) {
        setSelectedBatchId(null);
      }
      return;
    }
    if (selectedBatchId && trackedBatchIds.includes(selectedBatchId)) {
      return;
    }
    setSelectedBatchId(trackedBatchIds[0] ?? null);
  }, [trackedBatchIds, selectedBatchId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setUiNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const batchListQuery = trpc.analysis.list.useQuery(
    { limit: 100 },
    { refetchInterval: 10_000, enabled: Boolean(user && !authLoading) },
  );

  const batchRowById = useMemo(() => {
    const map = new Map<
      string,
      { sampleName: string; status: string; progress: number; createdByUserId: number | null }
    >();
    for (const row of batchListQuery.data ?? []) {
      const created = row.createdByUserId;
      map.set(row.batchId, {
        sampleName: String(row.sampleName ?? "").trim() || row.batchId,
        status: String(row.status ?? ""),
        progress: Number(row.progress ?? 0) || 0,
        createdByUserId: typeof created === "number" && Number.isFinite(created) ? created : null,
      });
    }
    return map;
  }, [batchListQuery.data]);

  const selectedListRow = useMemo(
    () => (selectedBatchId && selectedBatchId !== LOCAL_UPLOAD_LOT_ID ? batchRowById.get(selectedBatchId) : undefined),
    [selectedBatchId, batchRowById],
  );

  const visibleTrackedLotIds = useMemo(() => {
    const q = lotPanelSearchText.trim().toLowerCase();
    return trackedBatchIds.filter((lotId) => {
      const row = batchRowById.get(lotId);
      const st = resolveLotPanelStatus(lotId, row, isUploading);
      if (!lotMatchesPanelFilter(st, lotPanelStatusFilter)) return false;
      if (!q) return true;
      if (lotId.toLowerCase().includes(q)) return true;
      const nameRaw = lotId === LOCAL_UPLOAD_LOT_ID ? analysisName : (row?.sampleName ?? "");
      return nameRaw.toLowerCase().includes(q);
    });
  }, [trackedBatchIds, batchRowById, lotPanelSearchText, lotPanelStatusFilter, isUploading, analysisName]);

  const lotPanelFilterExcludesEverything = trackedBatchIds.length > 0 && visibleTrackedLotIds.length === 0;

  useEffect(() => {
    if (!visibleTrackedLotIds.length) return;
    if (selectedBatchId && visibleTrackedLotIds.includes(selectedBatchId)) return;
    setSelectedBatchId(visibleTrackedLotIds[0] ?? null);
  }, [visibleTrackedLotIds, selectedBatchId]);

  const isLocalUploadLotSelected = selectedBatchId === LOCAL_UPLOAD_LOT_ID;

  const submittedDetailQuery = trpc.analysis.detail.useQuery(
    { batchId: isLocalUploadLotSelected ? "skip-local" : (selectedBatchId ?? "") },
    {
      enabled: Boolean(selectedBatchId) && !isLocalUploadLotSelected,
      refetchInterval: (query) => {
        const status = query.state.data?.batch.status;
        return status === "running" || status === "queued" ? pollIntervalMs : false;
      },
    },
  );

  const uploadedDetail = isLocalUploadLotSelected ? null : (submittedDetailQuery.data ?? null);

  const canServerDeleteBatch = useCallback(
    (lotId: string) => {
      if (authLoading || !user) return false;
      if (lotId === LOCAL_UPLOAD_LOT_ID) return false;
      if (lotId === uploadSessionBatchId) return true;
      const row = batchRowById.get(lotId);
      if (row?.createdByUserId != null && row.createdByUserId === user.id) return true;
      if (
        selectedBatchId === lotId
        && uploadedDetail?.batch.createdByUserId != null
        && uploadedDetail.batch.createdByUserId === user.id
      ) {
        return true;
      }
      return false;
    },
    [
      authLoading,
      user,
      uploadSessionBatchId,
      batchRowById,
      selectedBatchId,
      uploadedDetail?.batch.createdByUserId,
    ],
  );

  useEffect(() => {
    const el = activityLogRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [uploadedDetail?.batch?.stdoutTail, uploadedDetail?.batch?.message]);

  const hasRemoteArtifacts = Boolean(
    uploadedDetail?.artifacts?.some((artifact) => Boolean(artifact.storageUrl)),
  );
  const showsLocalStorageModeBadge = Boolean(
    uploadedDetail
    && (uploadedDetail.batch.status === "completed" || uploadedDetail.batch.status === "failed")
    && !hasRemoteArtifacts,
  );

  useEffect(() => {
    if (!isReduceLogsDebugEnabled()) return;
    if (!selectedBatchId) return;
    if (submittedDetailQuery.isError) {
      console.warn("[ReduceLogs:detail]", "erro ao obter detalhe do lote", {
        batchId: selectedBatchId,
        error: submittedDetailQuery.error,
      });
      return;
    }
    if (!uploadedDetail) return;
    const newest = uploadedDetail.events[0];
    console.info("[ReduceLogs:detail:poll]", {
      batchId: selectedBatchId,
      responseReceivedAt: submittedDetailQuery.dataUpdatedAt
        ? new Date(submittedDetailQuery.dataUpdatedAt).toISOString()
        : null,
      fetchStatus: submittedDetailQuery.fetchStatus,
      isFetching: submittedDetailQuery.isFetching,
      batchSnapshot: {
        status: uploadedDetail.batch.status,
        progress: uploadedDetail.batch.progress,
        stage: uploadedDetail.batch.stage,
        rowUpdatedAt: formatDateTimeLocale(uploadedDetail.batch.updatedAt),
      },
      newestEvent: newest
        ? {
            at: formatDateTimeLocale(newest.createdAt),
            stage: newest.stage,
            type: newest.eventType,
            progress: newest.progress,
          }
        : null,
      fileMetrics: uploadedDetail.fileMetrics.map((f) => ({
        file: f.fileName,
        status: f.status,
        progress: f.progress,
        stage: f.currentStage,
      })),
      serverProcessDebug: uploadedDetail.serverProcessDebug ?? null,
    });
  }, [
    selectedBatchId,
    uploadedDetail,
    submittedDetailQuery.dataUpdatedAt,
    submittedDetailQuery.fetchStatus,
    submittedDetailQuery.isFetching,
    submittedDetailQuery.isError,
    submittedDetailQuery.error,
  ]);

  const includeSubmittedFilesInMerge = Boolean(
    uploadSessionBatchId && selectedBatchId && uploadSessionBatchId === selectedBatchId,
  );

  const localUploadAverageProgress = useMemo(() => {
    if (!submittedFiles.length) {
      return 0;
    }
    return Math.round(submittedFiles.reduce((s, f) => s + f.uploadProgress, 0) / submittedFiles.length);
  }, [submittedFiles]);

  const isOnlyArchiveSubmission = useMemo(
    () => submittedFiles.length > 0 && submittedFiles.every((f) => isArchiveContainerFile(f.fileName)),
    [submittedFiles],
  );

  const monitoredFiles = useMemo(
    () => buildMonitoredFiles(
      includeSubmittedFilesInMerge ? submittedFiles : [],
      uploadedDetail?.fileMetrics ?? [],
    ),
    [includeSubmittedFilesInMerge, submittedFiles, uploadedDetail],
  );

  /**
   * Mostra o painel (métricas, tabs) mesmo com 0 ficheiros quando a lista (poll) ainda conhece o lote no servidor
   * e o `detail` falhou — evita deixar só a faixa de erro a substituir todo o acompanhamento.
   */
  const showMainMonitoringPanel = useMemo(
    () => Boolean(
      monitoredFiles.length
      || (submittedDetailQuery.isError && !isLocalUploadLotSelected && selectedBatchId && selectedListRow),
    ),
    [monitoredFiles.length, submittedDetailQuery.isError, isLocalUploadLotSelected, selectedBatchId, selectedListRow],
  );

  /** Primeira resposta do `detail` ainda não chegou (servidor a responder ou instância a acordar). */
  const monitorDetailLoading = Boolean(
    selectedBatchId &&
    !isLocalUploadLotSelected &&
    !monitoredFiles.length &&
    !uploadedDetail &&
    (submittedDetailQuery.isLoading || submittedDetailQuery.isPending) &&
    !submittedDetailQuery.isError,
  );

  /** O lote existe mas ainda não há linhas de ficheiro (ex.: .7z a extrair no servidor, ou fila a aquecer). */
  const showBatchStatusWithoutFileTable = Boolean(
    selectedBatchId &&
    uploadedDetail &&
    !monitoredFiles.length &&
    !submittedDetailQuery.isError,
  );

  const batchSummary = useMemo(() => {
    if (!monitoredFiles.length) return null;

    const completedFiles = monitoredFiles.filter((file) => file.processingStatus === "completed").length;
    const runningFiles = monitoredFiles.filter((file) => file.processingStatus === "running").length;
    const failedFiles = monitoredFiles.filter((file) => file.processingStatus === "failed").length;
    const totalOriginalBytes = monitoredFiles.reduce((sum, file) => sum + file.originalBytes, 0);
    const totalReducedBytes = monitoredFiles.reduce((sum, file) => sum + file.reducedBytes, 0);
    const totalOriginalLines = monitoredFiles.reduce((sum, file) => sum + file.originalLineCount, 0);
    const totalReducedLines = monitoredFiles.reduce((sum, file) => sum + file.reducedLineCount, 0);
    const discardedLines = Math.max(0, totalOriginalLines - totalReducedLines);
    const suspiciousCount = monitoredFiles.reduce((sum, file) => sum + file.suspiciousEventCount, 0);
    const triggerCount = monitoredFiles.reduce((sum, file) => sum + file.triggerCount, 0);
    const doneFiles = monitoredFiles.filter((f) => f.processingStatus === "completed");
    const doneOrig = doneFiles.reduce((s, f) => s + f.originalBytes, 0);
    const doneRed = doneFiles.reduce((s, f) => s + f.reducedBytes, 0);
    const reductionPercent = doneOrig > 0 ? 100 * (1 - doneRed / doneOrig) : 0;
    const totalUploadMs = monitoredFiles.reduce((sum, file) => sum + file.uploadDurationMs, 0);
    const totalProcessingMs = monitoredFiles.reduce((sum, file) => sum + file.processingDurationMs, 0);
    const totalWallMs = totalUploadMs + totalProcessingMs;

    return {
      completedFiles,
      runningFiles,
      failedFiles,
      totalOriginalBytes,
      totalReducedBytes,
      totalOriginalLines,
      totalReducedLines,
      discardedLines,
      suspiciousCount,
      triggerCount,
      reductionPercent,
      totalUploadMs,
      totalProcessingMs,
      totalWallMs,
    };
  }, [monitoredFiles]);

  const fileLastEventAtMap = useMemo(() => {
    const map = new Map<string, Date>();
    (uploadedDetail?.events ?? []).forEach((event) => {
      const payload = event.payloadJson && !Array.isArray(event.payloadJson) ? event.payloadJson as Record<string, unknown> : null;
      const fileName = typeof payload?.fileName === "string" ? payload.fileName : null;
      if (!fileName || !event.createdAt) return;
      const createdAt = new Date(event.createdAt);
      if (!Number.isFinite(createdAt.getTime())) return;
      const previous = map.get(fileName);
      if (!previous || createdAt > previous) {
        map.set(fileName, createdAt);
      }
    });
    const summaryBatch = uploadedDetail?.batch;
    if (summaryBatch?.status === "running" && summaryBatch.updatedAt) {
      const pulse = new Date(summaryBatch.updatedAt);
      if (Number.isFinite(pulse.getTime())) {
        const hay = `${summaryBatch.message ?? ""}\n${summaryBatch.stdoutTail ?? ""}`;
        (uploadedDetail?.fileMetrics ?? []).forEach((file) => {
          if (file.status !== "running" && file.status !== "queued") return;
          const base = fileNameBase(file.fileName);
          if (!hay.includes(file.fileName) && !hay.includes(base)) return;
          const prev = map.get(file.fileName);
          if (!prev || pulse > prev) {
            map.set(file.fileName, pulse);
          }
        });
      }
    }
    return map;
  }, [uploadedDetail?.events, uploadedDetail?.batch, uploadedDetail?.fileMetrics]);
  const fileCurrentStageSinceMap = useMemo(() => {
    const map = new Map<string, Date>();
    const stageMap = new Map<string, string>();
    const events = [...(uploadedDetail?.events ?? [])].sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return leftTime - rightTime;
    });

    events.forEach((event) => {
      const payload = event.payloadJson && !Array.isArray(event.payloadJson) ? event.payloadJson as Record<string, unknown> : null;
      const fileName = typeof payload?.fileName === "string" ? payload.fileName : null;
      const currentStage = typeof payload?.currentStage === "string"
        ? payload.currentStage
        : typeof event.stage === "string"
          ? event.stage
          : null;
      if (!fileName || !currentStage || !event.createdAt) return;
      const createdAt = new Date(event.createdAt);
      if (!Number.isFinite(createdAt.getTime())) return;
      const previousStage = stageMap.get(fileName);
      if (previousStage !== currentStage) {
        stageMap.set(fileName, currentStage);
        map.set(fileName, createdAt);
      }
    });
    return map;
  }, [uploadedDetail?.events]);
  const staleRunningFiles = useMemo(() => monitoredFiles.filter((file) => {
    if (file.processingStatus !== "running") return false;
    const lastEventAt = fileLastEventAtMap.get(file.fileName);
    if (!lastEventAt) return true;
    return uiNowMs - lastEventAt.getTime() > staleThresholdMsForFile(file);
  }), [fileLastEventAtMap, monitoredFiles, uiNowMs]);
  const stalledFileNameSet = useMemo(() => {
    const set = new Set<string>();
    monitoredFiles.forEach((file) => {
      if (file.processingStatus !== "running") return;
      const lastEventAt = fileLastEventAtMap.get(file.fileName);
      const stageSince = fileCurrentStageSinceMap.get(file.fileName);
      const stageElapsedMs = stageHintElapsedMs(file.processingStatus, stageSince, lastEventAt, uiNowMs);
      const noRecentActivity = !lastEventAt || (uiNowMs - lastEventAt.getTime() > staleThresholdMsForFile(file));
      if (noRecentActivity || stageElapsedMs > STAGE_WARNING_THRESHOLD_MS) {
        set.add(file.fileName);
      }
    });
    return set;
  }, [fileCurrentStageSinceMap, fileLastEventAtMap, monitoredFiles, uiNowMs]);
  const priorityScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    monitoredFiles.forEach((file) => {
      const stalled = stalledFileNameSet.has(file.fileName) ? 1 : 0;
      const score = stalled * 1000 + (file.triggerCount * 5) + (file.suspiciousEventCount * 2) + (file.processingStatus === "running" ? 50 : 0);
      map.set(file.fileName, score);
    });
    return map;
  }, [monitoredFiles, stalledFileNameSet]);
  const priorityScoredFiles = useMemo(
    () => [...monitoredFiles].sort((left, right) => (priorityScoreMap.get(right.fileName) ?? 0) - (priorityScoreMap.get(left.fileName) ?? 0)),
    [monitoredFiles, priorityScoreMap],
  );
  const criticalFocusCandidate = useMemo(
    () => priorityScoredFiles.find((file) => stalledFileNameSet.has(file.fileName) || file.triggerCount > 0 || file.suspiciousEventCount > 0 || file.processingStatus === "running") ?? null,
    [priorityScoredFiles, stalledFileNameSet],
  );
  const filteredMonitoredFiles = useMemo(() => {
    if (fileQuickFilter === "stalled") return monitoredFiles.filter((file) => stalledFileNameSet.has(file.fileName));
    if (fileQuickFilter === "running") return monitoredFiles.filter((file) => file.processingStatus === "running");
    if (fileQuickFilter === "completed") return monitoredFiles.filter((file) => file.processingStatus === "completed");
    return monitoredFiles;
  }, [fileQuickFilter, monitoredFiles, stalledFileNameSet]);
  const visibleMonitoredFiles = useMemo(() => {
    if (!sortByPriority) return filteredMonitoredFiles;
    const scored = [...filteredMonitoredFiles];
    scored.sort((left, right) => {
      const leftScore = priorityScoreMap.get(left.fileName) ?? 0;
      const rightScore = priorityScoreMap.get(right.fileName) ?? 0;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return left.fileName.localeCompare(right.fileName);
    });
    return scored;
  }, [filteredMonitoredFiles, priorityScoreMap, sortByPriority]);
  const activeFile = visibleMonitoredFiles.find((file) => file.fileName === activeFileTab) ?? visibleMonitoredFiles[0] ?? null;

  useEffect(() => {
    if (!focusCriticalMode || !criticalFocusCandidate) return;
    if (activeFileTab === criticalFocusCandidate.fileName) return;
    const activeScore = activeFileTab ? (priorityScoreMap.get(activeFileTab) ?? -1) : -1;
    const candidateScore = priorityScoreMap.get(criticalFocusCandidate.fileName) ?? -1;
    if (candidateScore >= activeScore + 100) {
      setActiveFileTab(criticalFocusCandidate.fileName);
    }
  }, [activeFileTab, criticalFocusCandidate, focusCriticalMode, priorityScoreMap]);

  useEffect(() => {
    if (!activeFileTab && visibleMonitoredFiles[0]?.fileName) {
      setActiveFileTab(visibleMonitoredFiles[0].fileName);
      return;
    }

    if (activeFileTab && !visibleMonitoredFiles.some((file) => file.fileName === activeFileTab) && visibleMonitoredFiles[0]?.fileName) {
      setActiveFileTab(visibleMonitoredFiles[0].fileName);
    }
  }, [activeFileTab, visibleMonitoredFiles]);

  const activeFileEvents = useMemo(() => {
    if (!activeFile || !uploadedDetail?.events) return [];
    return uploadedDetail.events
      .filter((event) => {
        const payload = event.payloadJson && !Array.isArray(event.payloadJson) ? event.payloadJson as Record<string, unknown> : null;
        return payload?.fileName === activeFile.fileName;
      })
      .slice(-8);
  }, [activeFile, uploadedDetail?.events]);

  function handleExportReduceLogsExcel() {
    if (selectedBatchId === LOCAL_UPLOAD_LOT_ID) {
      toast.error(t("reduceLogs.toastExportWaitBatch"));
      return;
    }
    if (!monitoredFiles.length) {
      toast.error(t("reduceLogs.toastNoFilesExport"));
      return;
    }
    const fileExtra = new Map<string, { lastActivity: string; timeInStage: string }>();
    for (const file of monitoredFiles) {
      const lastEventAt = fileLastEventAtMap.get(file.fileName);
      fileExtra.set(file.fileName, {
        lastActivity: formatLastActivityLabel(lastEventAt, t),
        timeInStage: (() => {
          const ms = stageHintElapsedMs(
            file.processingStatus,
            fileCurrentStageSinceMap.get(file.fileName),
            lastEventAt,
            uiNowMs,
          );
          return ms > 0 ? formatElapsedMs(ms, t) : "";
        })(),
      });
    }
    const batchDisplayName = uploadedDetail?.batch.sampleName?.trim() || analysisName.trim() || "—";
    try {
      downloadReduceLogsExcelWorkbook({
        batchId: selectedBatchId,
        batchDisplayName,
        files: monitoredFiles,
        fileExtra,
      });
      toast.success(t("reduceLogs.toastExcelOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reduceLogs.toastExcelFail"));
    }
  }

  function registerNewBatchInPanel(batchId: string) {
    setTrackedBatchIds((prev) => {
      const withoutPending = prev.filter((x) => x !== LOCAL_UPLOAD_LOT_ID);
      return nextTrackedAfterPrepend(batchId, withoutPending);
    });
    setSelectedBatchId(batchId);
    setUploadSessionBatchId(batchId);
    void utils.analysis.list.invalidate();
  }

  function stripLocalUploadPlaceholder() {
    setTrackedBatchIds((prev) => prev.filter((id) => id !== LOCAL_UPLOAD_LOT_ID));
    setUploadSessionBatchId((u) => (u === LOCAL_UPLOAD_LOT_ID ? null : u));
  }

  function afterRemoveFromPanelState(batchId: string) {
    setTrackedBatchIds((prev) => prev.filter((x) => x !== batchId));
    if (uploadSessionBatchId === batchId) {
      setUploadSessionBatchId(null);
    }
    if (showRestoreHint) {
      setShowRestoreHint(false);
    }
    try {
      sessionStorage.setItem(RESTORE_BANNER_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function removeFromPanelLocalOnly(batchId: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        t("reduceLogs.confirmRemovePanel"),
      )
    ) {
      return;
    }
    afterRemoveFromPanelState(batchId);
    toast.message(t("reduceLogs.toastRemovedPanel"), {
      description: t("reduceLogs.toastRemovedPanelDescPersist"),
    });
  }

  async function removeMyLotFromServerAndPanel(batchId: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        t("reduceLogs.confirmDeleteBatch"),
      )
    ) {
      return;
    }
    try {
      await deleteBatchMutation.mutateAsync({ batchId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reduceLogs.toastDeletedFail"));
      return;
    }
    afterRemoveFromPanelState(batchId);
    void utils.analysis.list.invalidate();
    void utils.analysis.detail.invalidate({ batchId });
    toast.success(t("reduceLogs.toastDeletedOk"));
  }

  function dismissAllTrackedLots() {
    setTrackedBatchIds([]);
    setSelectedBatchId(null);
    setUploadSessionBatchId(null);
    setSubmittedFiles([]);
    setActiveFileTab("");
    setShowRestoreHint(false);
    try {
      sessionStorage.setItem(RESTORE_BANNER_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    clearPersistedReduceLogsBatchId();
    clearReduceLogsPanelBrowserStorage();
    toast.message(t("reduceLogs.toastClearedLocals"), {
      description: t("reduceLogs.toastClearedLocalsPersist"),
    });
  }

  function handleLogFilesInputChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = Array.from(event.target.files ?? []);
    const picked = raw.filter(isAcceptedLogFile);
    setSelectedFiles(picked);
    event.target.value = "";
    if (!picked.length && raw.length > 0) {
      toast.message(t("reduceLogs.toastNoAcceptedFiles"), {
        description: t("reduceLogs.toastAcceptedExtensions"),
      });
    }
  }

  function handleLogDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isUploading) setLogDropHover(true);
  }

  function handleLogDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setLogDropHover(false);
  }

  function handleLogDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setLogDropHover(false);
    if (isUploading) return;
    const picked = Array.from(event.dataTransfer.files ?? []).filter(isAcceptedLogFile);
    if (!picked.length) {
      toast.message(t("reduceLogs.toastNoAcceptedFiles"), {
        description: t("reduceLogs.toastNoAcceptDrag"),
      });
      return;
    }
    setSelectedFiles((prev) => mergeSelectedLogFiles(prev, picked));
  }

  async function handleReductionSubmit() {
    const submissionHash = normalizeOptionalSampleSha256(sampleSha256Input.trim() || undefined);
    if (!submissionHash) {
      toast.error(t("reduceLogs.toastShaInvalid"));
      return;
    }

    if (!selectedFiles.length) {
      toast.error(t("reduceLogs.toastPickFiles"));
      return;
    }

    if (!analysisName.trim()) {
      toast.error(t("reduceLogs.toastNameValidation"));
      return;
    }

    if (selectedFiles.some((file) => file.size <= 0)) {
      toast.error(t("reduceLogs.toastEmptyFiles"));
      return;
    }

    setIsUploading(true);
    setUploadPipelineStatus(t("reduceLogs.uploadPrepFileList"));

    setUploadSessionBatchId(LOCAL_UPLOAD_LOT_ID);
    setSelectedBatchId(LOCAL_UPLOAD_LOT_ID);
    setTrackedBatchIds((prev) => {
      if (prev.includes(LOCAL_UPLOAD_LOT_ID)) {
        return prev;
      }
      return [LOCAL_UPLOAD_LOT_ID, ...prev].slice(0, MAX_TRACKED_BATCHES);
    });

    const initialBatch = buildInitialSubmittedFiles(selectedFiles);
    setSubmittedFiles(initialBatch);
    setActiveFileTab(initialBatch[0]?.fileName ?? "");

    try {
      setDirectMultipartBytes(null);
      const submissionInput = {
        analysisName: analysisName.trim(),
        focusTerms: "",
        focusRegexes: "",
        origin: window.location.origin,
        sampleSha256: submissionHash,
      };

      const runLegacyMultipart = async () => {
        const lotBytes = selectedFiles.reduce((s, f) => s + f.size, 0);
        setDirectMultipartBytes({ loaded: 0, total: lotBytes });
        const legacyPayload = await uploadReduceLogsLegacyWithProgress(
          { ...submissionInput, files: selectedFiles },
          ({ loaded, total, percent }) => {
            setDirectMultipartBytes({ loaded, total: total > 0 ? total : lotBytes });
            setSubmittedFiles((current) => current.map((file) => ({
              ...file,
              uploadProgress: percent,
              uploadStatus: "uploading" as ProcessingStatus,
            })));
          },
        );
        setSubmittedFiles((current) => current.map((file) => ({
          ...file,
          uploadProgress: 100,
          uploadStatus: "completed",
          uploadReused: false,
        })));
        setDirectMultipartBytes({ loaded: lotBytes, total: lotBytes });
        return legacyPayload;
      };

      setUploadPipelineStatus(t("reduceLogs.uploadStatusGettingDefs"));
      const capabilities = await getReduceLogsUploadCapabilities().catch(() => null);
      const shouldUseLegacy = capabilities?.storageConfigured === false;

      if (shouldUseLegacy) {
        setUploadPipelineStatus(t("reduceLogs.uploadStatusDirect"));
        const legacyPayload = await runLegacyMultipart();
        const legacyBatchId = legacyPayload?.batch?.batchId ?? null;
        toast.success(t("reduceLogs.toastUploadForgeDirect"), {
          description: t("reduceLogs.toastUploadForgeDirectDesc"),
        });
        setSelectedFiles([]);

        if (legacyBatchId) {
        setUploadPipelineStatus(t("reduceLogs.uploadSyncPanelBatch"));
          registerNewBatchInPanel(legacyBatchId);
          await utils.analysis.detail.invalidate({ batchId: legacyBatchId });
        }

        return;
      }

      setUploadPipelineStatus(t("reduceLogs.uploadStatusInitSession"));
      const initPayload = await initReduceLogsUpload({
        ...submissionInput,
        files: selectedFiles.map((file) => ({
          fileName: file.name,
          sizeBytes: file.size,
          logType: inferLogType(file.name),
          lastModifiedMs: file.lastModified,
        })),
      }).catch(async (error) => {
        if (!isStorageCredentialsMissingError(error)) {
          throw error;
        }

        // Local/dev fallback: use the legacy multipart route when shared storage is not configured.
        setUploadPipelineStatus(t("reduceLogs.uploadStatusDirect"));
        const legacyPayload = await runLegacyMultipart();
        const legacyBatchId = legacyPayload?.batch?.batchId ?? null;
        toast.success(t("reduceLogs.toastUploadForgeDirect"), {
          description: t("reduceLogs.toastUploadForgeDirectDesc"),
        });
        setSelectedFiles([]);

        if (legacyBatchId) {
        setUploadPipelineStatus(t("reduceLogs.uploadSyncPanelBatch"));
          registerNewBatchInPanel(legacyBatchId);
          await utils.analysis.detail.invalidate({ batchId: legacyBatchId });
        }

        return null;
      });
      if (!initPayload) {
        stripLocalUploadPlaceholder();
        return;
      }

      setUploadPipelineStatus(t("reduceLogs.uploadForgeChunkFiles"));
      const chunkSizeBytes = Math.min(initPayload.maxChunkBytes || DEFAULT_CHUNK_SIZE_BYTES, DEFAULT_CHUNK_SIZE_BYTES);

      const completionFilesPayload: UploadCompletionFilePayload[] = [];

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        const remoteFile = initPayload.files[index];
        if (!remoteFile) {
          throw new Error(t("reduceLogs.uploadChunkSessionMissing", { fileName: file.name }));
        }

        const isReused = Boolean(remoteFile.reused);
        const expectedChunkCount = remoteFile.chunkCount ?? Math.ceil(file.size / chunkSizeBytes);

        if (isReused) {
          flushSync(() => {
            setSubmittedFiles((current) => updateSubmittedFile(current, file.name, {
              uploadFileId: remoteFile.fileId,
              uploadStatus: "completed",
              uploadProgress: 100,
              uploadDurationMs: 0,
              uploadReused: true,
            }));
          });

          completionFilesPayload.push({
            fileId: remoteFile.fileId,
            fileName: remoteFile.fileName,
            sizeBytes: remoteFile.sizeBytes,
            logType: remoteFile.logType,
            chunkCount: expectedChunkCount,
            lastModifiedMs: file.lastModified,
            uploadDurationMs: 0,
            reused: true,
            storageSessionId: remoteFile.storageSessionId,
            storageFileId: remoteFile.storageFileId,
          });
          continue;
        }

        flushSync(() => {
          setSubmittedFiles((current) => updateSubmittedFile(current, file.name, {
            uploadFileId: remoteFile.fileId,
            uploadStatus: "uploading",
            uploadProgress: 0,
            uploadReused: false,
            uploadDurationMs: 0,
          }));
        });
        setUploadPipelineStatus(
          t("reduceLogs.uploadSendingPct0", { name: file.name, i: index + 1, n: selectedFiles.length }),
        );

        const uploadStartedAt = Date.now();
        let sentBytes = 0;
        let chunkIndex = 0;

        while (sentBytes < file.size) {
          const nextBoundary = Math.min(file.size, sentBytes + chunkSizeBytes);
          const chunk = file.slice(sentBytes, nextBoundary);
          const chunkPayload = await uploadReduceLogsChunk(initPayload.sessionId, remoteFile.fileId, chunkIndex, chunk);

          sentBytes = nextBoundary;
          chunkIndex += 1;
          const uploadDurationMs = Date.now() - uploadStartedAt;
          const pct = Math.round((sentBytes / file.size) * 100);
          if (chunkIndex % 2 === 0 || sentBytes >= file.size) {
            setUploadPipelineStatus(
              t("reduceLogs.uploadSendingNamedPct", {
                name: file.name,
                i: index + 1,
                n: selectedFiles.length,
                pct,
              }),
            );
          }

          flushSync(() => {
            setSubmittedFiles((current) => updateSubmittedFile(current, file.name, {
              uploadStatus: sentBytes >= file.size ? "completed" : "uploading",
              uploadProgress: typeof chunkPayload.uploadProgress === "number"
                ? chunkPayload.uploadProgress
                : Math.round((sentBytes / file.size) * 100),
              uploadDurationMs,
              uploadReused: false,
            }));
          });
        }

        completionFilesPayload.push({
          fileId: remoteFile.fileId,
          fileName: file.name,
          sizeBytes: file.size,
          logType: inferLogType(file.name),
          chunkCount: expectedChunkCount,
          lastModifiedMs: file.lastModified,
          uploadDurationMs: Date.now() - uploadStartedAt,
          reused: false,
          storageSessionId: remoteFile.storageSessionId,
          storageFileId: remoteFile.storageFileId,
        });
      }

      setUploadPipelineStatus(t("reduceLogs.uploadStatusFinalize"));
      const payload = await completeReduceLogsUpload({
        sessionId: initPayload.sessionId,
        ...submissionInput,
        files: completionFilesPayload,
      });

      setSubmittedFiles((current) => current.map((file) => ({
        ...file,
        uploadProgress: 100,
        uploadStatus: "completed",
      })));

      const batchId = payload?.batch?.batchId ?? null;
      toast.success(t("reduceLogs.toastUploadStarted"));
      setSelectedFiles([]);

      if (batchId) {
        setUploadPipelineStatus(t("reduceLogs.pipelineOpenDetail"));
        registerNewBatchInPanel(batchId);
        await utils.analysis.detail.invalidate({ batchId });
        await utils.analysis.list.invalidate();
      } else {
        setUploadPipelineStatus(t("reduceLogs.toastNoBatchId"));
      }
    } catch (error) {
      stripLocalUploadPlaceholder();
      setSubmittedFiles((current) => current.map((file) => ({
        ...file,
        uploadStatus: file.uploadProgress > 0 && file.uploadProgress >= 100 ? file.uploadStatus : "failed",
      })));
      toast.error(error instanceof Error ? error.message : t("reduceLogs.toastReductionFail"));
    } finally {
      setIsUploading(false);
      setUploadPipelineStatus(null);
      setDirectMultipartBytes(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 space-y-6 text-foreground">
        <section>
          <Card className="border-border bg-card text-card-foreground shadow-md dark:border-white/10 dark:bg-slate-950/80 dark:shadow-2xl dark:shadow-cyan-950/20">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border-cyan-500/35 bg-cyan-500/15 text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-500/10 dark:text-cyan-300">
                  {t("reduceLogs.badgePage")}
                </Badge>
                <Badge variant="outline" className="border-border text-muted-foreground dark:border-white/10">
                  {t("reduceLogs.badgeSub")}
                </Badge>
              </div>
              <CardTitle className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {t("reduceLogs.heroTitle")}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        <section>
          <Card className="border-border bg-card text-card-foreground shadow-md dark:border-cyan-400/15 dark:bg-slate-950/80 dark:shadow-xl dark:shadow-slate-950/30">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UploadCloud className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  <div>
                    <CardTitle>{t("reduceLogs.cardUploadTitle")}</CardTitle>
                  </div>
                </div>
                <Badge variant="outline" className="border-border text-muted-foreground dark:border-white/10">
                  {trackedBatchIds.length
                    ? t("reduceLogs.sessionsBadgeTracked", { n: trackedBatchIds.length })
                    : t("reduceLogs.sessionsBadgeNone")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs leading-snug text-foreground dark:border-cyan-400/20 dark:bg-cyan-950/40">
                <span className="font-medium text-cyan-950 dark:text-cyan-200">{t("reduceLogs.uploadRequiredLegend")}</span>
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2 lg:col-span-2">
                  <label className="flex flex-wrap items-baseline gap-x-1 text-sm font-medium text-foreground" htmlFor="reduce-logs-validation-name">
                    <span>{t("reduceLogs.labelValidationName")}</span>
                    <abbr
                      className="cursor-help text-destructive no-underline select-none"
                      title={t("reduceLogs.requiredFieldAbbrTitle")}
                    >
                      *
                    </abbr>
                  </label>
                  <Input
                    id="reduce-logs-validation-name"
                    value={analysisName}
                    onChange={(event) => setAnalysisName(event.target.value)}
                    aria-required
                    className="border-border bg-background dark:bg-slate-950/80"
                  />
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label
                    className="flex flex-wrap items-baseline gap-x-1 text-sm font-medium text-foreground"
                    htmlFor="reduce-logs-sample-sha256"
                  >
                    <span>{t("reduceLogs.labelSampleSha")}</span>
                    <abbr
                      className="cursor-help text-destructive no-underline select-none"
                      title={t("reduceLogs.requiredFieldAbbrTitle")}
                    >
                      *
                    </abbr>
                  </label>
                  <Input
                    id="reduce-logs-sample-sha256"
                    value={sampleSha256Input}
                    onChange={(event) => setSampleSha256Input(event.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    aria-required
                    placeholder={t("reduceLogs.placeholderSampleSha")}
                    disabled={isUploading}
                    className={`border-border bg-background font-mono text-sm dark:bg-slate-950/80 ${
                      sampleSha256InvalidHint ? "border-amber-600/65 focus-visible:ring-amber-500/50 dark:border-amber-400/50" : ""
                    }`}
                    aria-invalid={sampleSha256InvalidHint}
                  />
                  {sampleSha256InvalidHint ? (
                    <p className="text-xs text-amber-800 dark:text-amber-300/95" role="alert">
                      {t("reduceLogs.sampleShaAlert")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <span className="flex flex-wrap items-baseline gap-x-1 text-sm font-medium text-foreground" id="reduce-logs-file-label">
                  <span>{t("reduceLogs.labelLogFiles")}</span>
                  <abbr
                    className="cursor-help text-destructive no-underline select-none"
                    title={t("reduceLogs.requiredFieldAbbrTitle")}
                  >
                    *
                  </abbr>
                </span>
                <input
                  ref={logFilesInputRef}
                  type="file"
                  multiple
                  accept={LOG_FILE_ACCEPT}
                  className="sr-only"
                  aria-labelledby="reduce-logs-file-label"
                  aria-required
                  disabled={isUploading}
                  onChange={handleLogFilesInputChange}
                />
                <div
                  role="button"
                  tabIndex={isUploading ? -1 : 0}
                  aria-labelledby="reduce-logs-file-label"
                  aria-required
                  className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 dark:focus-visible:ring-cyan-400/50 ${
                    logDropHover
                      ? "border-cyan-500/55 bg-cyan-500/15 dark:border-cyan-400/60 dark:bg-cyan-500/15"
                      : "border-cyan-500/40 bg-cyan-500/10 hover:border-cyan-500/55 hover:bg-cyan-500/15 dark:border-cyan-400/30 dark:bg-cyan-500/[0.07] dark:hover:border-cyan-400/45 dark:hover:bg-cyan-500/10"
                  } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
                  onClick={() => {
                    if (!isUploading) logFilesInputRef.current?.click();
                  }}
                  onKeyDown={(event) => {
                    if (isUploading) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      logFilesInputRef.current?.click();
                    }
                  }}
                  onDragOver={handleLogDragOver}
                  onDragLeave={handleLogDragLeave}
                  onDrop={handleLogDrop}
                >
                  <UploadCloud className="h-10 w-10 text-cyan-600/90 dark:text-cyan-300/90" aria-hidden />
                  <p className="mt-4 text-sm font-medium text-foreground">
                    {t("reduceLogs.dropPrompt")}
                  </p>
                  <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
                    {t("reduceLogs.dropHint")}
                  </p>
                  <p className="mt-3 font-mono text-[11px] tracking-wide text-muted-foreground">
                    {LOG_FILE_ACCEPT.replace(/,/g, " · ")}
                  </p>
                </div>
              </div>

              {selectedFiles.length > 0 ? (
                <div className="rounded-2xl border border-border bg-muted/40 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-sm font-medium text-foreground">{t("reduceLogs.selectedFilesTitle")}</p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-border dark:border-white/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("reduceLogs.colFile")}</TableHead>
                          <TableHead>{t("reduceLogs.colInferType")}</TableHead>
                          <TableHead>{t("reduceLogs.colLocalSize")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedFiles.map((file) => (
                          <TableRow key={`${file.name}-${file.size}`}>
                            <TableCell className="font-medium text-foreground">{file.name}</TableCell>
                            <TableCell>{inferLogType(file.name)}</TableCell>
                            <TableCell>{formatBytes(file.size)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
                  {t("reduceLogs.noFilesSelectedBox")}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleReductionSubmit}
                  disabled={
                    isUploading
                    || selectedFiles.length === 0
                    || !normalizedSampleSha256ForUi
                    || !analysisName.trim()
                  }
                  className="transition duration-200 hover:-translate-y-0.5"
                >
                  {isUploading ? t("reduceLogs.btnSubmitting") : t("reduceLogs.btnSubmit")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="min-w-0 border-border bg-card text-card-foreground shadow-md dark:border-emerald-400/15 dark:bg-slate-950/80 dark:shadow-xl dark:shadow-slate-950/30">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{t("reduceLogs.monitorCardTitle")}</CardTitle>
                  {selectedBatchId ? (
                    <div className="mt-1 max-w-3xl text-xs text-muted-foreground">
                      <p>
                        {!submittedDetailQuery.dataUpdatedAt && submittedDetailQuery.isFetching
                          ? t("reduceLogs.serverAskingStatus")
                          : submittedDetailQuery.dataUpdatedAt
                            ? t("reduceLogs.serverLastResponse", {
                                time: formatDateTimeLocale(new Date(submittedDetailQuery.dataUpdatedAt)),
                                suffix: submittedDetailQuery.isFetching ? t("reduceLogs.serverUpdating") : "",
                              })
                            : t("reduceLogs.awaitingFirstResponse")}
                        {isReduceLogsDebugEnabled() ? (
                          <span className="ml-2 font-mono text-[10px] text-emerald-400/90">{t("reduceLogs.debugConsole")}</span>
                        ) : null}
                      </p>
                      {isReduceLogsDebugEnabled() && uploadedDetail?.serverProcessDebug ? (
                        <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-emerald-500/35 bg-black/60 p-2 font-mono text-[10px] leading-relaxed text-emerald-100/95">
                          {JSON.stringify(uploadedDetail.serverProcessDebug, null, 2)}
                        </pre>
                      ) : null}
                      {isReduceLogsDebugEnabled() && !isLocalUploadLotSelected && uploadedDetail && !uploadedDetail.serverProcessDebug
                        && !submittedDetailQuery.isLoading ? (
                          <p className="mt-1.5 text-[10px] text-amber-200/90">
                          <Trans
                            i18nKey="reduceLogs.debugNoSnapshot"
                            values={{ var: "CONTRADEF_SERVER_DEBUG=1" }}
                            components={{ span: <span className="font-mono" /> }}
                          />
                          </p>
                        ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedBatchId && !authLoading && canServerDeleteBatch(selectedBatchId) ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="shrink-0 border-rose-600/50 bg-rose-600/90 text-white shadow-sm hover:bg-rose-600 focus-visible:ring-rose-500 dark:border-rose-500/60 dark:bg-rose-700/90 dark:hover:bg-rose-600"
                      disabled={deleteBatchMutation.isPending}
                      onClick={() => {
                        if (selectedBatchId) {
                          void removeMyLotFromServerAndPanel(selectedBatchId);
                        }
                      }}
                    >
                      {t("reduceLogs.btnDeleteLot")}
                    </Button>
                  ) : null}
                  {selectedBatchId && !authLoading && !canServerDeleteBatch(selectedBatchId) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-amber-500/50 text-amber-900 hover:bg-amber-500/12 dark:border-amber-400/45 dark:text-amber-100 dark:hover:bg-amber-950/50"
                      onClick={() => {
                        if (selectedBatchId) {
                          removeFromPanelLocalOnly(selectedBatchId);
                        }
                      }}
                    >
                      {t("reduceLogs.btnRemoveSelection")}
                    </Button>
                  ) : null}
                  {trackedBatchIds.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-cyan-500/45 text-cyan-900 hover:bg-cyan-500/10 dark:border-cyan-400/40 dark:text-cyan-100 dark:hover:bg-cyan-950/40"
                      disabled={isUploading}
                      onClick={dismissAllTrackedLots}
                    >
                      {t("reduceLogs.btnClearLocalList")}
                    </Button>
                  ) : null}
                  <Badge className="border-emerald-500/35 bg-emerald-500/15 text-emerald-900 dark:border-emerald-400/25 dark:text-emerald-300">
                    {selectedBatchId
                      ? selectedBatchId === LOCAL_UPLOAD_LOT_ID
                        ? t("reduceLogs.badgeViewUpload")
                        : t("reduceLogs.badgeView", { id: selectedBatchId })
                      : t("reduceLogs.badgePickLot")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5">
              {uploadPipelineStatus && (
                <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-950/40 dark:text-cyan-50">
                  <p className="font-medium text-cyan-900 dark:text-cyan-100">{t("reduceLogs.uploadStateTitle")}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-cyan-900/95 dark:text-cyan-100/95">{uploadPipelineStatus}</p>
                  {directMultipartBytes && directMultipartBytes.total > 0 ? (
                    <div className="mt-3 space-y-1.5" role="status" aria-live="polite">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] font-medium text-cyan-900 dark:text-cyan-100">
                        <span>{t("reduceLogs.uploadProgressTitle")}</span>
                        <span className="tabular-nums text-cyan-800 dark:text-cyan-200">
                          {Math.min(
                            100,
                            Math.round((directMultipartBytes.loaded / directMultipartBytes.total) * 100),
                          )}
                          % · {formatBytes(directMultipartBytes.loaded)} / {formatBytes(directMultipartBytes.total)}
                        </span>
                      </div>
                      <ProgressStrip
                        className="h-2.5 sm:h-3"
                        tone="amber"
                        value={Math.min(
                          100,
                          Math.round((directMultipartBytes.loaded / directMultipartBytes.total) * 100),
                        )}
                      />
                    </div>
                  ) : null}
                  <p className="mt-2 text-[11px] text-cyan-800/80 dark:text-cyan-200/80">
                    {directMultipartBytes && directMultipartBytes.total > 0 ? (
                      <>
                        {t("reduceLogs.hintUploadBar")}
                      </>
                    ) : (
                      <>
                        {t("reduceLogs.hintUploadPerFile")}
                      </>
                    )}
                  </p>
                </div>
              )}
              {isUploading && submittedFiles.length > 0 ? (
                <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/5 dark:text-amber-50">
                  <p className="font-medium text-amber-900 dark:text-amber-100">{t("reduceLogs.uploadBannerTitle")}</p>
                  <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90">
                    {t("reduceLogs.uploadBannerBody")}
                  </p>
                  <ul className="mt-2 max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-xs">
                    {submittedFiles.map((f) => (
                      <li key={f.fileName}>
                        <span className="font-mono">{f.fileName}</span>
                        {" · "}
                        {f.uploadStatus === "uploading"
                          ? t("reduceLogs.uploadPctSent", { n: f.uploadProgress })
                          : f.uploadStatus === "completed"
                            ? t("reduceLogs.uploadSent")
                            : f.uploadStatus === "failed"
                              ? t("reduceLogs.uploadFailed")
                              : f.uploadStatus}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {trackedBatchIds.length > 0 ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-muted/40 p-3 dark:border-white/10 dark:bg-slate-950/50">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                          value={lotPanelSearchText}
                          onChange={(e) => setLotPanelSearchText(e.target.value)}
                          placeholder={t("reduceLogs.lotPanelSearchPlaceholder")}
                          className="border-border bg-background pl-8 text-sm dark:bg-slate-950/80"
                          aria-label={t("reduceLogs.lotPanelSearchAria")}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ["all", t("reduceLogs.lotFilterAll")],
                            ["active", t("reduceLogs.lotFilterActive")],
                            ["completed", t("reduceLogs.lotFilterCompleted")],
                            ["failed", t("reduceLogs.lotFilterFailed")],
                          ] as const
                        ).map(([key, label]) => (
                          <Button
                            key={key}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`h-8 border-border text-xs dark:border-white/10 ${
                              lotPanelStatusFilter === key ? "bg-cyan-500/15 text-cyan-900 dark:text-cyan-100" : "text-muted-foreground"
                            }`}
                            onClick={() => setLotPanelStatusFilter(key)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {lotPanelFilterExcludesEverything ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-400/25 dark:text-amber-50 sm:flex-row sm:items-center sm:justify-between">
                      <p>{t("reduceLogs.lotPanelNoMatch")}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-amber-500/50"
                        onClick={() => {
                          setLotPanelSearchText("");
                          setLotPanelStatusFilter("all");
                        }}
                      >
                        {t("reduceLogs.lotPanelClearFilters")}
                      </Button>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-border dark:border-white/10">
                    <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/30 px-2 py-1 dark:bg-slate-950/55">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {visibleTrackedLotIds.length === trackedBatchIds.length
                          ? t("reduceLogs.chipListCompactTitle", { n: trackedBatchIds.length })
                          : t("reduceLogs.chipListFilteredTitle", {
                              visible: visibleTrackedLotIds.length,
                              total: trackedBatchIds.length,
                            })}
                      </span>
                    </div>
                    <ul
                      className="divide-y divide-border/60 overflow-y-auto dark:divide-white/10"
                      style={{ maxHeight: "min(220px, 38vh)" }}
                    >
                      {visibleTrackedLotIds.map((lotId) => {
                        const row = batchRowById.get(lotId);
                        const isSel = lotId === selectedBatchId;
                        const fullId = lotId === LOCAL_UPLOAD_LOT_ID ? t("reduceLogs.chipLocalUpload") : lotId;
                        const idAbbrev = lotId === LOCAL_UPLOAD_LOT_ID
                          ? t("reduceLogs.trackedLotRowIdLocal")
                          : formatTrackedLotIdAbbrev(lotId);
                        const nameRaw =
                          lotId === LOCAL_UPLOAD_LOT_ID
                            ? (analysisName.trim() || t("reduceLogs.chipNewLot"))
                            : (row?.sampleName ?? "…").trim();
                        const { display: nameDisplay, full: nameFull } = compactTrackedLotValidationName(nameRaw);
                        const statusTitle =
                          lotId === LOCAL_UPLOAD_LOT_ID
                            ? t("reduceLogs.chipSendingAvg", { pct: localUploadAverageProgress })
                            : row
                              ? `${getStatusLabel(row.status, t)} · ${row.progress}%`
                              : t("reduceLogs.loadingShort");
                        const statusShort =
                          lotId === LOCAL_UPLOAD_LOT_ID
                            ? t("reduceLogs.trackedLotRowUploadPct", { pct: localUploadAverageProgress })
                            : row
                              ? `${row.progress}%`
                              : "…";

                        return (
                          <li key={lotId}>
                            <div
                              className={cn(
                                "flex min-h-8 items-center gap-1 px-1.5 py-0.5 text-[11px] transition-colors",
                                isSel
                                  ? "bg-cyan-500/12 ring-1 ring-inset ring-cyan-500/40 dark:bg-cyan-950/45"
                                  : "hover:bg-muted/50 dark:hover:bg-white/[0.04]",
                              )}
                            >
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-0.5 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                                title={`${fullId}${nameRaw ? `\n${nameRaw}` : ""}\n${statusTitle}`}
                                onClick={() => {
                                  setSelectedBatchId(lotId);
                                }}
                              >
                                <span
                                  className="max-w-[9.5rem] shrink-0 truncate border-r border-border/50 pr-3 font-mono text-[10px] tabular-nums text-muted-foreground dark:border-white/10"
                                  title={fullId}
                                >
                                  {idAbbrev}
                                </span>
                                <span className="min-w-0 flex-1 truncate pl-0.5 font-medium leading-tight text-foreground" title={nameFull}>
                                  {nameDisplay}
                                </span>
                                <span
                                  className="w-10 shrink-0 text-right font-mono tabular-nums text-[10px] text-muted-foreground"
                                  title={statusTitle}
                                >
                                  {statusShort}
                                </span>
                              </button>
                              {authLoading ? (
                                <span
                                  className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center text-[10px] text-muted-foreground/50"
                                  title={t("reduceLogs.loadingSessionChip")}
                                >
                                  …
                                </span>
                              ) : lotId === LOCAL_UPLOAD_LOT_ID && isUploading ? (
                                <span
                                  className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center text-[10px] text-muted-foreground/50"
                                  title={t("reduceLogs.chipAwaitUploadTooltip")}
                                >
                                  …
                                </span>
                              ) : canServerDeleteBatch(lotId) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 shrink-0 p-0 text-xs text-muted-foreground hover:text-foreground"
                                  disabled={deleteBatchMutation.isPending}
                                  onClick={() => {
                                    void removeMyLotFromServerAndPanel(lotId);
                                  }}
                                  aria-label={t("reduceLogs.ariaDeleteServer", { id: lotId })}
                                >
                                  ✕
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 shrink-0 p-0 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    removeFromPanelLocalOnly(lotId);
                                  }}
                                  aria-label={t("reduceLogs.ariaRemovePanel", { id: lotId })}
                                >
                                  ✕
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ) : null}
              {showRestoreHint && trackedBatchIds.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-950 dark:border-cyan-400/25 dark:text-cyan-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="leading-relaxed">
                    <Trans
                      i18nKey="reduceLogs.manyLotsSavedWithLink"
                      values={{ n: trackedBatchIds.length }}
                      components={{
                        strong: <span className="font-medium text-cyan-900 dark:text-cyan-100" />,
                        dash: (
                          <Link
                            className="font-medium text-cyan-800 underline underline-offset-2 dark:text-cyan-200"
                            href="/"
                          />
                        ),
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-cyan-900 hover:bg-cyan-500/20 hover:text-cyan-950 dark:text-cyan-100 dark:hover:text-white"
                    onClick={() => {
                      try {
                        sessionStorage.setItem(RESTORE_BANNER_SESSION_KEY, "1");
                      } catch {
                        /* ignore */
                      }
                      setShowRestoreHint(false);
                    }}
                  >
                    {t("reduceLogs.btnDismissRestore")}
                  </Button>
                </div>
              ) : null}
              {submittedDetailQuery.isError && selectedBatchId && !isLocalUploadLotSelected ? (() => {
                const errPres = getDetailQueryErrorPresentation(submittedDetailQuery.error?.message, t);
                return (
                <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-5 text-sm leading-6 text-rose-950 dark:border-rose-400/25 dark:text-rose-100">
                  <p className="font-medium text-foreground">
                    {errPres.headline}
                  </p>
                  <p className="mt-1.5 text-xs text-rose-900/90 dark:text-rose-200/90">
                    {errPres.body}
                  </p>
                  {errPres.showTechnical && submittedDetailQuery.error?.message ? (
                    <p className="mt-2 max-h-20 overflow-y-auto break-all font-mono text-[10px] text-rose-800/80 dark:text-rose-300/80">
                      {String(submittedDetailQuery.error.message)}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-rose-400/50"
                      onClick={() => {
                        void submittedDetailQuery.refetch();
                      }}
                      disabled={submittedDetailQuery.isFetching}
                    >
                      {submittedDetailQuery.isFetching ? t("reduceLogs.btnRetrying") : t("reduceLogs.btnRetry")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (selectedBatchId) {
                          removeFromPanelLocalOnly(selectedBatchId);
                        }
                      }}
                    >
                      {t("reduceLogs.btnRemoveThisLotFromPanel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-rose-900 dark:text-rose-100"
                      onClick={dismissAllTrackedLots}
                    >
                      {t("reduceLogs.btnClearLocalList")}
                    </Button>
                  </div>
                </div>
                );
              })() : null}
              {selectedBatchId
                && selectedBatchId !== LOCAL_UPLOAD_LOT_ID
                && submittedDetailQuery.isSuccess
                && !uploadedDetail
                && !submittedDetailQuery.isFetching ? (
                <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:text-amber-100">
                  <Trans
                    i18nKey="reduceLogs.emptyBatchResponseBanner"
                    values={{ id: selectedBatchId }}
                    components={{
                      mono: <span className="font-mono" />,
                      dash: (
                        <Link
                          className="font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
                          href="/"
                        />
                      ),
                    }}
                  />
                </div>
              ) : monitorDetailLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-cyan-500/35 bg-cyan-500/10 p-10 text-center text-sm text-muted-foreground dark:border-cyan-400/20 dark:bg-cyan-500/5">
                  <RefreshCw className="h-8 w-8 animate-spin text-cyan-600/80 dark:text-cyan-300/80" />
                  <p className="max-w-md text-foreground">{t("reduceLogs.awaitingFirstBatchState")}</p>
                  <p className="max-w-md text-xs text-muted-foreground">
                    {t("reduceLogs.spinColdStartHint")}
                  </p>
                </div>
              ) : showBatchStatusWithoutFileTable && uploadedDetail ? (
                <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-5 text-sm leading-6 dark:border-white/10 dark:bg-slate-950/60">
                  <p className="font-medium text-foreground">{t("reduceLogs.batchActiveLoadingTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("reduceLogs.batchWaitingFileTableHint")}</p>
                  <div className="grid gap-2 rounded-xl border border-border/80 bg-background/80 px-3 py-2.5 text-xs font-mono dark:border-white/10">
                    <div className="flex flex-wrap justify-between gap-2 text-foreground">
                      <span>{t("reduceLogs.batchDetailBatchLabel")}</span>
                      <span className="truncate pl-2">{uploadedDetail.batch.batchId}</span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">{t("reduceLogs.batchDetailStateLabel")}</span>
                      <span>
                        {getStatusLabel(uploadedDetail.batch.status, t)} · {formatPercentRounded(uploadedDetail.batch.progress)}%
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {t("reduceLogs.batchDetailStagePrefix")} {uploadedDetail.batch.stage}
                    </div>
                    {uploadedDetail.batch.message ? (
                      <p className="pt-1 text-[11px] leading-relaxed text-foreground/90">{uploadedDetail.batch.message}</p>
                    ) : null}
                  </div>
                  {uploadedDetail.batch.stdoutTail ? (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">{t("reduceLogs.lastActivitySrv")}</p>
                      <pre className="max-h-32 overflow-y-auto rounded-lg border border-border/60 bg-black/20 p-2 text-[10px] text-emerald-200/90 dark:border-white/10">
                        {uploadedDetail.batch.stdoutTail}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : isUploading && isOnlyArchiveSubmission && !monitoredFiles.length ? (
                <div className="rounded-2xl border border-dashed border-cyan-500/35 bg-cyan-500/5 p-5 text-sm text-muted-foreground dark:border-cyan-400/25 dark:bg-cyan-950/20">
                  <Trans i18nKey="reduceLogs.hintAfterExtractStrong" components={{ strong: <span className="text-foreground" /> }} />
                </div>
              ) : !showMainMonitoringPanel ? (
                submittedDetailQuery.isError && !isLocalUploadLotSelected && selectedBatchId && !selectedListRow ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-400/30 bg-rose-500/5 p-8 text-center text-sm text-muted-foreground dark:border-rose-400/20 dark:bg-rose-950/20">
                    <p className="text-foreground">{t("reduceLogs.awaitRowTrans")}</p>
                    <p className="max-w-md text-xs">
                      <Trans
                        i18nKey="reduceLogs.hintDetailFailedTrans"
                        components={{ retry: <span className="text-foreground" /> }}
                      />
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-black/20">
                    <p>
                      <Trans
                        i18nKey="reduceLogs.hintNoLotFilesTrans"
                        components={{
                          run: <span className="font-medium text-foreground" />,
                          dash: (
                            <Link
                              className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                              href="/"
                            />
                          ),
                        }}
                      />
                    </p>
                    <p className="text-xs">
                      {t("reduceLogs.hintReloadTracked")}
                    </p>
                  </div>
                )
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard
                      icon={RefreshCw}
                      label={t("reduceLogs.metricBatchStatus")}
                      value={uploadedDetail
                        ? getStatusLabel(uploadedDetail.batch.status, t)
                        : isUploading
                          ? t("reduceLogs.statusSendingBatch")
                          : selectedListRow
                            ? getStatusLabel(selectedListRow.status, t)
                            : t("reduceLogs.prepLabel")}
                      helper={uploadedDetail
                        ? t("reduceLogs.progressLineWithStall", {
                            pct: uploadedDetail.batch.progress,
                            stage: uploadedDetail.batch.stage,
                            stalled:
                              staleRunningFiles.length > 0
                                ? t("reduceLogs.stalledFilesSuffix", { n: staleRunningFiles.length })
                                : "",
                          })
                        : isLocalUploadLotSelected
                          ? t("reduceLogs.uploadProgressNoServerBatch", { pct: localUploadAverageProgress })
                          : selectedListRow
                            ? submittedDetailQuery.isError
                              ? t("reduceLogs.listProgressNoDetail", { pct: selectedListRow.progress })
                              : t("reduceLogs.listProgressWithFileCount", {
                                  pct: selectedListRow.progress,
                                  n: monitoredFiles.length,
                                })
                            : t("reduceLogs.filesInBatchOnly", { n: monitoredFiles.length })}
                    />
                    <MetricCard
                      icon={Database}
                      label={t("reduceLogs.metricFilesProgress")}
                      value={`${monitoredFiles.length}`}
                      helper={t("reduceLogs.metricFilesProgressHelp", {
                        done: batchSummary?.completedFiles ?? 0,
                        run: batchSummary?.runningFiles ?? 0,
                        fail: batchSummary?.failedFiles ?? 0,
                      })}
                    />
                    <MetricCard
                      icon={FileArchive}
                      label={t("reduceLogs.metricConsolidatedSize")}
                      value={formatBytes(batchSummary?.totalOriginalBytes ?? 0)}
                      helper={t("reduceLogs.metricLinesBefore", { n: batchSummary?.totalOriginalLines ?? 0 })}
                    />
                    <MetricCard
                      icon={ShieldCheck}
                      label={t("reduceLogs.metricReductionConsolidated")}
                      value={formatPercentFine(batchSummary?.reductionPercent ?? 0)}
                      helper={t("reduceLogs.metricLinesDiscarded", { n: batchSummary?.discardedLines ?? 0 })}
                    />
                  </div>

                  {batchSummary && monitoredFiles.length > 0 ? (
                    <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-sm dark:border-violet-400/20 dark:bg-violet-950/30">
                      <p className="font-medium text-violet-950 dark:text-violet-100">{t("reduceLogs.lotTotalTimeTitle")}</p>
                      <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                        {formatElapsedMs(batchSummary.totalWallMs, t)}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{t("reduceLogs.pollIntervalLabel")}</span>
                      <select
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground dark:bg-slate-950"
                        value={String(pollIntervalMs)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!POLL_MS_OPTIONS.includes(v as (typeof POLL_MS_OPTIONS)[number])) return;
                          setPollIntervalMs(v);
                          try {
                            localStorage.setItem(REDUCE_LOGS_POLL_MS_KEY, String(v));
                          } catch {
                            /* private mode */
                          }
                        }}
                      >
                        {POLL_MS_OPTIONS.map((ms) => (
                          <option key={ms} value={String(ms)}>
                            {ms / 1000} s{ms === DEFAULT_REDUCE_LOGS_POLL_MS ? t("reduceLogs.pollDefaultSuffix") : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {uploadedDetail?.batch
                  && (uploadedDetail.batch.status === "running" || uploadedDetail.batch.status === "queued")
                  && (uploadedDetail.batch.stdoutTail
                    || /A processar|Processando/.test(uploadedDetail.batch.message ?? "")) ? (
                    <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/35 p-4 dark:border-cyan-400/20">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{t("reduceLogs.serverLogTitle")}</p>
                        </div>
                        <code className="max-w-full shrink-0 break-all rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-900 dark:text-cyan-100/90">
                          {uploadedDetail.batch.message}
                        </code>
                      </div>
                      <pre
                        ref={activityLogRef}
                        className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-border/60 bg-black/35 p-3 font-mono text-[11px] leading-relaxed text-cyan-100/95 dark:border-white/10"
                      >
                        {uploadedDetail.batch.stdoutTail || t("reduceLogs.stdoutStarting")}
                      </pre>
                    </div>
                  ) : null}

                  <Tabs defaultValue="overview" className="min-w-0 space-y-5">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("reduceLogs.areaTitle")}</p>
                      <TabsList className="flex h-auto w-full flex-wrap justify-stretch gap-1.5 rounded-2xl border border-cyan-500/35 bg-muted p-1.5 shadow-inner dark:border-cyan-500/25 dark:bg-slate-950/90 dark:shadow-black/40 md:inline-flex md:w-full md:min-w-0">
                        <TabsTrigger
                          value="overview"
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-cyan-500/50 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-900 data-[state=active]:shadow-sm data-[state=active]:hover:bg-cyan-500/25 dark:data-[state=active]:border-cyan-400/55 dark:data-[state=active]:text-cyan-50 dark:data-[state=active]:shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)]"
                        >
                          <LayoutDashboard className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                          {t("reduceLogs.tabOverview")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="files"
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-cyan-500/50 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-900 data-[state=active]:shadow-sm data-[state=active]:hover:bg-cyan-500/25 dark:data-[state=active]:border-cyan-400/55 dark:data-[state=active]:text-cyan-50 dark:data-[state=active]:shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)]"
                        >
                          <FolderOpen className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                          {t("reduceLogs.tabFiles")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="operational"
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-cyan-500/50 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-900 data-[state=active]:shadow-sm data-[state=active]:hover:bg-cyan-500/25 dark:data-[state=active]:border-cyan-400/55 dark:data-[state=active]:text-cyan-50 dark:data-[state=active]:shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)]"
                        >
                          <SlidersHorizontal className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                          {t("reduceLogs.tabOperational")}
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="overview" className="min-w-0 space-y-4">

                  {showsLocalStorageModeBadge ? (
                    <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm leading-6 text-amber-950 dark:border-amber-400/25 dark:text-amber-100">
                      {t("reduceLogs.forgeLocalBadge")}
                    </div>
                  ) : null}

                    </TabsContent>

                    <TabsContent value="files" className="min-w-0 space-y-4">

                  <div className="w-full min-w-0 max-w-full rounded-2xl border border-border bg-muted/50 p-4 dark:border-white/10 dark:bg-black/20">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t("reduceLogs.followPerFileTitle")}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-emerald-600/35 text-emerald-900 hover:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-100"
                          disabled={!monitoredFiles.length || selectedBatchId === LOCAL_UPLOAD_LOT_ID}
                          onClick={handleExportReduceLogsExcel}
                        >
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          {t("reduceLogs.exportExcelBtn")}
                        </Button>
                        <Badge variant="outline" className="border-border text-muted-foreground dark:border-white/10">
                          {uploadedDetail?.currentPhase ?? t("reduceLogs.phasePrepDefault")}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-6 rounded-xl border-2 border-cyan-500/40 bg-cyan-500/[0.06] p-4 shadow-sm dark:border-cyan-400/35 dark:bg-cyan-950/25">
                      <div className="mb-3 flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                          <Filter className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-semibold leading-tight text-foreground">{t("reduceLogs.fileFilterBannerTitle")}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`border-border dark:border-white/10 ${fileQuickFilter === "stalled" ? "bg-amber-500/15 text-amber-900 dark:text-amber-200" : "text-muted-foreground"}`}
                        onClick={() => setFileQuickFilter((current) => current === "stalled" ? "all" : "stalled")}
                      >
                        {fileQuickFilter === "stalled" ? t("reduceLogs.filterStalledActive") : t("reduceLogs.filterStalled")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`border-border dark:border-white/10 ${fileQuickFilter === "running" ? "bg-cyan-500/15 text-cyan-900 dark:text-cyan-200" : "text-muted-foreground"}`}
                        onClick={() => setFileQuickFilter((current) => current === "running" ? "all" : "running")}
                      >
                        {fileQuickFilter === "running" ? t("reduceLogs.filterRunningActive") : t("reduceLogs.filterRunning")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`border-border dark:border-white/10 ${fileQuickFilter === "completed" ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200" : "text-muted-foreground"}`}
                        onClick={() => setFileQuickFilter((current) => current === "completed" ? "all" : "completed")}
                      >
                        {fileQuickFilter === "completed" ? t("reduceLogs.filterCompletedActive") : t("reduceLogs.filterCompleted")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`border-border dark:border-white/10 ${sortByPriority ? "bg-violet-500/15 text-violet-900 dark:text-violet-200" : "text-muted-foreground"}`}
                        onClick={() => setSortByPriority((current) => !current)}
                      >
                        {sortByPriority ? t("reduceLogs.sortPriorityActive") : t("reduceLogs.sortPriority")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`border-border dark:border-white/10 ${focusCriticalMode ? "bg-rose-500/15 text-rose-900 dark:text-rose-200" : "text-muted-foreground"}`}
                        onClick={() => setFocusCriticalMode((current) => !current)}
                      >
                        {focusCriticalMode ? t("reduceLogs.focusCriticalActive") : t("reduceLogs.focusCritical")}
                      </Button>
                      <Badge variant="outline" className="border-border text-muted-foreground dark:border-white/10">
                        {t("reduceLogs.filesAttentionBadge", { n: stalledFileNameSet.size })}
                      </Badge>
                      </div>
                    </div>

                    {fileQuickFilter !== "all" && visibleMonitoredFiles.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/60 p-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/50">
                        {t("reduceLogs.filterNoRows")}
                      </div>
                    ) : null}

                    <div className="mt-4 hidden w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border border-border md:block dark:border-white/10">
                      <div className={`${FILE_TRACKING_GRID_12} border-b-2 border-border`}>
                        <div className={fileTrackTh}>{t("reduceLogs.gridColFile")}</div>
                        <div className={fileTrackTh}>{t("reduceLogs.gridColUpload")}</div>
                        <div className={fileTrackTh}>{t("reduceLogs.gridColProcessing")}</div>
                        <div className={`${fileTrackThNarrow} tabular-nums`} title={t("reduceLogs.gridColTimeTitle")}>
                          {t("reduceLogs.gridColTimeShort")}
                        </div>
                        <div className={fileTrackTh}>{t("reduceLogs.gridColStage")}</div>
                        <div className={`${fileTrackThNarrow} tabular-nums`}>{t("reduceLogs.gridColBefore")}</div>
                        <div className={`${fileTrackThNarrow} tabular-nums`}>{t("reduceLogs.gridColAfter")}</div>
                        <div
                          className={`${fileTrackThNarrow} tabular-nums`}
                          title={t("reduceLogs.gridColReduceTitle")}
                        >
                          {t("reduceLogs.gridColReduceShortTitle")}
                        </div>
                        <div className={fileTrackTh}>{t("reduceLogs.gridColSignals")}</div>
                        <div className={fileTrackThNarrow} title={t("reduceLogs.gridColSemTitle")}>
                          {t("reduceLogs.gridColSemShort")}
                        </div>
                        <div
                          className={fileTrackThNarrow}
                          title={t("reduceLogs.gridColSummaryTitle")}
                        >
                          {t("reduceLogs.gridColSummary")}
                        </div>
                        <div className={fileTrackTh} title={t("reduceLogs.gridColReduceLogTitle")}>
                          {t("reduceLogs.gridColFileShort")}
                        </div>
                      </div>
                      {visibleMonitoredFiles.map((file) => {
                        const reduction = getFileReductionDisplayPercent(file);
                        const uploadVisual = getUploadStatusVisual(file.uploadStatus);
                        const processingVisual = getProcessingStatusVisual(file.processingStatus);
                        const lastEventAt = fileLastEventAtMap.get(file.fileName);
                        const isPossiblyStalled = file.processingStatus === "running" && (!lastEventAt || (uiNowMs - lastEventAt.getTime() > staleThresholdMsForFile(file)));
                        const stageSince = fileCurrentStageSinceMap.get(file.fileName);
                        const stageElapsedMs = stageHintElapsedMs(
                          file.processingStatus,
                          stageSince,
                          lastEventAt,
                          uiNowMs,
                        );
                        const isStageLong = stageElapsedMs > STAGE_WARNING_THRESHOLD_MS && (file.processingStatus === "running" || file.processingStatus === "queued");

                        const canDownloadReduced =
                          Boolean(selectedBatchId)
                          && selectedBatchId !== LOCAL_UPLOAD_LOT_ID
                          && file.processingStatus === "completed"
                          && file.reducedLineCount > 0;

                        return (
                          <div
                            key={`${selectedBatchId ?? "lote"}-${file.fileName}`}
                            className={`${FILE_TRACKING_GRID_12} border-b border-border [align-items:start] ${processingVisual.row}`}
                          >
                            <div className={fileTrackTd} title={file.fileName}>
                              {file.fileName}
                            </div>
                            <div className={fileTrackTd}>
                              <div className="space-y-2">
                                <div className={`flex min-w-0 flex-wrap items-center justify-between gap-x-1 gap-y-0.5 text-xs ${uploadVisual.label}`}>
                                  <span className="flex min-w-0 flex-wrap items-center gap-1">
                                    <Badge className={`max-w-full shrink ${uploadVisual.badge}`}>{getStatusLabel(file.uploadStatus, t)}</Badge>
                                  </span>
                                  <span className="shrink-0">{file.uploadProgress}%</span>
                                </div>
                                <ProgressStrip value={file.uploadProgress} tone={uploadVisual.progressTone} />
                              </div>
                            </div>
                            <div className={fileTrackTd}>
                              <div className="space-y-2">
                                <div className={`flex min-w-0 flex-wrap items-center justify-between gap-x-1 gap-y-0.5 text-xs ${processingVisual.label}`}>
                                  <span className="flex min-w-0 flex-wrap items-center gap-1">
                                    <Badge className={`max-w-full shrink ${processingVisual.badge}`}>{getStatusLabel(file.processingStatus, t)}</Badge>
                                    {isPossiblyStalled ? <span className="text-[10px] text-amber-200">{t("reduceLogs.stalledShort")}</span> : null}
                                  </span>
                                  <span className="shrink-0">{formatFileProcessingPercent(file.processingProgress)}</span>
                                </div>
                                <ProgressStrip
                                  value={file.processingProgress ?? 0}
                                  indeterminate={file.processingProgress == null && file.processingStatus === "running"}
                                  tone={processingVisual.progressTone}
                                />
                              </div>
                            </div>
                            <div
                              className={`${fileTrackTdNarrow} text-left tabular-nums align-top leading-tight`}
                              title={t("reduceLogs.gridColTimeTitle")}
                            >
                              <span className="block text-muted-foreground">
                                {t("reduceLogs.timeUploadAbbr")} {formatElapsedMs(file.uploadDurationMs, t)}
                              </span>
                              <span className="mt-0.5 block text-foreground">
                                {t("reduceLogs.timeProcessAbbr")} {formatElapsedMs(file.processingDurationMs, t)}
                              </span>
                            </div>
                            <div className={fileTrackTd}>
                              <div className="flex w-full min-w-0 flex-col gap-0.5 pr-0.5">
                                <p
                                  className="line-clamp-1 text-[11px] font-medium leading-tight text-foreground"
                                  title={file.currentStage}
                                >
                                  {file.currentStage}
                                </p>
                                <p
                                  className="line-clamp-2 max-h-[2.5rem] text-[10px] leading-snug text-muted-foreground [overflow-wrap:anywhere]"
                                  title={file.currentStep}
                                >
                                  {file.currentStep}
                                </p>
                                <p className="text-[9px] leading-tight text-muted-foreground/90 [overflow-wrap:anywhere]">
                                  <span>{formatLastActivityLabel(lastEventAt, t)}</span>
                                  {stageElapsedMs > 0 ? (
                                    <span className={isStageLong ? " text-amber-200" : ""}>
                                      {" "}
                                      {t("reduceLogs.stalledInStage", { ms: formatElapsedMs(stageElapsedMs, t) })}
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                            </div>
                            <div className={`${fileTrackTdNarrow} whitespace-nowrap text-left tabular-nums`}>{formatBytes(file.originalBytes)}</div>
                            <div className={`${fileTrackTdNarrow} whitespace-nowrap text-left tabular-nums`}>{formatBytes(file.reducedBytes)}</div>
                            <div
                              className={`${fileTrackTdNarrow} whitespace-nowrap text-left tabular-nums`}
                              title={
                                file.processingStatus === "completed"
                                  ? t("reduceLogs.reduceCompletedTitle")
                                  : t("reduceLogs.reduceProgressTitle")
                              }
                            >
                              {formatPercentFine(reduction)}
                            </div>
                            <div className={`${fileTrackTd} text-[10px] leading-tight text-muted-foreground`}>
                              <span className="text-foreground">{file.suspiciousEventCount}</span> {t("reduceLogs.evtShort")}
                              <span className="mx-0.5 text-muted-foreground/70">·</span>
                              <span className="text-foreground">{file.triggerCount}</span> {t("reduceLogs.gatShort")}
                            </div>
                            <div className={`${fileTrackTdNarrow} break-words [overflow-wrap:anywhere] ${getSemaforoToneClass(getSemaforoKind(file))}`}>{getSemaforoLabel(getSemaforoKind(file), t)}</div>
                            <div className={`${fileTrackTdNarrow} p-0.5`}>
                              {canDownloadReduced && selectedBatchId ? (
                                <a
                                  href={buildPreservationReportDownloadUrl(selectedBatchId, file.fileName)}
                                  className="inline-flex justify-start rounded-md p-1 text-violet-700 hover:bg-violet-500/15 hover:underline dark:text-violet-300"
                                  title={t("reduceLogs.presReportTitle")}
                                  aria-label={t("reduceLogs.presReportAria", { name: file.fileName })}
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                </a>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </div>
                            <div className={`${fileTrackTdNarrow} p-0.5`}>
                              {canDownloadReduced && selectedBatchId ? (
                                <a
                                  href={buildReducedLogDownloadUrl(selectedBatchId, file.fileName)}
                                  className="inline-flex justify-start rounded-md p-1 text-cyan-700 hover:bg-cyan-500/15 hover:underline dark:text-cyan-300"
                                  title={t("reduceLogs.reducedDlTitle")}
                                  aria-label={t("reduceLogs.reducedDlAria", { name: file.fileName })}
                                >
                                  <FileDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                </a>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 space-y-3 md:hidden">
                      {visibleMonitoredFiles.map((file) => {
                        const reduction = getFileReductionDisplayPercent(file);
                        const processingVisual = getProcessingStatusVisual(file.processingStatus);
                        const lastEventAt = fileLastEventAtMap.get(file.fileName);
                        const isPossiblyStalled = file.processingStatus === "running" && (!lastEventAt || (uiNowMs - lastEventAt.getTime() > staleThresholdMsForFile(file)));
                        const stageSince = fileCurrentStageSinceMap.get(file.fileName);
                        const stageElapsedMs = stageHintElapsedMs(
                          file.processingStatus,
                          stageSince,
                          lastEventAt,
                          uiNowMs,
                        );
                        const isStageLong = stageElapsedMs > STAGE_WARNING_THRESHOLD_MS && (file.processingStatus === "running" || file.processingStatus === "queued");
                        return (
                          <div key={`mobile-${selectedBatchId ?? "lote"}-${file.fileName}`} className={`rounded-xl border border-border bg-muted/70 dark:border-white/10 dark:bg-slate-950/60 p-3 ${processingVisual.row}`}>
                            <p className="text-sm font-medium text-foreground">{file.fileName}</p>
                            <p className="mt-0.5 line-clamp-1 text-xs font-medium text-foreground" title={file.currentStage}>
                              {file.currentStage}
                            </p>
                            <p
                              className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground [overflow-wrap:anywhere]"
                              title={file.currentStep}
                            >
                              {file.currentStep}
                            </p>
                            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                              <p>{t("reduceLogs.metricUploadLabel")}: {getStatusLabel(file.uploadStatus, t)} ({file.uploadProgress}%)</p>
                              <p className={processingVisual.label}>
                                {t("reduceLogs.metricProcessLabel")}: {getStatusLabel(file.processingStatus, t)} ({formatFileProcessingPercent(file.processingProgress)})
                                {isPossiblyStalled ? t("reduceLogs.mobileStale") : ""}
                              </p>
                              <p className="tabular-nums text-[11px] text-foreground/95">
                                {t("reduceLogs.mobileTimeLine", {
                                  up: formatElapsedMs(file.uploadDurationMs, t),
                                  proc: formatElapsedMs(file.processingDurationMs, t),
                                })}
                              </p>
                              <p>
                                {formatLastActivityLabel(lastEventAt, t)}
                                {stageElapsedMs > 0 ? (
                                  <span className={isStageLong ? " text-amber-200" : ""}>
                                    {" "}
                                    {t("reduceLogs.stalledInStage", { ms: formatElapsedMs(stageElapsedMs, t) })}
                                  </span>
                                ) : null}
                              </p>
                              <p>
                                {t("reduceLogs.mobileReduceLine", {
                                  pct: formatPercentFine(reduction),
                                  ev: file.suspiciousEventCount,
                                  tr: file.triggerCount,
                                })}
                              </p>
                              <p>{t("reduceLogs.mobileSemaLabel")} <span className={getSemaforoToneClass(getSemaforoKind(file))}>{getSemaforoLabel(getSemaforoKind(file), t)}</span></p>
                              {selectedBatchId
                              && selectedBatchId !== LOCAL_UPLOAD_LOT_ID
                              && file.processingStatus === "completed"
                              && file.reducedLineCount > 0 ? (
                                <p className="space-y-1.5 pt-1">
                                  <a
                                    href={buildPreservationReportDownloadUrl(selectedBatchId, file.fileName)}
                                    className="block font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                                  >
                                    {t("reduceLogs.presReportLink")}
                                  </a>
                                  <a
                                    href={buildReducedLogDownloadUrl(selectedBatchId, file.fileName)}
                                    className="block font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                                  >
                                    {t("reduceLogs.reducedFullLink")}
                                  </a>
                                </p>
                                ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="w-full min-w-0 max-w-full rounded-2xl border border-border bg-muted/50 p-4 dark:border-white/10 dark:bg-black/20">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t("reduceLogs.suggestionsTitle")}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-emerald-600/35 text-emerald-900 hover:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-100"
                          disabled={!monitoredFiles.length || selectedBatchId === LOCAL_UPLOAD_LOT_ID}
                          onClick={handleExportReduceLogsExcel}
                        >
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          {t("reduceLogs.exportExcelBtn")}
                        </Button>
                        <Badge variant="outline" className="border-border text-muted-foreground dark:border-white/10">
                          {t("reduceLogs.suspiciousBatchBadge", {
                            susp: batchSummary?.suspiciousCount ?? 0,
                            trg: batchSummary?.triggerCount ?? 0,
                          })}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 hidden w-full min-w-0 max-w-full rounded-xl border border-border md:block dark:border-white/10">
                      <Table
                        tableContainerClassName="!overflow-x-hidden"
                        className="w-full min-w-0 table-fixed border-collapse text-xs [word-break:break-word] [&_th]:!h-auto [&_th]:!min-h-0 [&_th]:!whitespace-normal [&_th]:!px-1.5 [&_th]:!py-1.5 [&_th]:!align-top [&_td]:!whitespace-normal [&_td]:!p-1.5 [&_td]:!align-top [tbody_td]:min-w-0 [thead_th]:text-[11px] [thead_th]:leading-tight"
                      >
                        <colgroup>
                          {(
                            [16, 14, 34, 36] as const
                          ).map((pct, i) => (
                            <col key={i} style={{ width: `${pct}%` }} />
                          ))}
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="bg-muted dark:bg-slate-950">{t("reduceLogs.gridColFile")}</TableHead>
                            <TableHead>{t("reduceLogs.guidanceColRead")}</TableHead>
                            <TableHead>{t("reduceLogs.guidanceColInterp")}</TableHead>
                            <TableHead>{t("reduceLogs.guidanceColAction")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleMonitoredFiles.map((file) => {
                            const processingVisual = getProcessingStatusVisual(file.processingStatus);
                            return (
                            <TableRow key={`guidance-${file.fileName}`} className={processingVisual.row}>
                              <TableCell className="min-w-0 break-all font-medium text-foreground">{file.fileName}</TableCell>
                              <TableCell className="min-w-0">
                                <div className="space-y-1">
                                  <Badge className={processingVisual.badge}>{getStatusLabel(file.processingStatus, t)}</Badge>
                                  <p className="text-[11px] text-muted-foreground leading-snug">{file.currentStep}</p>
                                </div>
                              </TableCell>
                              <TableCell className="min-w-0 break-words text-[11px] leading-snug text-muted-foreground">{getFileInterpretation(file)}</TableCell>
                              <TableCell className="min-w-0 break-words text-[11px] leading-snug text-cyan-800 dark:text-cyan-100/95">{getFileRecommendation(file)}</TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="mt-4 space-y-3 md:hidden">
                      {visibleMonitoredFiles.map((file) => {
                        const processingVisual = getProcessingStatusVisual(file.processingStatus);
                        return (
                        <div key={`guidance-mobile-${file.fileName}`} className={`rounded-xl border border-border bg-muted/70 dark:border-white/10 dark:bg-slate-950/60 p-3 ${processingVisual.row}`}>
                          <p className="text-sm font-medium text-foreground">{file.fileName}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge className={processingVisual.badge}>{getStatusLabel(file.processingStatus, t)}</Badge>
                            <p className="text-xs text-muted-foreground">{file.currentStep}</p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{getFileInterpretation(file)}</p>
                          <p className="mt-2 text-sm text-cyan-800 dark:text-cyan-100">{getFileRecommendation(file)}</p>
                        </div>
                        );
                      })}
                    </div>
                  </div>

                    </TabsContent>

                    <TabsContent value="operational" className="min-w-0 space-y-4">

                  <div className="rounded-2xl border border-border bg-muted/60 p-4 dark:border-cyan-400/15 dark:bg-slate-950/60">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t("reduceLogs.operationalTitle")}</p>
                      </div>
                      {activeFile ? (
                        <Badge className={getProcessingStatusVisual(activeFile.processingStatus).badge}>
                          {getStatusLabel(activeFile.processingStatus, t)} · {activeFile.fileName}
                        </Badge>
                      ) : null}
                    </div>

                    {activeFile ? (
                      <Tabs value={activeFileTab} onValueChange={setActiveFileTab} className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("reduceLogs.activeFilePanelKicker")}</p>
                          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 rounded-xl border border-border bg-muted p-1.5 dark:border-white/12 dark:bg-slate-950/85">
                          {visibleMonitoredFiles.map((file) => {
                            const processingVisual = getProcessingStatusVisual(file.processingStatus);
                            return (
                              <TabsTrigger
                                key={`tab-${file.fileName}`}
                                value={file.fileName}
                                className={`max-w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors data-[state=active]:border-cyan-400/45 data-[state=active]:bg-cyan-500/20 data-[state=active]:shadow-[0_0_16px_-6px_rgba(34,211,238,0.35)] hover:bg-white/5 ${processingVisual.row}`}
                              >
                                <div className="text-left">
                                  <p className="text-xs font-medium">{file.fileName}</p>
                                  <p className={`text-[11px] ${processingVisual.label}`}>{getStatusLabel(file.processingStatus, t)} · {formatFileProcessingPercent(file.processingProgress)}</p>
                                </div>
                              </TabsTrigger>
                            );
                          })}
                          </TabsList>
                        </div>

                        {visibleMonitoredFiles.map((file) => {
                          const reduction = getFileReductionDisplayPercent(file);
                          const lastEventAt = fileLastEventAtMap.get(file.fileName);
                          const isPossiblyStalled = file.processingStatus === "running" && (!lastEventAt || (uiNowMs - lastEventAt.getTime() > staleThresholdMsForFile(file)));
                          const stageSince = fileCurrentStageSinceMap.get(file.fileName);
                          const stageElapsedMs = stageHintElapsedMs(
                            file.processingStatus,
                            stageSince,
                            lastEventAt,
                            uiNowMs,
                          );
                          const isStageLong = stageElapsedMs > STAGE_WARNING_THRESHOLD_MS && (file.processingStatus === "running" || file.processingStatus === "queued");
                          return (
                            <TabsContent key={`content-${file.fileName}`} value={file.fileName} className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-4">
                                <MetricCard
                                  icon={RefreshCw}
                                  label={t("reduceLogs.metricUploadLabel")}
                                  value={`${file.uploadProgress}%`}
                                  helper={
                                    file.uploadReused ? t("reduceLogs.reusedHelper") : getStatusLabel(file.uploadStatus, t)
                                  }
                                />
                                <MetricCard
                                  icon={Database}
                                  label={t("reduceLogs.metricProcessLabel")}
                                  value={formatFileProcessingPercent(file.processingProgress)}
                                  helper={`${getStatusLabel(file.processingStatus, t)} · ${file.currentStage}`}
                                />
                                <MetricCard
                                  icon={FileArchive}
                                  label={t("reduceLogs.metricSizeBefore")}
                                  value={formatBytes(file.originalBytes)}
                                  helper={t("reduceLogs.linesHelper", { n: file.originalLineCount })}
                                />
                                <MetricCard
                                  icon={ShieldCheck}
                                  label={t("reduceLogs.metricSizeAfter")}
                                  value={formatBytes(file.reducedBytes)}
                                  helper={t("reduceLogs.linesAfterHelper", {
                                    n: file.reducedLineCount,
                                    pct: formatPercentFine(reduction),
                                  })}
                                />
                              </div>

                              <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
                                <div className="rounded-2xl border border-border bg-muted/50 dark:border-white/10 dark:bg-black/20 p-4">
                                  <p className="text-sm font-medium text-foreground">{t("reduceLogs.stepExecutedTitle")}</p>
                                  <div className="mt-4 space-y-3">
                                    <StepRow
                                      title={t("reduceLogs.stepReceive")}
                                      tone={file.uploadStatus === "failed" ? "failed" : file.uploadProgress >= 100 ? "done" : "running"}
                                      statusLabel={
                                        file.uploadStatus === "failed"
                                          ? t("reduceLogs.stepStatusFailed")
                                          : file.uploadProgress >= 100
                                            ? t("reduceLogs.stepStatusDone")
                                            : t("reduceLogs.stepStatusRunning")
                                      }
                                      description={`${t("reduceLogs.metricUploadLabel")} ${file.uploadProgress}% · ${formatBytes(file.sizeBytes ?? file.originalBytes)}`}
                                    />
                                    <StepRow
                                      title={t("reduceLogs.stepRead")}
                                      tone={
                                        file.processingStatus === "queued"
                                          ? "waiting"
                                          : file.processingStatus === "running"
                                            ? "running"
                                            : file.processingStatus === "failed"
                                              ? "failed"
                                              : "done"
                                      }
                                      statusLabel={
                                        file.processingStatus === "queued"
                                          ? t("reduceLogs.stepStatusWaiting")
                                          : file.processingStatus === "running"
                                            ? t("reduceLogs.stepStatusRunning")
                                            : file.processingStatus === "failed"
                                              ? t("reduceLogs.stepStatusFailed")
                                              : t("reduceLogs.stepStatusDone")
                                      }
                                      description={file.currentStep}
                                    />
                                    <StepRow
                                      title={t("reduceLogs.stepConsolidate")}
                                      tone={file.processingStatus === "completed" ? "done" : file.processingStatus === "failed" ? "failed" : "waiting"}
                                      statusLabel={
                                        file.processingStatus === "completed"
                                          ? t("reduceLogs.stepStatusDone")
                                          : file.processingStatus === "failed"
                                            ? t("reduceLogs.stepStatusFailed")
                                            : t("reduceLogs.stepStatusWaiting")
                                      }
                                      description={file.lastMessage}
                                    />
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-border bg-muted/50 dark:border-white/10 dark:bg-black/20 p-4">
                                  <p className="text-sm font-medium text-foreground">{t("reduceLogs.stepOperationalReadTitle")}</p>
                                  <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                                    <p>
                                      {t("reduceLogs.heuristicSummary", {
                                        before: formatBytes(file.originalBytes),
                                        after: formatBytes(file.reducedBytes),
                                        pct: formatPercentFine(reduction),
                                      })}
                                    </p>
                                    <p><span className="font-medium text-foreground">{t("reduceLogs.nextReadLabel")}</span> {file.currentStep}</p>
                                    <p><span className="font-medium text-foreground">{t("reduceLogs.lastMsgLabel")}</span> {file.lastMessage}</p>
                                    <p>
                                      <span className="font-medium text-foreground">{t("reduceLogs.activityLabel")}</span>{" "}
                                      {formatLastActivityLabel(lastEventAt, t)}
                                      {isPossiblyStalled ? t("reduceLogs.stallParen") : ""}
                                    </p>
                                    {stageElapsedMs > 0 ? (
                                      <p>
                                        <span className="font-medium text-foreground">{t("reduceLogs.stageTimeLabel")}</span>{" "}
                                        <span className={isStageLong ? "text-amber-200" : "text-muted-foreground"}>
                                          {formatElapsedMs(stageElapsedMs, t)}
                                          {isStageLong ? t("reduceLogs.stageLongParen") : ""}
                                        </span>
                                      </p>
                                    ) : null}
                                    <p>
                                      <span className="font-medium text-foreground">
                                        {t("reduceLogs.criticalSignalsLead")}
                                      </span>{" "}
                                      {t("reduceLogs.criticalSignalsDetail", {
                                        susp: file.suspiciousEventCount,
                                        trg: file.triggerCount,
                                      })}
                                    </p>
                                    <p><span className="font-medium text-foreground">{t("reduceLogs.suggestedActionLabel")}</span> {getFileRecommendation(file)}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-border bg-muted/50 dark:border-white/10 dark:bg-black/20 p-4">
                                <p className="text-sm font-medium text-foreground">{t("reduceLogs.eventsMarcoTitle")}</p>
                                {activeFileEvents.length > 0 ? (
                                  <div className="mt-4 hidden overflow-hidden rounded-xl border border-border md:block dark:border-white/10">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>{t("reduceLogs.thMoment")}</TableHead>
                                          <TableHead>{t("reduceLogs.thStage")}</TableHead>
                                          <TableHead>{t("reduceLogs.thMessage")}</TableHead>
                                          <TableHead>{t("reduceLogs.thProgress")}</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {activeFileEvents.map((event, index) => {
                                          const createdAtLabel = event.createdAt ? new Date(event.createdAt).toLocaleTimeString(timeLocale) : "—";
                                          const rowKey = `${file.fileName}-event-${index}-${event.createdAt ? new Date(event.createdAt).getTime() : t("reduceLogs.eventNoDataKey")}`;

                                          return (
                                          <TableRow key={rowKey}>
                                            <TableCell>{createdAtLabel}</TableCell>
                                            <TableCell>{event.stage}</TableCell>
                                            <TableCell>{event.message}</TableCell>
                                            <TableCell>{event.progress}%</TableCell>
                                          </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : null}

                                {activeFileEvents.length > 0 ? (
                                  <div className="mt-4 space-y-2 md:hidden">
                                    {activeFileEvents.map((event, index) => {
                                      const createdAtLabel = event.createdAt ? new Date(event.createdAt).toLocaleTimeString(timeLocale) : "—";
                                      return (
                                        <div key={`event-mobile-${file.fileName}-${index}`} className="rounded-lg border border-border bg-muted/70 p-3 dark:border-white/10 dark:bg-slate-950/60">
                                          <p className="text-xs text-muted-foreground">{createdAtLabel}</p>
                                          <p className="mt-1 text-sm font-medium text-foreground">{event.stage}</p>
                                          <p className="mt-1 text-sm text-muted-foreground">{event.message}</p>
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {t("reduceLogs.progressLabelShort", { pct: event.progress })}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                    {t("reduceLogs.noEventsYet")}
                                  </p>
                                )}
                              </div>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    ) : null}
                  </div>

                    </TabsContent>
                  </Tabs>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}

function StepRow({
  title,
  tone,
  statusLabel,
  description,
}: {
  title: string;
  tone: "done" | "failed" | "running" | "waiting";
  statusLabel: string;
  description: string;
}) {
  const badgeClass =
    tone === "done"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
      : tone === "failed"
        ? "border-rose-400/25 bg-rose-500/10 text-rose-200"
        : tone === "running"
          ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-300"
          : tone === "waiting"
            ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
            : "border-border bg-muted/50 text-muted-foreground dark:border-white/10 dark:bg-white/5";

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <Badge className={badgeClass}>{statusLabel}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
