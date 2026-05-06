import { and, asc, count, desc, eq, gte, inArray, like, lte, sql } from "drizzle-orm";
import {
  AnalysisArtifact,
  AnalysisCommit,
  AnalysisEvent,
  AnalysisInsight,
  AnalysisBatch,
  analysisArtifacts,
  analysisCommits,
  analysisEvents,
  analysisInsights,
  analysisBatches,
  InsertAnalysisArtifact,
  InsertAnalysisCommit,
  InsertAnalysisEvent,
  InsertAnalysisInsight,
  InsertAnalysisBatch,
} from "../../drizzle/schema";
import {
  applyDistributedProcessingEstimate,
  resolveDashboardCompletedWallTimes,
  sumWallMsFromInsightSummary,
  type WallCalibrationInputRow,
  type WallMsSource,
} from "../analysis/analysisWallCalibration";
import { getDb } from "./connection";

let inMemoryAnalysisEventId = 1;
const inMemoryAnalysisBatches = new Map<string, AnalysisBatch>();
const inMemoryAnalysisEvents = new Map<string, AnalysisEvent[]>();
const inMemoryAnalysisArtifacts = new Map<string, AnalysisArtifact[]>();
const inMemoryAnalysisInsights = new Map<string, AnalysisInsight>();
const inMemoryAnalysisCommits = new Map<string, AnalysisCommit>();

export async function createAnalysisBatch(insert: InsertAnalysisBatch) {
  const db = await getDb();
  if (!db) {
    const now = new Date();
    const row: AnalysisBatch = {
      id: inMemoryAnalysisBatches.size + 1,
      batchId: String(insert.batchId),
      pipelineBatchRef: insert.pipelineBatchRef ?? null,
      sampleName: String(insert.sampleName),
      sampleSha256: insert.sampleSha256 ?? null,
      sourceArchiveName: String(insert.sourceArchiveName),
      sourceArchiveUrl: insert.sourceArchiveUrl ?? null,
      sourceArchiveStorageKey: insert.sourceArchiveStorageKey ?? null,
      focusFunction: String(insert.focusFunction),
      focusTermsJson: insert.focusTermsJson ?? null,
      focusRegexesJson: insert.focusRegexesJson ?? null,
      status: insert.status ?? "queued",
      progress: Number(insert.progress ?? 0),
      stage: String(insert.stage ?? "queued"),
      message: insert.message ?? null,
      stdoutTail: insert.stdoutTail ?? null,
      stderrTail: insert.stderrTail ?? null,
      pipelineBaseUrl: insert.pipelineBaseUrl ?? null,
      pipelineExternalPath: insert.pipelineExternalPath ?? null,
      resultPath: insert.resultPath ?? null,
      errorMessage: insert.errorMessage ?? null,
      llmSummaryStatus: insert.llmSummaryStatus ?? "pending",
      commitStatus: insert.commitStatus ?? "pending",
      createdByUserId: insert.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: insert.completedAt ?? null,
    };
    inMemoryAnalysisBatches.set(insert.batchId, row);
    return row;
  }

  await db.insert(analysisBatches).values(insert);
  return getAnalysisBatchByBatchId(insert.batchId);
}

export async function getAnalysisBatchByBatchId(batchId: string) {
  const db = await getDb();
  if (!db) {
    return inMemoryAnalysisBatches.get(batchId);
  }

  const result = await db.select().from(analysisBatches).where(eq(analysisBatches.batchId, batchId)).limit(1);
  return result[0];
}

