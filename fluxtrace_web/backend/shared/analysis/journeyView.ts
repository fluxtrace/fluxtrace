import type { FlowGraph } from "./schemas";

/** Tamanho de uma página do grafo (vista). O índice / APIs únicas não são cortados. */
export const JOURNEY_PAGE_SIZE = 320;

/** `sourceArchiveName` dos lotes importados da campanha oficial A5 (disco → UI). */
export const OFFICIAL_CAMPAIGN_ARCHIVE = "cotb-oficial-a5";

export function pageFlowGraph(
  graph: FlowGraph,
  pageIndex: number,
  pageSize = JOURNEY_PAGE_SIZE,
): {
  graph: FlowGraph;
  page: number;
  pageCount: number;
  totalPagedNodes: number;
} {
  const sticky = graph.nodes.filter((node) => node.kind === "phase" || node.kind === "verdict");
  const paged = graph.nodes.filter((node) => node.kind !== "phase" && node.kind !== "verdict");
  const totalPagedNodes = paged.length;
  const pageCount = Math.max(1, Math.ceil(Math.max(totalPagedNodes, 1) / Math.max(1, pageSize)));
  const page = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const slice = paged.slice(page * pageSize, (page + 1) * pageSize);
  const nodes = [...sticky, ...slice];
  const ids = new Set(nodes.map((node) => node.id));
  return {
    graph: {
      ...graph,
      nodes,
      edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    },
    page,
    pageCount,
    totalPagedNodes,
  };
}
