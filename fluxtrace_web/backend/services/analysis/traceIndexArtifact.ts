import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

import type { TraceOrigin } from "./traceOrigin";

export const TRACE_ENGINE_VERSION = "trace-discovery-2";

export type TraceIndexHit = {
  fileName: string;
  logType: string;
  lineNumber: number;
  apis: string[];
  mapped: string[];
  origin?: TraceOrigin;
  originEvidence?: string;
  /** Quando o índice colapsa TI enorme: ocorrências desta API no ficheiro. Ausente = 1. */
  occurrences?: number;
  /** Endereços hex na mesma linha (RIP, retorno, call site) — cruzamento secundário entre módulos. */
  addresses?: string[];
};

export type SourceFileHash = {
  fileName: string;
  sha256: string;
  sizeBytes: number;
};

export function canonicalizeHits(hits: readonly TraceIndexHit[]): TraceIndexHit[] {
  return hits
    .map((hit) => ({
      fileName: hit.fileName,
      logType: hit.logType,
      lineNumber: hit.lineNumber,
      apis: [...hit.apis].sort(),
      mapped: [...hit.mapped].sort(),
      origin: hit.origin ?? "unknown",
      originEvidence: hit.originEvidence ?? "",
      ...(hit.occurrences != null && hit.occurrences !== 1 ? { occurrences: hit.occurrences } : {}),
      ...(hit.addresses?.length ? { addresses: [...hit.addresses].sort() } : {}),
    }))
    .sort((a, b) => {
      const byFile = a.fileName.localeCompare(b.fileName);
      if (byFile !== 0) return byFile;
      if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
      return a.apis.join("|").localeCompare(b.apis.join("|"));
    });
}

export function hashCanonicalIndex(hits: readonly TraceIndexHit[]): string {
  const body = JSON.stringify(canonicalizeHits(hits));
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export type FirstSeenApiRow = {
  api: string;
  fileName: string;
  logType: string;
  lineNumber: number;
  occurrences: number;
  origin: TraceOrigin;
  mapped: string[];
};

export function firstSeenApis(
  hits: readonly TraceIndexHit[],
  opts: { origin?: TraceOrigin } = {},
): FirstSeenApiRow[] {
  const first = new Map<string, Omit<FirstSeenApiRow, "api">>();
  for (const hit of hits) {
    if (opts.origin && (hit.origin ?? "unknown") !== opts.origin) continue;
    const add = hit.occurrences != null && hit.occurrences > 0 ? hit.occurrences : 1;
    const mapped = Array.isArray(hit.mapped) ? hit.mapped : [];
    for (const api of hit.apis) {
      const prev = first.get(api);
      if (!prev) {
        first.set(api, {
          fileName: hit.fileName,
          logType: hit.logType,
          lineNumber: hit.lineNumber,
          occurrences: add,
          origin: hit.origin ?? "unknown",
          mapped: [...mapped],
        });
      } else {
        prev.occurrences += add;
        if (mapped.length) {
          const seen = new Set(prev.mapped);
          for (const name of mapped) {
            if (!seen.has(name)) {
              seen.add(name);
              prev.mapped.push(name);
            }
          }
        }
      }
    }
  }
  return Array.from(first.entries()).map(([api, meta]) => ({ api, ...meta }));
}

export function buildObservedOriginGraph(observed: readonly FirstSeenApiRow[]) {
  return {
    nodes: observed.map((item, index) => ({
      id: `obs:${index}:${item.api}`,
      label: item.api,
      kind: "api",
      severity: item.origin === "target" ? "high" as const : item.origin === "unknown" ? "medium" as const : "info" as const,
      metadata: {
        sourceFile: item.fileName,
        sourceLogType: item.logType,
        sourceLineNumber: item.lineNumber,
        occurrences: item.occurrences,
        origin: item.origin,
        mapped: item.mapped,
      },
    })),
    edges: observed.slice(1).map((item, index) => ({
      source: `obs:${index}:${observed[index]!.api}`,
      target: `obs:${index + 1}:${item.api}`,
      relation: "primeira ocorrência",
    })),
  };
}

export function compactTraceOriginFromIndexDocument(doc: {
  engine?: string;
  indexSha256?: string;
  originCounts?: { "pin-runtime"?: number; target?: number; unknown?: number };
  observedApis?: Array<Partial<FirstSeenApiRow> & { api: string }>;
  observedTargetApis?: Array<Partial<FirstSeenApiRow> & { api: string }>;
  hits?: TraceIndexHit[];
}) {
  const hits = Array.isArray(doc.hits) ? doc.hits : [];
  const observed = (doc.observedApis?.length ? doc.observedApis : firstSeenApis(hits)).map(normalizeObservedRow);
  const observedTarget = (
    doc.observedTargetApis?.length ? doc.observedTargetApis : firstSeenApis(hits, { origin: "target" })
  ).map(normalizeObservedRow);
  const originCounts = {
    "pin-runtime": Number(doc.originCounts?.["pin-runtime"] ?? 0) || 0,
    target: Number(doc.originCounts?.target ?? 0) || 0,
    unknown: Number(doc.originCounts?.unknown ?? 0) || 0,
  };
  return {
    engine: doc.engine?.trim() || TRACE_ENGINE_VERSION,
    indexSha256: typeof doc.indexSha256 === "string" ? doc.indexSha256 : "",
    originCounts,
    observedApis: observed,
    observedTargetApis: observedTarget,
    observedGraph: buildObservedOriginGraph(observed),
  };
}

function normalizeObservedRow(row: Partial<FirstSeenApiRow> & { api: string }): FirstSeenApiRow {
  const origin = row.origin === "pin-runtime" || row.origin === "target" || row.origin === "unknown"
    ? row.origin
    : "unknown";
  return {
    api: row.api,
    fileName: typeof row.fileName === "string" ? row.fileName : "",
    logType: typeof row.logType === "string" ? row.logType : "",
    lineNumber: Number.isFinite(row.lineNumber) ? Number(row.lineNumber) : 0,
    occurrences: Number.isFinite(row.occurrences) ? Number(row.occurrences) : 1,
    origin,
    mapped: Array.isArray(row.mapped) ? row.mapped.filter((name): name is string => typeof name === "string") : [],
  };
}

export async function sha256OfPath(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

export function sha256OfBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function buildTraceIndexDocument(params: {
  sourceFiles: SourceFileHash[];
  hits: TraceIndexHit[];
  eventCapInGraph: number;
}) {
  const hits = canonicalizeHits(params.hits);
  const observed = firstSeenApis(params.hits);
  const observedTarget = firstSeenApis(params.hits, { origin: "target" });
  const originCounts = { "pin-runtime": 0, target: 0, unknown: 0 };
  for (const hit of hits) {
    originCounts[hit.origin ?? "unknown"] += 1;
  }
  return {
    engine: TRACE_ENGINE_VERSION,
    eventCapInGraph: params.eventCapInGraph,
    sourceFiles: params.sourceFiles.slice().sort((a, b) => a.fileName.localeCompare(b.fileName)),
    observedApiCount: observed.length,
    observedTargetApiCount: observedTarget.length,
    originCounts,
    hitCount: hits.length,
    indexSha256: hashCanonicalIndex(hits),
    observedApis: observed,
    observedTargetApis: observedTarget,
    hits,
  };
}