export async function listAnalysisBatches(filters?: {
  sampleName?: string;
  focusFunction?: string;
  createdFrom?: Date;
  createdTo?: Date;
  status?: Array<"queued" | "running" | "completed" | "failed" | "cancelled">;
  /** Se definido, só devolve lotes com este `createdByUserId` (Centro: cada analista vê os seus). */
  createdByUserId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) {
    const rows = Array.from(inMemoryAnalysisBatches.values())
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const filtered = rows.filter((row) => {
      if (filters?.createdByUserId != null && row.createdByUserId !== filters.createdByUserId) {
        return false;
      }
      if (filters?.sampleName && !String(row.sampleName ?? "").toLowerCase().includes(filters.sampleName.toLowerCase())) {
        return false;
      }
      if (filters?.focusFunction && !String(row.focusFunction ?? "").toLowerCase().includes(filters.focusFunction.toLowerCase())) {
        return false;
      }
      if (filters?.createdFrom && row.createdAt < filters.createdFrom) {
        return false;
      }
      if (filters?.createdTo && row.createdAt > filters.createdTo) {
        return false;
      }
      if (filters?.status?.length && !filters.status.includes(row.status)) {
        return false;
      }
      return true;
    });

    return filtered.slice(0, filters?.limit ?? 50);
  }

  const conditions = [];
  if (filters?.createdByUserId != null) {
    conditions.push(eq(analysisBatches.createdByUserId, filters.createdByUserId));
  }
  if (filters?.sampleName) {
    conditions.push(like(analysisBatches.sampleName, `%${filters.sampleName}%`));
  }
  if (filters?.focusFunction) {
    conditions.push(like(analysisBatches.focusFunction, `%${filters.focusFunction}%`));
  }
  if (filters?.createdFrom) {
    conditions.push(gte(analysisBatches.createdAt, filters.createdFrom));
  }
  if (filters?.createdTo) {
    conditions.push(lte(analysisBatches.createdAt, filters.createdTo));
  }
  if (filters?.status?.length) {
    conditions.push(inArray(analysisBatches.status, filters.status));
  }

  const query = db.select().from(analysisBatches);
  const rows = conditions.length ? await query.where(and(...conditions)).orderBy(desc(analysisBatches.createdAt)).limit(filters?.limit ?? 50) : await query.orderBy(desc(analysisBatches.createdAt)).limit(filters?.limit ?? 50);

  return rows;
}

export async function updateAnalysisBatch(batchId: string, patch: Partial<InsertAnalysisBatch>) {
  const db = await getDb();
  if (!db) {
    const current = inMemoryAnalysisBatches.get(batchId);
    if (!current) {
      return null;
    }
    const updated: AnalysisBatch = {
      ...current,
      ...patch,
      updatedAt: new Date(),
    };
    inMemoryAnalysisBatches.set(batchId, updated);
    return updated;
  }

  await db.update(analysisBatches).set({ ...patch, updatedAt: new Date() }).where(eq(analysisBatches.batchId, batchId));
  return getAnalysisBatchByBatchId(batchId);
}

export async function addAnalysisEvent(event: InsertAnalysisEvent) {
  const db = await getDb();
  if (!db) {
    const list = inMemoryAnalysisEvents.get(event.batchId) ?? [];
    const inserted: AnalysisEvent = {
      ...event,
      id: inMemoryAnalysisEventId++,
      eventType: event.eventType ?? "info",
      stage: event.stage ?? null,
      message: event.message ?? null,
      progress: event.progress ?? null,
      payloadJson: event.payloadJson ?? null,
      createdAt: new Date(),
    };
    list.unshift(inserted);
    inMemoryAnalysisEvents.set(event.batchId, list);
    return inserted;
  }

  await db.insert(analysisEvents).values(event);
  const rows = await db.select().from(analysisEvents).where(eq(analysisEvents.batchId, event.batchId)).orderBy(desc(analysisEvents.id)).limit(1);
  return rows[0] ?? null;
}

export async function listAnalysisEvents(batchId: string, limit = 200) {
  const db = await getDb();
  if (!db) {
    const list = inMemoryAnalysisEvents.get(batchId) ?? [];
    return list.slice(0, limit);
  }

  return db.select().from(analysisEvents).where(eq(analysisEvents.batchId, batchId)).orderBy(desc(analysisEvents.createdAt)).limit(limit);
}

