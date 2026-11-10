import { describe, expect, it } from "vitest";

import { firstSeenApis, hashCanonicalIndex, TRACE_ENGINE_VERSION } from "./traceIndexArtifact";

describe("traceIndexArtifact", () => {
  it("B5: a mesma evidência em ordem diferente produz o mesmo hash", () => {
    const a = [
      { fileName: "b.cdf", logType: "TraceFcnCall", lineNumber: 2, apis: ["LoadLibraryA"], mapped: ["LoadLibraryA"] },
      { fileName: "a.cdf", logType: "FunctionInterceptor", lineNumber: 10, apis: ["GetACP", "GetProcAddress"], mapped: [] },
    ];
    const b = [
      { fileName: "a.cdf", logType: "FunctionInterceptor", lineNumber: 10, apis: ["GetProcAddress", "GetACP"], mapped: [] },
      { fileName: "b.cdf", logType: "TraceFcnCall", lineNumber: 2, apis: ["LoadLibraryA"], mapped: ["LoadLibraryA"] },
    ];
    expect(hashCanonicalIndex(a)).toBe(hashCanonicalIndex(b));
    expect(hashCanonicalIndex(a)).toHaveLength(64);
  });

  it("B3: primeira ocorrência por API, com contagem", () => {
    const hits = [
      { fileName: "i.cdf", logType: "FunctionInterceptor", lineNumber: 4, apis: ["GetProcAddress"], mapped: [] },
      { fileName: "m1.cdf", logType: "TraceFcnCall", lineNumber: 9, apis: ["GetProcAddress"], mapped: [] },
      { fileName: "i.cdf", logType: "FunctionInterceptor", lineNumber: 20, apis: ["RegEnumKeyExW"], mapped: [] },
    ];
    expect(firstSeenApis(hits)).toEqual([
      { api: "GetProcAddress", fileName: "i.cdf", logType: "FunctionInterceptor", lineNumber: 4, occurrences: 2, origin: "unknown", mapped: [] },
      { api: "RegEnumKeyExW", fileName: "i.cdf", logType: "FunctionInterceptor", lineNumber: 20, occurrences: 1, origin: "unknown", mapped: [] },
    ]);
  });

  it("acumula anotação M1 (mapped) no first-seen", () => {
    const hits = [
      {
        fileName: "m1.cdf",
        logType: "TraceFcnCall",
        lineNumber: 2,
        apis: ["GetProcAddress"],
        mapped: ["GetProcAddress"],
        origin: "target" as const,
      },
      {
        fileName: "m1.cdf",
        logType: "TraceFcnCall",
        lineNumber: 8,
        apis: ["GetProcAddress"],
        mapped: ["GetProcAddress"],
        origin: "target" as const,
      },
    ];
    expect(firstSeenApis(hits)[0]).toMatchObject({
      api: "GetProcAddress",
      occurrences: 2,
      origin: "target",
      mapped: ["GetProcAddress"],
    });
  });

  it("expõe versão do motor para o artigo", () => {
    expect(TRACE_ENGINE_VERSION).toBe("trace-discovery-4");
  });

  it("contagem colapsada (TI) soma occurrences no first-seen", () => {
    const hits = [
      {
        fileName: "ti.cdf",
        logType: "TraceInstructions",
        lineNumber: 3,
        apis: ["RtlAllocateHeap"],
        mapped: [],
        origin: "unknown" as const,
        occurrences: 40,
      },
    ];
    expect(firstSeenApis(hits)).toEqual([
      {
        api: "RtlAllocateHeap",
        fileName: "ti.cdf",
        logType: "TraceInstructions",
        lineNumber: 3,
        occurrences: 40,
        origin: "unknown",
        mapped: [],
      },
    ]);
  });
});
