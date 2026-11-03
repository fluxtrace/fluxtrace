import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { resetMappedCatalogCache } from "./traceApiDiscovery";
import {
  buildPivotFlow,
  catalogSourceApis,
  classifyContradefModule,
  CONTRADEF_MODULES,
  isAutoAddableApiName,
  pickDefaultPivot,
  presentApisMermaid,
  rankPivotFlow,
  syncMappedCatalogFromApis,
} from "./mappedCatalogSync";
import type { TraceIndexHit } from "./traceIndexArtifact";

const hits: TraceIndexHit[] = [
  {
    fileName: "sample.FunctionInterceptor.cdf",
    logType: "FunctionInterceptor",
    lineNumber: 10,
    apis: ["IsDebuggerPresent"],
    mapped: ["IsDebuggerPresent"],
    addresses: ["0x7ffb1000"],
  },
  {
    fileName: "sample.TraceFcnCall.M1.cdf",
    logType: "TraceFcnCall",
    lineNumber: 4,
    apis: ["IsDebuggerPresent"],
    mapped: ["IsDebuggerPresent"],
    addresses: ["0x7ffb1000"],
  },
  {
    fileName: "sample.TraceFcnCall.M2.cdf",
    logType: "TraceFcnCall",
    lineNumber: 8,
    apis: ["GetProcAddress"],
    mapped: [],
  },
  {
    fileName: "sample.TraceInstructions.cdf",
    logType: "TraceInstructions",
    lineNumber: 90,
    apis: ["RtlAllocateHeap"],
    mapped: [],
    occurrences: 4000,
  },
];

describe("classifyContradefModule", () => {
  it("separa M1 de M2 pelo nome do ficheiro", () => {
    expect(classifyContradefModule("a.TraceFcnCall.M1.cdf", "TraceFcnCall")).toBe("TraceFcnCall.M1");
    expect(classifyContradefModule("a.TraceFcnCall.M2.cdf", "TraceFcnCall")).toBe("TraceFcnCall.M2");
    expect(classifyContradefModule("FunctionInterceptor.cdf", "FunctionInterceptor")).toBe("FunctionInterceptor");
  });
});

describe("catalogSourceApis", () => {
  it("promove qualquer módulo dos seis .cdf — o nome no rastro manda, incluindo TI", () => {
    expect(catalogSourceApis(hits)).toEqual(["GetProcAddress", "IsDebuggerPresent", "RtlAllocateHeap"]);
    expect(isAutoAddableApiName("RtlAllocateHeap")).toBe(true);
    expect(isAutoAddableApiName("malloc")).toBe(false);
    expect(isAutoAddableApiName("_initterm")).toBe(false);
    expect(isAutoAddableApiName("QEAAEXZ")).toBe(false);
  });
});

describe("buildPivotFlow", () => {
  it("liga módulos pelo nome da API e cruza endereços quando coincidem", () => {
    const flow = buildPivotFlow("IsDebuggerPresent", hits, ["IsDebuggerPresent"]);
    expect(flow.joinBy).toBe("name");
    expect(flow.mapped).toBe(true);
    const m1 = flow.modules.find((row) => row.module === "TraceFcnCall.M1");
    const fi = flow.modules.find((row) => row.module === "FunctionInterceptor");
    expect(fi?.occurrences).toBe(1);
    expect(m1?.occurrences).toBe(1);
    expect(flow.sharedAddresses).toContain("0x7ffb1000");
    expect(flow.mermaid).toContain("IsDebuggerPresent");
    expect(flow.mermaid).toContain("FunctionInterceptor");
    expect(flow.mermaid).toContain("TraceFcnCall.M1");
    expect(flow.mermaid).not.toContain("ausente");
    expect(flow.chainLevel).toBe("call-origin");
    expect(flow.likeIsDebuggerPresent).toBe(false);
  });

  it("só marca cadeia completa tipo IsDebuggerPresent quando os seis módulos e origem target existem", () => {
    const fileFor: Record<(typeof CONTRADEF_MODULES)[number], { fileName: string; logType: TraceIndexHit["logType"] }> = {
      FunctionInterceptor: { fileName: "s.FunctionInterceptor.cdf", logType: "FunctionInterceptor" },
      "TraceFcnCall.M1": { fileName: "s.TraceFcnCall.M1.cdf", logType: "TraceFcnCall" },
      "TraceFcnCall.M2": { fileName: "s.TraceFcnCall.M2.cdf", logType: "TraceFcnCall" },
      TraceInstructions: { fileName: "s.TraceInstructions.cdf", logType: "TraceInstructions" },
      TraceMemory: { fileName: "s.TraceMemory.cdf", logType: "TraceMemory" },
      TraceDisassembly: { fileName: "s.TraceDisassembly.cdf", logType: "TraceDisassembly" },
    };
    const complete: TraceIndexHit[] = CONTRADEF_MODULES.map((mod, i) => ({
      fileName: fileFor[mod].fileName,
      logType: fileFor[mod].logType,
      lineNumber: i + 1,
      apis: ["IsDebuggerPresent"],
      mapped: ["IsDebuggerPresent"],
      origin: "target" as const,
      addresses: ["0x7ffb1000"],
    }));
    const flow = buildPivotFlow("IsDebuggerPresent", complete, ["IsDebuggerPresent"]);
    expect(flow.chainLevel).toBe("full-chain");
    expect(flow.likeIsDebuggerPresent).toBe(true);
  });
});

