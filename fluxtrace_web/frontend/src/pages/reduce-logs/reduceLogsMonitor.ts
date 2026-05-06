import i18n from "@/i18n/config";

export type LogType = "FunctionInterceptor" | "TraceFcnCall" | "TraceMemory" | "TraceInstructions" | "TraceDisassembly" | "Unknown";
export type ProcessingStatus = "queued" | "uploading" | "running" | "completed" | "failed";

export type SubmittedFileMonitor = {
  fileName: string;
  logType: LogType;
  sizeBytes: number;
  uploadProgress: number;
  uploadStatus: ProcessingStatus;
  uploadFileId?: string;
  uploadDurationMs?: number;
  uploadReused?: boolean;
};

export type DetailFileMonitor = {
  fileName: string;
  logType?: LogType | string;
  status?: ProcessingStatus | string;
  progress?: number;
  currentStage?: string;
  currentStep?: string;
  lastMessage?: string;
  originalLineCount?: number;
  reducedLineCount?: number;
  originalBytes?: number;
  reducedBytes?: number;
  suspiciousEventCount?: number;
  triggerCount?: number;
  uploadDurationMs?: number;
  /** Tempo de processamento no servidor (heurística até conclusão/falha ou em curso), ms. */
  processingDurationMs?: number;
  uploadReused?: boolean;
};

export type FileMonitor = {
  fileName: string;
  logType: LogType;
  sizeBytes: number;
  uploadProgress: number;
  uploadStatus: ProcessingStatus;
  processingStatus: ProcessingStatus;
  /** `null` = percentagem ainda desconhecida (evita marcos enganadores como 20 %/45 %). */
  processingProgress: number | null;
  currentStage: string;
  currentStep: string;
  lastMessage: string;
  originalLineCount: number;
  reducedLineCount: number;
  originalBytes: number;
  reducedBytes: number;
  suspiciousEventCount: number;
  triggerCount: number;
  uploadDurationMs: number;
  processingDurationMs: number;
  uploadReused: boolean;
};

/** i18next instance inicializado pela app; garante `lng` válido quando módulos rodam antes do detector. */
function monitorT(key: string, options?: Record<string, unknown>) {
  const lng = i18n.resolvedLanguage ?? i18n.language ?? "pt-BR";
  return String(i18n.getFixedT(lng)(`reduceLogs.monitor.${key}`, options as never));
}

export function isArchiveContainerFile(fileName: string) {
  const lowered = fileName.toLowerCase();
  return lowered.endsWith(".7z") || lowered.endsWith(".zip") || lowered.endsWith(".rar");
}

/** Último segmento (Windows/macOS/Unix) — alinha p.ex. `Pasta/x.cdf` com `x.cdf` do input do browser. */
function logFileBasename(fileName: string): string {
  const parts = fileName.split(/[/\\]/);
  return parts.at(-1) ?? fileName;
}

/**
 * Faz corresponder a linha da grelha (nome vindo do servidor) ao estado de upload local pelo nome
 * completo; se não houver, tenta o basename quando for inequívoco.
 */
function resolveLocalForRow(
  fileName: string,
  localByFullName: Map<string, SubmittedFileMonitor>,
  submittedList: SubmittedFileMonitor[],
): SubmittedFileMonitor | undefined {
  const direct = localByFullName.get(fileName);
  if (direct) return direct;
  const base = logFileBasename(fileName);
  const byBase = submittedList.filter((f) => logFileBasename(f.fileName) === base);
  if (byBase.length === 1) return byBase[0]!;
  return undefined;
}

export function inferLogType(fileName: string): LogType {
  const lowered = fileName.toLowerCase();
  if (lowered.includes("functioninterceptor") || lowered.includes("function_interceptor")) return "FunctionInterceptor";
  if (lowered.includes("tracefcncall") || lowered.includes("trace_fcn_call")) return "TraceFcnCall";
  if (lowered.includes("tracememory") || lowered.includes("trace_memory")) return "TraceMemory";
  if (lowered.includes("traceinstructions") || lowered.includes("trace_instructions")) return "TraceInstructions";
  if (lowered.includes("tracedisassembly") || lowered.includes("trace_disassembly")) return "TraceDisassembly";
  return "Unknown";
}

