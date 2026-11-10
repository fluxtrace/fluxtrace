import type { FlowEdge, FlowGraph, FlowNode, ObservedApiOriginRow, PivotFlow } from "./schemas";

export const CONTRADEF_PHASES = [
  "FunctionInterceptor",
  "TraceFcnCall.M1",
  "TraceFcnCall.M2",
  "TraceInstructions",
  "TraceMemory",
  "TraceDisassembly",
] as const;

export type ContradefPhase = (typeof CONTRADEF_PHASES)[number];

export const PHASE_SHORT_LABEL: Record<ContradefPhase, string> = {
  FunctionInterceptor: "Interceptor",
  "TraceFcnCall.M1": "M1",
  "TraceFcnCall.M2": "M2",
  TraceInstructions: "Instructions",
  TraceMemory: "Memory",
  TraceDisassembly: "Disassembly",
};

export function classifyContradefPhase(fileName: string, logType = ""): ContradefPhase | null {
  const f = fileName.toLowerCase();
  const t = logType.toLowerCase();
  if (f.includes(".m1.") || f.includes("tracefcncall.m1") || f.includes("m1.cdf") || /(?:^|[._-])m1(?:[._-]|$)/.test(f)) {
    return "TraceFcnCall.M1";
  }
  if (f.includes(".m2.") || f.includes("tracefcncall.m2") || f.includes("m2.cdf") || /(?:^|[._-])m2(?:[._-]|$)/.test(f)) {
    return "TraceFcnCall.M2";
  }
  if (t === "functioninterceptor" || f.includes("functioninterceptor") || f.includes("function_interceptor")) {
    return "FunctionInterceptor";
  }
  if (t === "traceinstructions" || f.includes("traceinstructions") || f.includes("trace_instructions")) {
    return "TraceInstructions";
  }
  if (t === "tracememory" || f.includes("tracememory") || f.includes("trace_memory")) {
    return "TraceMemory";
  }
  if (t === "tracedisassembly" || f.includes("tracedisassembly") || f.includes("trace_disassembly")) {
    return "TraceDisassembly";
  }
  if (t === "tracefcncall" || f.includes("tracefcncall")) {
    return "TraceFcnCall.M1";
  }
  return null;
}

export type PhaseApi = {
  api: string;
  occurrences: number;
  origin: string;
  fileName: string;
  logType: string;
  lineNumber: number;
};

export type PhaseTraceColumn = {
  module: ContradefPhase;
  short: string;
  apis: PhaseApi[];
};

export type PhaseTraceBoard = {
  columns: PhaseTraceColumn[];
  uniqueApiCount: number;
};

function emptyBuckets(): Record<ContradefPhase, Map<string, PhaseApi>> {
  return {
    FunctionInterceptor: new Map(),
    "TraceFcnCall.M1": new Map(),
    "TraceFcnCall.M2": new Map(),
    TraceInstructions: new Map(),
    TraceMemory: new Map(),
    TraceDisassembly: new Map(),
  };
}

function addToBucket(
  buckets: Record<ContradefPhase, Map<string, PhaseApi>>,
  phase: ContradefPhase,
  row: PhaseApi,
) {
  const prev = buckets[phase].get(row.api);
  if (!prev) {
    buckets[phase].set(row.api, { ...row });
    return;
  }
  prev.occurrences += row.occurrences;
}

