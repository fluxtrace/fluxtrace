// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n/config";

type MockBatch = Record<string, any>;

function dashboardStatsFromBatches(batches: MockBatch[]) {
  const byStatus: Record<string, number> = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const b of batches) {
    const s = String(b.status);
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  return {
    totalBatches: batches.length,
    byStatus,
    createdLast7Days: [] as { date: string; count: number }[],
    completedWallTimes: [] as Array<{
      batchId: string;
      sampleName: string;
      wallMs: number;
      endedAtIso: string;
      wallMsSource: "measured";
      totalOriginalBytes: number;
    }>,
  };
}

const mockState = vi.hoisted(() => ({
  batches: [] as MockBatch[],
  details: {} as Record<string, any>,
  dashboardStats: dashboardStatsFromBatches([]),
  submitMutateAsync: vi.fn(async () => ({ batchId: "ctr-mock-a" })),
  syncMutateAsync: vi.fn(async ({ batchId }: { batchId: string }) => ({ batch: { batchId } })),
  resumeMutate: vi.fn(),
  resumeMutateAsync: vi.fn(async () => ({ resumedBatches: 1 })),
  invalidateList: vi.fn(async () => undefined),
  invalidateDetail: vi.fn(async () => undefined),
}));

function renderHome(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
  });
}

vi.mock("@/components/layout/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
  useDashboardShell: () => ({ sidebarCollapsed: false }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: () => <span>Status</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/api/trpc", () => ({
  trpc: {
    useUtils: () => ({
      analysis: {
        list: { invalidate: mockState.invalidateList },
        detail: { invalidate: mockState.invalidateDetail },
      },
      auth: {
        me: {
          setData: vi.fn(),
          invalidate: vi.fn(async () => undefined),
        },
      },
    }),
    auth: {
      me: {
        useQuery: () => ({
          data: {
            id: 1,
            openId: "test-user",
            email: "analyst@example.com",
            name: "Analyst",
            role: "user",
            loginMethod: "local",
            canChangePassword: false,
            mustChangePassword: false,
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(async () => ({})),
        }),
      },
      logout: {
        useMutation: () => ({
          mutateAsync: vi.fn(async () => undefined),
          isPending: false,
          error: null,
        }),
      },
    },
    analysis: {
      dashboardStats: {
        useQuery: () => ({
          data: mockState.dashboardStats,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }),
      },
      list: {
        useQuery: (input?: { sampleName?: string; status?: string[] | undefined; limit?: number }) => {
          const q = input?.sampleName?.trim().toLowerCase() ?? "";
          let rows = mockState.batches;
          if (q) {
            rows = rows.filter((b) => String(b.sampleName).toLowerCase().includes(q));
          }
          const st = input?.status;
          if (st?.length) {
            rows = rows.filter((b) => st.includes(b.status));
          }
          return {
            data: rows,
            refetch: vi.fn(),
          };
        },
      },
      detail: {
        useQuery: ({ batchId }: { batchId: string }) => ({
          data: mockState.details[batchId] ?? undefined,
        }),
      },
      resumeActiveSync: {
        useMutation: () => ({
          mutate: mockState.resumeMutate,
          mutateAsync: mockState.resumeMutateAsync,
          isPending: false,
        }),
      },
      sync: {
        useMutation: () => ({
          mutateAsync: mockState.syncMutateAsync,
          isPending: false,
        }),
      },
      submit: {
        useMutation: () => ({
          mutateAsync: mockState.submitMutateAsync,
          isPending: false,
        }),
      },
    },
  },
}));

import Home from "./Home";

