import { describe, expect, it } from "vitest";

import { JOURNEY_PAGE_SIZE, pageFlowGraph } from "./journeyView";

describe("pageFlowGraph", () => {
  it("mantém fases e pagina só nós de API", () => {
    const graph = {
      nodes: [
        { id: "phase:init", label: "Inicialização", kind: "phase", severity: "info" as const },
        ...Array.from({ length: 400 }, (_, i) => ({
          id: `api:${i}`,
          label: `Api${i}`,
          kind: "api",
          severity: "info" as const,
        })),
        { id: "verdict:discovery", label: "Descoberta", kind: "verdict", severity: "medium" as const },
      ],
      edges: [
        { source: "phase:init", target: "api:0", relation: "evidência" },
        { source: "api:0", target: "api:1", relation: "seguida" },
        { source: "api:319", target: "api:320", relation: "seguida" },
      ],
    };
    const first = pageFlowGraph(graph, 0);
    expect(first.pageCount).toBe(2);
    expect(first.totalPagedNodes).toBe(400);
    expect(first.graph.nodes.some((n) => n.id === "phase:init")).toBe(true);
    expect(first.graph.nodes.some((n) => n.id === "api:0")).toBe(true);
    expect(first.graph.nodes.some((n) => n.id === "api:320")).toBe(false);
    const second = pageFlowGraph(graph, 1);
    expect(second.graph.nodes.some((n) => n.id === "api:320")).toBe(true);
    expect(second.graph.nodes.some((n) => n.id === "api:0")).toBe(false);
  });

  it("página única quando há menos nós que o teto da vista", () => {
    const graph = {
      nodes: [{ id: "obs:0:GetACP", label: "GetACP", kind: "api", severity: "high" as const }],
      edges: [],
    };
    const page = pageFlowGraph(graph, 0, JOURNEY_PAGE_SIZE);
    expect(page.pageCount).toBe(1);
    expect(page.graph.nodes).toHaveLength(1);
  });
});