function fillBuckets(params: {
  observedApis?: readonly ObservedApiOriginRow[];
  pivotFlows?: readonly PivotFlow[];
  /** Percurso de comportamento: só `target`. Painel de origem passa `false`. */
  behaviorOnly?: boolean;
}): Record<ContradefPhase, Map<string, PhaseApi>> {
  const buckets = emptyBuckets();
  const covered = new Set<string>();
  const behaviorOnly = params.behaviorOnly !== false;
  const pivotHits = (params.pivotFlows ?? []).filter((flow) =>
    flow.modules.some((row) => row.occurrences > 0),
  );

  for (const flow of pivotHits) {
    if (behaviorOnly && flow.origin.target <= 0) continue;
    covered.add(flow.api);
    const origin =
      flow.origin.target > 0 ? "target" : flow.origin["pin-runtime"] > 0 ? "pin-runtime" : "unknown";
    for (const row of flow.modules) {
      if (row.occurrences <= 0) continue;
      addToBucket(buckets, row.module, {
        api: flow.api,
        occurrences: row.occurrences,
        origin,
        fileName: row.fileName,
        logType: row.module,
        lineNumber: row.firstLine,
      });
    }
  }

  for (const row of params.observedApis ?? []) {
    if (covered.has(row.api)) continue;
    if (behaviorOnly && row.origin !== "target") continue;
    const phase = classifyContradefPhase(row.fileName, row.logType);
    if (!phase) continue;
    addToBucket(buckets, phase, {
      api: row.api,
      occurrences: row.occurrences > 0 ? row.occurrences : 1,
      origin: row.origin ?? "unknown",
      fileName: row.fileName,
      logType: row.logType,
      lineNumber: row.lineNumber,
    });
  }
  return buckets;
}

/** Quadro legível: seis ficheiros, APIs concatenadas por fase. */
export function buildPhaseTraceBoard(params: {
  observedApis?: readonly ObservedApiOriginRow[];
  pivotFlows?: readonly PivotFlow[];
  behaviorOnly?: boolean;
}): PhaseTraceBoard {
  const buckets = fillBuckets(params);
  const names = new Set<string>();
  const columns = CONTRADEF_PHASES.map((phase) => {
    const apis = [...buckets[phase].values()].sort(
      (a, b) => a.lineNumber - b.lineNumber || a.api.localeCompare(b.api),
    );
    for (const row of apis) names.add(row.api);
    return { module: phase, short: PHASE_SHORT_LABEL[phase], apis };
  });
  return { columns, uniqueApiCount: names.size };
}

/**
 * Grafo do rastro por fase dos seis .cdf.
 * APIs repetidas no mesmo módulo viram um nó (`×N`); a mesma API pode aparecer em várias colunas
 * se o índice tiver ocorrências em mais do que um artefacto.
 */
export function buildPhaseTraceGraph(params: {
  observedApis?: readonly ObservedApiOriginRow[];
  pivotFlows?: readonly PivotFlow[];
  behaviorOnly?: boolean;
}): FlowGraph {
  const board = buildPhaseTraceBoard(params);

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let apiNodes = 0;

  board.columns.forEach((column, columnIndex) => {
    const items = column.apis;
    const phase = column.module;
    const phaseId = `phase:${phase}`;
    nodes.push({
      id: phaseId,
      label: items.length ? `${column.short}\n${items.length} API` : `${column.short}\nausente`,
      kind: "phase",
      severity: items.length ? "medium" : "info",
      metadata: {
        columnIndex,
        rowIndex: 0,
        module: phase,
        apiCount: items.length,
      },
    });
    items.forEach((item, index) => {
      const id = `api:${phase}:${item.api}`;
      apiNodes += 1;
      nodes.push({
        id,
        label: item.occurrences > 1 ? `${item.api} ×${item.occurrences}` : item.api,
        kind: "api",
        severity: item.origin === "target" ? "high" : item.origin === "unknown" ? "medium" : "info",
        metadata: {
          columnIndex,
          rowIndex: index + 1,
          origin: item.origin,
          sourceFile: item.fileName,
          sourceLogType: item.logType,
          sourceLineNumber: item.lineNumber,
          occurrences: item.occurrences,
          module: phase,
        },
      });
    });
  });

  for (let i = 0; i < CONTRADEF_PHASES.length - 1; i++) {
    edges.push({
      source: `phase:${CONTRADEF_PHASES[i]}`,
      target: `phase:${CONTRADEF_PHASES[i + 1]}`,
      relation: "fase",
    });
  }

  return {
    nodes,
    edges,
    summary: {
      phaseTraceGraph: true,
      phaseApiNodeCount: apiNodes,
      phaseObservedCount: (params.observedApis ?? []).length,
    },
  };
}