describe("backboneMermaid", () => {
  it("não desenha caixas ausentes — só módulos com ocorrência", () => {
    const flow = buildPivotFlow("RtlGetCurrentServiceSessionId", [
      {
        fileName: "s.TraceInstructions.cdf",
        logType: "TraceInstructions",
        lineNumber: 2,
        apis: ["RtlGetCurrentServiceSessionId"],
        mapped: [],
        origin: "unknown",
        occurrences: 2,
      },
    ]);
    expect(flow.mermaid).toContain("RtlGetCurrentServiceSessionId");
    expect(flow.mermaid).toContain("TraceInstructions ×2");
    expect(flow.mermaid).not.toContain("ausente");
    expect(flow.mermaid).not.toContain("FunctionInterceptor");
    expect(flow.mermaid).not.toContain("origem da chamada");
  });
});

describe("pickDefaultPivot", () => {
  it("não escolhe helper ntdll quando há API de análise", () => {
    const rtl = buildPivotFlow("RtlGetCurrentServiceSessionId", [
      {
        fileName: "s.TraceInstructions.cdf",
        logType: "TraceInstructions",
        lineNumber: 2,
        apis: ["RtlGetCurrentServiceSessionId"],
        mapped: [],
        origin: "unknown",
        occurrences: 2,
      },
    ]);
    const gpa = buildPivotFlow("GetProcAddress", hits, ["GetProcAddress"]);
    expect(rankPivotFlow(gpa)).toBeGreaterThan(rankPivotFlow(rtl));
    expect(pickDefaultPivot([rtl, gpa])?.api).toBe("GetProcAddress");
  });
});

describe("presentApisMermaid", () => {
  it("liga só APIs com ocorrência, na ordem dada", () => {
    const present = buildPivotFlow("IsDebuggerPresent", hits, ["IsDebuggerPresent"]);
    const absent = buildPivotFlow("CheckRemoteDebuggerPresent", hits, ["CheckRemoteDebuggerPresent"]);
    const chart = presentApisMermaid([absent, present]);
    expect(chart).toContain("IsDebuggerPresent");
    expect(chart).not.toContain("CheckRemoteDebuggerPresent");
  });
});

describe("syncMappedCatalogFromApis", () => {
  let root = "";

  afterEach(async () => {
    resetMappedCatalogCache();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("cria pasta + markdown só para funções novas", async () => {
    root = await mkdtemp(join(tmpdir(), "funcoes-mapeadas-"));
    const first = await syncMappedCatalogFromApis(["UrlDownloadToFileW"], { root, hits });
    expect(first.added).toEqual(["UrlDownloadToFileW"]);
    const dirs = await readdir(root);
    expect(dirs).toContain("UrlDownloadToFileW");
    const md = await readFile(join(root, "UrlDownloadToFileW", "fluxo_urldownloadtofilew_mapeado.md"), "utf8");
    expect(md).toContain("FunctionInterceptor");
    expect(md).toContain("TraceFcnCall.M1");
    const second = await syncMappedCatalogFromApis(["UrlDownloadToFileW"], { root });
    expect(second.already).toEqual(["UrlDownloadToFileW"]);
    expect(second.added).toEqual([]);
  });
});