/**
 * % mostrada na coluna "Reduzido": após conclusão, redução real de volume; antes disso, 0% ou o progresso
 * de leitura/heurística (0–100) para não mostrar 100% por engano com `reducedBytes === 0`.
 */
export function getFileReductionDisplayPercent(file: FileMonitor): number {
  if (file.originalBytes <= 0) {
    return 0;
  }
  if (file.processingStatus === "completed") {
    return Math.max(0, Math.min(100, 100 * (1 - file.reducedBytes / file.originalBytes)));
  }
  if (file.processingStatus === "failed") {
    return 0;
  }
  if (file.reducedBytes > 0 && file.reducedBytes < file.originalBytes) {
    return Math.max(0, Math.min(100, 100 * (1 - file.reducedBytes / file.originalBytes)));
  }
  if (file.processingStatus === "running" && file.processingProgress != null) {
    return Math.max(0, Math.min(100, file.processingProgress));
  }
  return 0;
}

export function getFileInterpretation(file: FileMonitor) {
  if (file.uploadStatus === "failed" || file.processingStatus === "failed") {
    return monitorT("interpretFailed");
  }
  if (file.uploadStatus === "uploading") {
    return file.sizeBytes >= 1024 * 1024 * 1024
      ? monitorT("interpretUploadLarge")
      : monitorT("interpretUploadSmall");
  }
  if (file.processingStatus === "queued") {
    return file.uploadReused
      ? monitorT("interpretQueuedReused")
      : monitorT("interpretQueuedFresh");
  }
  if (file.processingStatus === "running") {
    return monitorT("interpretRunning");
  }
  if (file.triggerCount > 0 || file.suspiciousEventCount > 0) {
    return monitorT("interpretSignals");
  }
  return monitorT("interpretNeutral");
}

export function getFileRecommendation(file: FileMonitor) {
  if (file.uploadStatus === "failed" || file.processingStatus === "failed") {
    return monitorT("recoFailed");
  }
  if (file.uploadStatus === "uploading") {
    return file.sizeBytes >= 1024 * 1024 * 1024
      ? monitorT("recoUploadLarge")
      : monitorT("recoUploadSmall");
  }
  if (file.processingStatus === "queued") {
    return file.uploadReused
      ? monitorT("recoQueuedReused")
      : monitorT("recoQueuedFresh");
  }
  if (file.processingStatus === "running") {
    return monitorT("recoRunning");
  }
  if (file.triggerCount > 0 || file.suspiciousEventCount > 0) {
    return monitorT("recoSignals");
  }
  return monitorT("recoNeutral");
}

