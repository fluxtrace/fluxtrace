import { describe, beforeEach, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../../_core/server/context";

const {
  mockStartAnalysisBatch,
  mockGetAnalysisBatchDetail,
  mockGetReductionBaselineMetrics,
  mockSyncAnalysisBatch,
  mockSyncActiveAnalysisBatches,
  mockListAnalysisBatches,
  mockRemoveLocalBatchWorkspace,
} = vi.hoisted(() => ({
  mockStartAnalysisBatch: vi.fn(),
  mockGetAnalysisBatchDetail: vi.fn(),
  mockGetReductionBaselineMetrics: vi.fn(),
  mockSyncAnalysisBatch: vi.fn(),
  mockSyncActiveAnalysisBatches: vi.fn(),
  mockListAnalysisBatches: vi.fn(),
  mockRemoveLocalBatchWorkspace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/analysis/analysisService", () => ({
  startAnalysisBatch: mockStartAnalysisBatch,
  getAnalysisBatchDetail: mockGetAnalysisBatchDetail,
  getReductionBaselineMetrics: mockGetReductionBaselineMetrics,
  syncAnalysisBatch: mockSyncAnalysisBatch,
  syncActiveAnalysisBatches: mockSyncActiveAnalysisBatches,
}));

vi.mock("../../../models/db", async () => {
  const actual = await vi.importActual<typeof import("../../../models/db")>("../../../models/db");
  return {
    ...actual,
    listAnalysisBatches: mockListAnalysisBatches,
  };
});

vi.mock("../../../models/storage", async () => {
  const actual = await vi.importActual<typeof import("../../../models/storage")>("../../../models/storage");
  return {
    ...actual,
    removeLocalBatchWorkspace: mockRemoveLocalBatchWorkspace,
  };
});

import { buildMitreDefenseEvasionFromEvidence } from "../../../shared/analysis";
import { appRouter } from "../../routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userOverrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 7,
    openId: "analyst-user",
    email: "analyst@example.com",
    name: "Analyst User",
    passwordHash: null,
    loginMethod: "oauth",
    role: "user",
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...userOverrides,
  };

  const headerRecord: Record<string, string | undefined> = {};
  return {
    user,
    req: {
      protocol: "https",
      headers: headerRecord,
      get(name: string) {
        return headerRecord[name.toLowerCase() as keyof typeof headerRecord] ?? headerRecord[name];
      },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("analysis router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encaminha a submissão da análise com múltiplos logs e o usuário autenticado", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    mockStartAnalysisBatch.mockResolvedValue({ batch: { batchId: "ctr-demo-123", status: "queued" } });

    const result = await caller.analysis.submit({
      analysisName: "Sample Contradef",
      logFiles: [
        {
          fileName: "FunctionInterceptor.log",
          base64: Buffer.from("demo").toString("base64"),
          logType: "FunctionInterceptor",
        },
        {
          fileName: "TraceMemory.log",
          base64: Buffer.from("demo-2").toString("base64"),
          logType: "TraceMemory",
        },
      ],
      focusTerms: ["IsDebuggerPresent", "VirtualProtect"],
      focusRegexes: ["VirtualProtect.*RW.*RX"],
      origin: "https://example.com",
    });

    expect(mockStartAnalysisBatch).toHaveBeenCalledWith({
      analysisName: "Sample Contradef",
      logFiles: [
        {
          fileName: "FunctionInterceptor.log",
          base64: Buffer.from("demo").toString("base64"),
          logType: "FunctionInterceptor",
        },
        {
          fileName: "TraceMemory.log",
          base64: Buffer.from("demo-2").toString("base64"),
          logType: "TraceMemory",
        },
      ],
      focusTerms: ["IsDebuggerPresent", "VirtualProtect"],
      focusRegexes: ["VirtualProtect.*RW.*RX"],
      origin: "https://example.com",
      createdByUserId: 7,
      sampleSha256: null,
    });
    expect(result).toEqual({ batch: { batchId: "ctr-demo-123", status: "queued" } });
  });

  it("lista lotes com os filtros informados", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const createdFrom = new Date("2026-04-10T00:00:00.000Z");
    const createdTo = new Date("2026-04-14T23:59:59.999Z");

    mockListAnalysisBatches.mockResolvedValue([{ batchId: "ctr-demo-1" }, { batchId: "ctr-demo-2" }]);

    const result = await caller.analysis.list({
      sampleName: "Full-Execution-Sample-1",
      focusFunction: "Contradef",
      createdFrom,
      createdTo,
      status: ["completed"],
      limit: 25,
    });

    expect(mockListAnalysisBatches).toHaveBeenCalledWith({
      sampleName: "Full-Execution-Sample-1",
      focusFunction: "Contradef",
      createdFrom,
      createdTo,
      status: ["completed"],
      limit: 25,
      createdByUserId: 7,
    });
    expect(result).toEqual([{ batchId: "ctr-demo-1" }, { batchId: "ctr-demo-2" }]);
  });

  it("lista lotes sem filtrar por autor (admin vê o histórico global)", async () => {
    const ctx = createAuthContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    mockListAnalysisBatches.mockResolvedValue([]);

    await caller.analysis.list({ limit: 20 });

    const listArg = mockListAnalysisBatches.mock.calls[0][0];
    expect(listArg).toMatchObject({ limit: 20 });
    expect(listArg).not.toHaveProperty("createdByUserId");
  });

  it("retorna o detalhe agregado do lote", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("../../../models/db");
    const getBatchSpy = vi.spyOn(db, "getAnalysisBatchByBatchId").mockResolvedValue({
      batchId: "ctr-demo-123",
      createdByUserId: 7,
    } as Awaited<ReturnType<typeof db.getAnalysisBatchByBatchId>>);
    const detail = { batch: { batchId: "ctr-demo-123", status: "completed" },
      events: [],
      artifacts: [],
      insight: { title: "Resumo" },
      flowGraph: { nodes: [], edges: [] },
      metrics: {
        originalLineCount: 10,
        reducedLineCount: 4,
        originalBytes: 100,
        reducedBytes: 40,
        reductionPercent: 60,
        suspiciousEventCount: 2,
        triggerCount: 1,
        uploadedFileCount: 2,
      },
      fileMetrics: [
        {
          fileName: "TraceInstructions.log",
          logType: "TraceInstructions",
          originalLineCount: 8,
          reducedLineCount: 3,
          originalBytes: 80,
          reducedBytes: 30,
          suspiciousEventCount: 2,
          triggerCount: 1,
        },
      ],
      suspiciousApis: ["VirtualProtect"],
      techniques: ["Anti-debug"],
      mitreDefenseEvasion: buildMitreDefenseEvasionFromEvidence({ heuristicTags: ["Anti-debug"], suspiciousApis: ["VirtualProtect"] }),
      recommendations: ["Revisar o ponto de desempacotamento."],
      classification: "Trojan",
      riskLevel: "high",
      currentPhase: "Desempacotamento",
    };

    mockGetAnalysisBatchDetail.mockResolvedValue(detail);

    const result = await caller.analysis.detail({ batchId: "ctr-demo-123" });

    expect(getBatchSpy).toHaveBeenCalledWith("ctr-demo-123");
    expect(mockGetAnalysisBatchDetail).toHaveBeenCalledWith("ctr-demo-123", { includeServerProcess: false });
    expect(result).toEqual(detail);
    getBatchSpy.mockRestore();
  });

  it("recusa o detalhe de lote submetido por outro usuário", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("../../../models/db");
    const getBatchSpy = vi.spyOn(db, "getAnalysisBatchByBatchId").mockResolvedValue({
      batchId: "ctr-remote-batch",
      createdByUserId: 99,
    } as Awaited<ReturnType<typeof db.getAnalysisBatchByBatchId>>);

    await expect(caller.analysis.detail({ batchId: "ctr-remote-batch" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockGetAnalysisBatchDetail).not.toHaveBeenCalled();
    getBatchSpy.mockRestore();
  });

  it("retoma sync ativo: admin chama a listagem de lotes ativos sem filtro de autor", async () => {
    const ctx = createAuthContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    mockSyncActiveAnalysisBatches.mockResolvedValue(["ctr-active-a"]);

    const resumeResult = await caller.analysis.resumeActiveSync();

    expect(mockSyncActiveAnalysisBatches).toHaveBeenCalledWith(undefined);
    expect(resumeResult).toEqual({ resumedBatches: ["ctr-active-a"] });
  });

  it("retorna as métricas validadas do teste de redução em C++", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const reductionMetrics = {
      available: true,
      errorMessage: null,
      trigger_address: "0x10A0",
      files: [
        {
          file: "TraceInstructions_sample.csv",
          original_lines: 9,
          reduced_lines: 6,
          original_bytes: 696,
          reduced_bytes: 405,
        },
      ],
      combined: {
        original_lines: 9,
        reduced_lines: 6,
        original_bytes: 696,
        reduced_bytes: 405,
        reduction_percent: 41.81,
      },
      sampleSelectiveTest: {
        available: true,
        errorMessage: null,
        trigger_address: "0x10A0",
        files: [
          {
            file: "TraceInstructions_sample.csv",
            original_lines: 9,
            reduced_lines: 6,
            original_bytes: 696,
            reduced_bytes: 405,
          },
        ],
        combined: {
          original_lines: 9,
          reduced_lines: 6,
          original_bytes: 696,
          reduced_bytes: 405,
          reduction_percent: 41.81,
        },
      },
      realDatasetCompression: {
        available: true,
        errorMessage: null,
        dataset_directory: "/home/ubuntu/work_real_cdfs/extracted/Full-Execution-Sample-1",
        file_count: 6,
        total_original_size: 5096911203,
        total_compressed_size: 197261750,
        reduction_percent: 96.13,
        source_files_materialized: false,
        compressed_files_materialized: false,
        artifacts: [
          {
            file: "contradef.2956.TraceInstructions.cdf",
            original_size: 4214246529,
            compressed_size: 175592788,
            reduction_percent: 95.83,
            compression_level: 3,
            source_path: "/home/ubuntu/work_real_cdfs/extracted/Full-Execution-Sample-1/contradef.2956.TraceInstructions.cdf",
            compressed_path: "/home/ubuntu/work_real_cdfs/compressed_real_cdfs/contradef.2956.TraceInstructions.cdf.gz",
            source_available_in_workspace: false,
            compressed_available_in_workspace: false,
            source_sha256: "499136c7c1c747c54cef69bfc874f279db8d6ea703d8f3247fb58422c0263924",
            compressed_sha256: "062f336c0f357caed2e323091923b4b7ac8892d3d3fe71349bbb0ccb4fc435db",
          },
        ],
      },
    };

    mockGetReductionBaselineMetrics.mockResolvedValue(reductionMetrics);

    const result = await caller.analysis.reductionBaseline();

    expect(mockGetReductionBaselineMetrics).toHaveBeenCalledTimes(1);
    expect(result).toEqual(reductionMetrics);
  });

  it("sincroniza um lote específico e retoma a sincronização dos lotes ativos", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("../../../models/db");
    const getBatchSpy = vi.spyOn(db, "getAnalysisBatchByBatchId").mockResolvedValue({
      batchId: "ctr-demo-123",
      createdByUserId: 7,
    } as Awaited<ReturnType<typeof db.getAnalysisBatchByBatchId>>);

    mockSyncAnalysisBatch.mockResolvedValue({ batch: { batchId: "ctr-demo-123", status: "running" } });
    mockSyncActiveAnalysisBatches.mockResolvedValue(["ctr-demo-1", "ctr-demo-2"]);

    const syncResult = await caller.analysis.sync({ batchId: "ctr-demo-123" });
    const resumeResult = await caller.analysis.resumeActiveSync();

    expect(mockSyncAnalysisBatch).toHaveBeenCalledWith("ctr-demo-123");
    expect(syncResult).toEqual({ batch: { batchId: "ctr-demo-123", status: "running" } });
    expect(mockSyncActiveAnalysisBatches).toHaveBeenCalledWith({ createdByUserId: 7 });
    expect(resumeResult).toEqual({ resumedBatches: ["ctr-demo-1", "ctr-demo-2"] });
    getBatchSpy.mockRestore();
  });

  it("deleteBatch: apaga no servidor (dono) e chama remoção de workspace local", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("../../../models/db");
    const getSpy = vi.spyOn(db, "getAnalysisBatchByBatchId").mockResolvedValue({
      batchId: "ctr-test-delete",
      createdByUserId: 7,
    } as Awaited<ReturnType<typeof db.getAnalysisBatchByBatchId>>);
    const delSpy = vi.spyOn(db, "deleteAnalysisBatchAndRelatedData").mockResolvedValue(true);

    const result = await caller.analysis.deleteBatch({ batchId: "ctr-test-delete" });

    expect(result).toEqual({ ok: true });
    expect(getSpy).toHaveBeenCalledWith("ctr-test-delete");
    expect(delSpy).toHaveBeenCalledWith("ctr-test-delete");
    expect(mockRemoveLocalBatchWorkspace).toHaveBeenCalledWith("ctr-test-delete");

    getSpy.mockRestore();
    delSpy.mockRestore();
  });

  it("deleteBatch: recusa lote de outro usuário (não chama apagar na BD)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("../../../models/db");
    const getSpy = vi.spyOn(db, "getAnalysisBatchByBatchId").mockResolvedValue({
      batchId: "ctr-other",
      createdByUserId: 999,
    } as Awaited<ReturnType<typeof db.getAnalysisBatchByBatchId>>);
    const delSpy = vi.spyOn(db, "deleteAnalysisBatchAndRelatedData").mockResolvedValue(true);

    await expect(caller.analysis.deleteBatch({ batchId: "ctr-other" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    expect(delSpy).not.toHaveBeenCalled();
    getSpy.mockRestore();
    delSpy.mockRestore();
  });

  it("deleteBatch: recusa lote sem createdByUserId (legado)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("../../../models/db");
    const getSpy = vi.spyOn(db, "getAnalysisBatchByBatchId").mockResolvedValue({
      batchId: "ctr-legacy",
      createdByUserId: null,
    } as Awaited<ReturnType<typeof db.getAnalysisBatchByBatchId>>);
    const delSpy = vi.spyOn(db, "deleteAnalysisBatchAndRelatedData").mockResolvedValue(true);

    await expect(caller.analysis.deleteBatch({ batchId: "ctr-legacy" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(delSpy).not.toHaveBeenCalled();
    getSpy.mockRestore();
    delSpy.mockRestore();
  });
});