/** O evento `submission` é antigo na timeline mas necessário para reconstruir a lista de ficheiros no detalhe do lote. */
export async function getAnalysisSubmissionEvent(batchId: string): Promise<AnalysisEvent | null> {
  const db = await getDb();
  if (!db) {
    const list = inMemoryAnalysisEvents.get(batchId) ?? [];
    return [...list].reverse().find((row) => row.eventType === "submission") ?? null;
  }

  const rows = await db
    .select()
    .from(analysisEvents)
    .where(and(eq(analysisEvents.batchId, batchId), eq(analysisEvents.eventType, "submission")))
    .orderBy(asc(analysisEvents.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function replaceAnalysisArtifacts(batchId: string, artifacts: InsertAnalysisArtifact[]) {
  const db = await getDb();
  if (!db) {
    const now = new Date();
    const rows: AnalysisArtifact[] = artifacts.map((artifact, index) => ({
      id: index + 1,
      batchId,
      artifactType: String(artifact.artifactType),
      label: String(artifact.label),
      relativePath: String(artifact.relativePath),
      sourcePath: artifact.sourcePath ?? null,
      storageUrl: artifact.storageUrl ?? null,
      storageKey: artifact.storageKey ?? null,
      mimeType: artifact.mimeType ?? null,
      sizeBytes: typeof artifact.sizeBytes === "number" ? artifact.sizeBytes : null,
      createdAt: now,
    }));
    inMemoryAnalysisArtifacts.set(batchId, rows);
    return rows;
  }

  await db.delete(analysisArtifacts).where(eq(analysisArtifacts.batchId, batchId));
  if (artifacts.length === 0) {
    return [];
  }

  await db.insert(analysisArtifacts).values(artifacts);
  return listAnalysisArtifacts(batchId);
}

export async function listAnalysisArtifacts(batchId: string) {
  const db = await getDb();
  if (!db) {
    return inMemoryAnalysisArtifacts.get(batchId) ?? [];
  }

  return db.select().from(analysisArtifacts).where(eq(analysisArtifacts.batchId, batchId)).orderBy(desc(analysisArtifacts.createdAt));
}

export async function upsertAnalysisInsight(batchId: string, insight: InsertAnalysisInsight) {
  const db = await getDb();
  if (!db) {
    const current = inMemoryAnalysisInsights.get(batchId);
    const now = new Date();
    const next: AnalysisInsight = {
      id: current?.id ?? inMemoryAnalysisInsights.size + 1,
      batchId,
      modelName: insight.modelName ?? current?.modelName ?? null,
      riskLevel: insight.riskLevel ?? current?.riskLevel ?? null,
      title: insight.title ?? current?.title ?? null,
      summaryMarkdown: insight.summaryMarkdown ?? current?.summaryMarkdown ?? "",
      summaryJson: insight.summaryJson ?? current?.summaryJson ?? null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    inMemoryAnalysisInsights.set(batchId, next);
    return next;
  }

  await db
    .insert(analysisInsights)
    .values({ ...insight, batchId })
    .onConflictDoUpdate({
      target: analysisInsights.batchId,
      set: {
        modelName: insight.modelName ?? null,
        riskLevel: insight.riskLevel ?? null,
        title: insight.title ?? null,
        summaryMarkdown: insight.summaryMarkdown,
        summaryJson: insight.summaryJson ?? null,
        updatedAt: new Date(),
      },
    });

  return getAnalysisInsight(batchId);
}

export async function getAnalysisInsight(batchId: string) {
  const db = await getDb();
  if (!db) {
    return inMemoryAnalysisInsights.get(batchId);
  }

  const rows = await db.select().from(analysisInsights).where(eq(analysisInsights.batchId, batchId)).limit(1);
  return rows[0];
}

export async function upsertAnalysisCommit(batchId: string, commit: InsertAnalysisCommit) {
  const db = await getDb();
  if (!db) {
    const current = inMemoryAnalysisCommits.get(batchId);
    const now = new Date();
    const next: AnalysisCommit = {
      id: current?.id ?? inMemoryAnalysisCommits.size + 1,
      batchId,
      repository: commit.repository ?? current?.repository ?? "local",
      branch: commit.branch ?? current?.branch ?? "main",
      commitHash: commit.commitHash ?? current?.commitHash ?? null,
      commitMessage: commit.commitMessage ?? current?.commitMessage ?? null,
      status: commit.status ?? current?.status ?? "pending",
      detailsJson: commit.detailsJson ?? current?.detailsJson ?? null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    inMemoryAnalysisCommits.set(batchId, next);
    return next;
  }

  const existing = await getAnalysisCommit(batchId);
  if (!existing) {
    await db.insert(analysisCommits).values({ ...commit, batchId });
  } else {
    await db.update(analysisCommits).set({
      repository: commit.repository,
      branch: commit.branch ?? existing.branch,
      commitHash: commit.commitHash ?? null,
      commitMessage: commit.commitMessage ?? null,
      status: commit.status ?? existing.status,
      detailsJson: commit.detailsJson ?? null,
      updatedAt: new Date(),
    }).where(eq(analysisCommits.batchId, batchId));
  }

  return getAnalysisCommit(batchId);
}

export async function getAnalysisCommit(batchId: string) {
  const db = await getDb();
  if (!db) {
    return inMemoryAnalysisCommits.get(batchId);
  }

  const rows = await db.select().from(analysisCommits).where(eq(analysisCommits.batchId, batchId)).limit(1);
  return rows[0];
}

/**
 * Apaga o lote e linhas dependentes. Retorna `true` se o lote existia.
 * Em memória, remove o lote e toda a cadeia associada ao `batchId`.
 */
export async function deleteAnalysisBatchAndRelatedData(batchId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    inMemoryAnalysisEvents.delete(batchId);
    inMemoryAnalysisArtifacts.delete(batchId);
    inMemoryAnalysisInsights.delete(batchId);
    inMemoryAnalysisCommits.delete(batchId);
    return inMemoryAnalysisBatches.delete(batchId);
  }

  return await db.transaction(async (tx) => {
    await tx.delete(analysisEvents).where(eq(analysisEvents.batchId, batchId));
    await tx.delete(analysisArtifacts).where(eq(analysisArtifacts.batchId, batchId));
    await tx.delete(analysisInsights).where(eq(analysisInsights.batchId, batchId));
    await tx.delete(analysisCommits).where(eq(analysisCommits.batchId, batchId));
    const removed = await tx
      .delete(analysisBatches)
      .where(eq(analysisBatches.batchId, batchId))
      .returning({ id: analysisBatches.id });
    return removed.length > 0;
  });
}

export type AnalysisDashboardStats = {
  totalBatches: number;
  byStatus: Record<string, number>;
  /** Chave yyyy-mm-dd, últimos 7 dias; valores 0 se vazio. */
  createdLast7Days: { date: string; count: number }[];
  /**
   * Lotes concluídos (mais recentes primeiro). `wallMs` pode ser medido em fileMetrics
   * ou estimado (tamanho dos ficheiros ou duração do lote quando não havia timestamps).
   */
  completedWallTimes: Array<{
    batchId: string;
    sampleName: string;
    wallMs: number;
    endedAtIso: string;
    wallMsSource: WallMsSource;
    totalOriginalBytes: number;
  }>;
};

export { sumWallMsFromInsightSummary };

const DASHBOARD_WALL_PERSIST_PER_REQUEST = 20;

async function persistEstimatedWallSnapshots(
  resolved: Array<{
    batchId: string;
    wallMs: number;
    wallMsSource: WallMsSource;
  }>,
): Promise<void> {
  let n = 0;
  for (const entry of resolved) {
    if (entry.wallMsSource === "measured") continue;
    if (n >= DASHBOARD_WALL_PERSIST_PER_REQUEST) break;

    const existing = await getAnalysisInsight(entry.batchId);
    if (!existing?.summaryMarkdown) continue;
    /** Já há tempos por ficheiros — não sobrescrever heurísticas. */
    const already = sumWallMsFromInsightSummary(existing.summaryJson);
    if (already >= 200) continue;

    const patched = applyDistributedProcessingEstimate(existing.summaryJson, entry.wallMs);
    if (!patched) continue;

    const payload: InsertAnalysisInsight = {
      batchId: entry.batchId,
      summaryMarkdown: existing.summaryMarkdown,
      summaryJson: patched,
      modelName: existing.modelName,
      riskLevel: existing.riskLevel,
      title: existing.title,
    };
    await upsertAnalysisInsight(entry.batchId, payload);
    n += 1;
  }
}

/**
 * Estatísticas agregadas para o dashboard; `createdByUserId` restringe a analistas não-admin.
 */
export async function getAnalysisDashboardStats(filters: {
  createdByUserId?: number;
}): Promise<AnalysisDashboardStats> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const db = await getDb();
  if (!db) {
    const all = Array.from(inMemoryAnalysisBatches.values());
    const scoped = all.filter(
      (j) => filters.createdByUserId == null || j.createdByUserId === filters.createdByUserId,
    );
    const byStatus: Record<string, number> = {};
    for (const s of ["queued", "running", "completed", "failed", "cancelled"] as const) {
      byStatus[s] = 0;
    }
    for (const j of scoped) {
      byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    }
    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const c = scoped.filter((j) => j.createdAt >= d && j.createdAt < next).length;
      days.push({ date: key, count: c });
    }

    const completedBatches = scoped
      .filter((j) => j.status === "completed")
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 200);

    const wallInputs: WallCalibrationInputRow[] = completedBatches.map((batchRow) => ({
      batchId: batchRow.batchId,
      sampleName: batchRow.sampleName,
      summaryJson: inMemoryAnalysisInsights.get(batchRow.batchId)?.summaryJson,
      completedAt: batchRow.completedAt,
      updatedAt: batchRow.updatedAt,
      createdAt: batchRow.createdAt,
    }));

    const completedWallTimes = resolveDashboardCompletedWallTimes(wallInputs, { maxReturn: 120 });
    void persistEstimatedWallSnapshots(completedWallTimes).catch((err) => {
      console.warn("[Dashboard] persistEstimatedWallSnapshots (in-memory)", err);
    });

    return {
      totalBatches: scoped.length,
      byStatus,
      createdLast7Days: days,
      completedWallTimes,
    };
  }

  const scope = filters.createdByUserId != null ? eq(analysisBatches.createdByUserId, filters.createdByUserId) : undefined;

  const statusBase = db
    .select({
      status: analysisBatches.status,
      n: count(),
    })
    .from(analysisBatches);
  const statusRows = scope
    ? await statusBase.where(scope).groupBy(analysisBatches.status)
    : await statusBase.groupBy(analysisBatches.status);

  const byStatus: Record<string, number> = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const row of statusRows) {
    byStatus[row.status] = Number(row.n);
  }

  const totalBase = db.select({ n: count() }).from(analysisBatches);
  const totalRows = scope ? await totalBase.where(scope) : await totalBase;
  const totalBatches = Number(totalRows[0]?.n ?? 0);

  const dayExpr = sql<string>`to_char(date_trunc('day', ${analysisBatches.createdAt}), 'YYYY-MM-DD')`;
  const dayFilter = scope
    ? and(scope, gte(analysisBatches.createdAt, sevenDaysAgo))
    : gte(analysisBatches.createdAt, sevenDaysAgo);
  const dayBase = db
    .select({
      day: dayExpr,
      n: count(),
    })
    .from(analysisBatches)
    .where(dayFilter)
    .groupBy(sql`date_trunc('day', ${analysisBatches.createdAt})`);
  const dayRows = await dayBase;

  const byDay = new Map(dayRows.map((r) => [r.day, Number(r.n)]));
  const createdLast7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    createdLast7Days.push({ date: key, count: byDay.get(key) ?? 0 });
  }

  const wallWhere =
    filters.createdByUserId != null
      ? and(eq(analysisBatches.status, "completed"), eq(analysisBatches.createdByUserId, filters.createdByUserId))
      : eq(analysisBatches.status, "completed");
  const wallRows = await db
    .select({
      batchId: analysisBatches.batchId,
      sampleName: analysisBatches.sampleName,
      summaryJson: analysisInsights.summaryJson,
      completedAt: analysisBatches.completedAt,
      updatedAt: analysisBatches.updatedAt,
      createdAt: analysisBatches.createdAt,
    })
    .from(analysisBatches)
    .leftJoin(analysisInsights, eq(analysisBatches.batchId, analysisInsights.batchId))
    .where(wallWhere)
    .orderBy(desc(sql`COALESCE(${analysisBatches.completedAt}, ${analysisBatches.updatedAt})`))
    .limit(200);

  const wallInputsPostgres: WallCalibrationInputRow[] = wallRows.map((r) => ({
    batchId: r.batchId,
    sampleName: r.sampleName,
    summaryJson: r.summaryJson,
    completedAt: r.completedAt,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));

  const completedWallTimes = resolveDashboardCompletedWallTimes(wallInputsPostgres, { maxReturn: 120 });
  void persistEstimatedWallSnapshots(completedWallTimes).catch((err) => {
    console.warn("[Dashboard] persistEstimatedWallSnapshots", err);
  });

  return { totalBatches, byStatus, createdLast7Days, completedWallTimes };
}