export function buildMonitoredFiles(submittedFiles: SubmittedFileMonitor[], detailFiles: DetailFileMonitor[]) {
  /** A grelha de acompanhamento é só para logs; nunca listar o .7z/.zip/.rar (após extração, as linhas vêm do detalhe do servidor). */
  const detailRows = detailFiles.filter((file) => !isArchiveContainerFile(file.fileName));
  const normalizedSubmitted = submittedFiles.filter((file) => !isArchiveContainerFile(file.fileName));

  const detailMap = new Map(detailRows.map((file) => [file.fileName, file]));
  const localMap = new Map(normalizedSubmitted.map((file) => [file.fileName, file]));
  const allNames = Array.from(new Set([
    ...normalizedSubmitted.map((file) => file.fileName),
    ...detailRows.map((file) => file.fileName),
  ]));

  return allNames.map((fileName) => {
    const local = resolveLocalForRow(fileName, localMap, normalizedSubmitted);
    const detail = detailMap.get(fileName);
    const processingStatus = (detail?.status as ProcessingStatus | undefined)
      ?? (local?.uploadStatus === "failed" ? "failed" : "queued");
    const processingProgress: number | null = typeof detail?.progress === "number" && Number.isFinite(detail.progress)
      ? detail.progress
      : processingStatus === "completed"
        ? 100
        : processingStatus === "failed"
          ? 0
          : processingStatus === "running"
            ? null
            : 0;
    const uploadStatus = local?.uploadStatus ?? (detail ? "completed" : "queued");
    const uploadReused = detail?.uploadReused ?? local?.uploadReused ?? false;
    const isPreUpload = local?.uploadStatus === "uploading" && (local?.uploadProgress ?? 0) === 0;
    const fallbackStage = isPreUpload
      ? monitorT("stagePrepareUpload")
      : uploadStatus === "uploading"
        ? monitorT("stageUploadingParts")
        : uploadStatus === "failed"
        ? monitorT("stageUploadFailed")
        : processingStatus === "failed"
          ? monitorT("stageProcessFailed")
          : processingStatus === "running"
            ? monitorT("stageHeuristicRunning")
            : processingStatus === "completed"
              ? monitorT("stageResultDone")
              : uploadReused
                ? monitorT("stageReused")
                : uploadStatus === "completed"
                  ? monitorT("stageReceived")
                  : monitorT("stageAwaitProcess");
    const fallbackStep = isPreUpload
      ? monitorT("stepAwaitInit")
      : uploadStatus === "uploading"
        ? monitorT("stepUploadRobust")
        : uploadStatus === "failed"
        ? monitorT("stepReupload")
        : processingStatus === "failed"
          ? monitorT("stepConsolidateFail")
          : processingStatus === "running"
            ? monitorT("stepHeuristicRunning")
            : processingStatus === "completed"
              ? monitorT("stepReductionDone")
              : uploadReused
                ? monitorT("stepAwaitReprocess")
                : uploadStatus === "completed"
                  ? monitorT("stepAwaitBatch")
                  : monitorT("stepQueued");
    const fallbackMessage = isPreUpload
      ? monitorT("msgPrepareSession", { fileName })
      : uploadStatus === "uploading"
        ? monitorT("msgTransmitting", { fileName })
        : uploadStatus === "failed"
        ? monitorT("msgUploadFailed", { fileName })
        : processingStatus === "failed"
          ? monitorT("msgProcessFailed", { fileName })
          : processingStatus === "running"
            ? monitorT("msgProcessing", { fileName })
            : processingStatus === "completed"
              ? monitorT("msgCompleted", { fileName })
              : uploadReused
                ? monitorT("msgReusedWait", { fileName })
                : monitorT("msgReceivedWait", { fileName });

    return {
      fileName,
      logType: (detail?.logType as LogType | undefined) ?? local?.logType ?? inferLogType(fileName),
      sizeBytes: detail?.originalBytes ?? local?.sizeBytes ?? 0,
      uploadProgress: local?.uploadProgress ?? 100,
      uploadStatus,
      processingStatus,
      processingProgress,
      uploadDurationMs: detail?.uploadDurationMs ?? local?.uploadDurationMs ?? 0,
      processingDurationMs: detail?.processingDurationMs ?? 0,
      uploadReused,
      currentStage: detail?.currentStage ?? fallbackStage,
      currentStep: detail?.currentStep ?? fallbackStep,
      lastMessage: detail?.lastMessage ?? fallbackMessage,
      originalLineCount: detail?.originalLineCount ?? 0,
      reducedLineCount: detail?.reducedLineCount ?? 0,
      originalBytes: detail?.originalBytes ?? local?.sizeBytes ?? 0,
      reducedBytes: detail?.reducedBytes ?? 0,
      suspiciousEventCount: detail?.suspiciousEventCount ?? 0,
      triggerCount: detail?.triggerCount ?? 0,
    } satisfies FileMonitor;
  });
}
