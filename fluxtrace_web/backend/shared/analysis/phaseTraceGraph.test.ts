import { describe, expect, it } from "vitest";

import { buildPhaseTraceBoard, buildPhaseTraceGraph, classifyContradefPhase } from "./phaseTraceGraph";

describe("classifyContradefPhase", () => {
  it("separa M1 de M2 e TI", () => {
    expect(classifyContradefPhase("a.TraceFcnCall.M1.cdf", "TraceFcnCall")).toBe("TraceFcnCall.M1");
    expect(classifyContradefPhase("a.TraceFcnCall.M2.cdf", "TraceFcnCall")).toBe("TraceFcnCall.M2");
    expect(classifyContradefPhase("x.TraceInstructions.cdf", "TraceInstructions")).toBe("TraceInstructions");
  });
});

describe("buildPhaseTraceBoard", () => {
  it("agrupa por fase e concatena ocorrências", () => {
    const board = buildPhaseTraceBoard({
      observedApis: [
        {
          api: "GetProcAddress",
          fileName: "s.FunctionInterceptor.cdf",
          logType: "FunctionInterceptor",
          lineNumber: 2,
          occurrences: 4,
          origin: "target",
          mapped: [],
        },
      ],
    });
    expect(board.uniqueApiCount).toBe(1);
    expect(board.columns.find((c) => c.module === "FunctionInterceptor")?.apis[0]?.occurrences).toBe(4);
    expect(board.columns.find((c) => c.module === "TraceMemory")?.apis).toEqual([]);
  });
});

describe("buildPhaseTraceGraph", () => {
  it("concatena a mesma API na mesma fase e não desenha uma linha única de unique-APIs", () => {
    const graph = buildPhaseTraceGraph({
      observedApis: [
        {
          api: "GetProcAddress",
          fileName: "s.FunctionInterceptor.cdf",
          logType: "FunctionInterceptor",
          lineNumber: 2,
          occurrences: 4,
          origin: "target",
          mapped: [],
        },
        {
          api: "RtlGetCurrentServiceSessionId",
          fileName: "s.TraceInstructions.cdf",
          logType: "TraceInstructions",
          lineNumber: 9,
          occurrences: 2,
          origin: "unknown",
          mapped: [],
        },
      ],
    });
    const gpa = graph.nodes.find((n) => n.id === "api:FunctionInterceptor:GetProcAddress");
    const rtl = graph.nodes.find((n) => n.id === "api:TraceInstructions:RtlGetCurrentServiceSessionId");
    expect(gpa?.label).toBe("GetProcAddress ×4");
    expect(rtl).toBeUndefined();
    expect(graph.edges.every((e) => e.relation === "fase")).toBe(true);
    expect(graph.nodes.filter((n) => n.kind === "phase")).toHaveLength(6);
  });

  it("repete a API em várias colunas quando o pivô tem hits em vários módulos", () => {
    const graph = buildPhaseTraceGraph({
      pivotFlows: [
        {
          api: "IsDebuggerPresent",
          joinBy: "name",
          mapped: true,
          mermaid: "",
          sharedAddresses: [],
          chainLevel: "call-origin",
          likeIsDebuggerPresent: false,
          validationSteps: [],
          origin: { "pin-runtime": 0, target: 3, unknown: 0 },
          modules: [
            { module: "FunctionInterceptor", fileName: "fi.cdf", occurrences: 1, firstLine: 1, addresses: [] },
            { module: "TraceFcnCall.M1", fileName: "m1.cdf", occurrences: 2, firstLine: 4, addresses: [] },
            { module: "TraceFcnCall.M2", fileName: "", occurrences: 0, firstLine: 0, addresses: [] },
            { module: "TraceInstructions", fileName: "", occurrences: 0, firstLine: 0, addresses: [] },
            { module: "TraceMemory", fileName: "", occurrences: 0, firstLine: 0, addresses: [] },
            { module: "TraceDisassembly", fileName: "", occurrences: 0, firstLine: 0, addresses: [] },
          ],
        },
      ],
    });
    expect(graph.nodes.some((n) => n.id === "api:FunctionInterceptor:IsDebuggerPresent")).toBe(true);
    expect(graph.nodes.some((n) => n.id === "api:TraceFcnCall.M1:IsDebuggerPresent")).toBe(true);
    expect(graph.nodes.some((n) => n.id.startsWith("api:TraceInstructions:"))).toBe(false);
  });
});