describe("Home dashboard", () => {
  beforeAll(async () => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    await i18n.changeLanguage("pt-BR");
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockState.batches = [
      {
        batchId: "ctr-mock-a",
        sampleName: "Full-Execution-Sample-1",
        focusFunction: "IsDebuggerPresent",
        status: "completed",
        stage: "done",
        progress: 100,
        message: "Pipeline finalizado com sucesso.",
        createdAt: new Date("2026-04-14T18:30:00.000Z"),
        updatedAt: new Date("2026-04-14T18:45:00.000Z"),
        llmSummaryStatus: "completed",
        commitStatus: "completed",
        stdoutTail: "stdout",
        stderrTail: "",
      },
      {
        batchId: "ctr-mock-b",
        sampleName: "Live-Sample-2",
        focusFunction: "CreateRemoteThread",
        status: "running",
        stage: "correlating",
        progress: 62,
        message: "Correlacionando chamadas relevantes.",
        createdAt: new Date("2026-04-14T19:00:00.000Z"),
        updatedAt: new Date("2026-04-14T19:05:00.000Z"),
        llmSummaryStatus: "pending",
        commitStatus: "pending",
        stdoutTail: "stdout running",
        stderrTail: "stderr running",
      },
    ];

    mockState.details = {
      "ctr-mock-a": {
        batch: mockState.batches[0],
        events: [],
        artifacts: [
          {
            id: 10,
            batchId: "ctr-mock-a",
            artifactType: "json",
            label: "correlation.json",
            relativePath: "outputs/correlation.json",
            sourcePath: "/tmp/correlation.json",
            storageUrl: "https://example.com/correlation.json",
            storageKey: "outputs/correlation.json",
            mimeType: "application/json",
            sizeBytes: 2048,
            createdAt: new Date("2026-04-14T18:45:00.000Z"),
          },
          {
            id: 11,
            batchId: "ctr-mock-a",
            artifactType: "markdown",
            label: "summary.md",
            relativePath: "outputs/summary.md",
            sourcePath: "/tmp/summary.md",
            storageUrl: "https://example.com/summary.md",
            storageKey: "outputs/summary.md",
            mimeType: "text/markdown",
            sizeBytes: 512,
            createdAt: new Date("2026-04-14T18:45:00.000Z"),
          },
          {
            id: 12,
            batchId: "ctr-mock-a",
            artifactType: "docx",
            label: "report.docx",
            relativePath: "outputs/report.docx",
            sourcePath: "/tmp/report.docx",
            storageUrl: "https://example.com/report.docx",
            storageKey: "outputs/report.docx",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            sizeBytes: 4096,
            createdAt: new Date("2026-04-14T18:45:00.000Z"),
          },
        ],
        insight: {
          summaryMarkdown: "## Sumário\nA amostra destaca mecanismos de detecção de análise.",
        },
        commit: {
          repository: "fluxtrace/fluxtrace",
          branch: "main",
          commitHash: "abc123def456",
          status: "completed",
        },
        graph: {
          nodes: [
            { id: "IsDebuggerPresent", label: "IsDebuggerPresent", kind: "function" },
            { id: "VirtualProtect", label: "VirtualProtect", kind: "function" },
          ],
          edges: [
            {
              source: "IsDebuggerPresent",
              target: "VirtualProtect",
              relation: "correlates_with",
              weight: 0.94,
              evidence: "Relacionamento observado no fluxo consolidado.",
            },
          ],
        },
      },
      "ctr-mock-b": {
        batch: mockState.batches[1],
        events: [],
        artifacts: [],
        insight: null,
        commit: null,
        graph: {
          nodes: [],
          edges: [],
        },
      },
    };

    mockState.dashboardStats = dashboardStatsFromBatches(mockState.batches);
  });

  it("mostra o título do dashboard, totais e lotes na lista de incidentes", () => {
    renderHome(<Home />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    const totalCard = screen.getByText("Total de lotes").closest(".rounded-2xl");
    expect(totalCard).toBeTruthy();
    expect(within(totalCard as HTMLElement).getByText("2")).toBeTruthy();
    expect(screen.getAllByText("Full-Execution-Sample-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Live-Sample-2").length).toBeGreaterThan(0);
  });

  it("filtra a lista de incidentes pelo nome da amostra", async () => {
    renderHome(<Home />);

    const [incidentsHeading] = screen.getAllByText("Incidentes recentes — fila e histórico");
    const incidentsCard = incidentsHeading.closest('[data-slot="card"]');
    expect(incidentsCard).toBeTruthy();
    const region = within(incidentsCard as HTMLElement);
    const filter = region.getByPlaceholderText(/filtrar por nome da amostra/i);
    fireEvent.change(filter, { target: { value: "Live-Sample-2" } });

    await waitFor(() => {
      expect(region.queryByText("Full-Execution-Sample-1")).toBeNull();
      expect(region.getAllByText("Live-Sample-2").length).toBeGreaterThan(0);
    });
  });

  it("oferece link de interpretação consolidada por lote", () => {
    renderHome(<Home />);

    const links = screen.getAllByRole("link", { name: /interpretação/i });
    expect(links.some((a) => a.getAttribute("href") === "/interpretacao-consolidada?batch=ctr-mock-a")).toBe(true);
    expect(links.some((a) => a.getAttribute("href") === "/interpretacao-consolidada?batch=ctr-mock-b")).toBe(true);
  });
});
