import { describe, expect, it } from "vitest";

import { analyzeLogTextOffline } from "./analysisService";
import { buildTraceIndexDocument, compactTraceOriginFromIndexDocument, hashCanonicalIndex } from "./traceIndexArtifact";

const INTERCEPTOR = `
[+] Informação de seções...
    Nome da imagem: C:\\Analysis\\sample.exe
[-] Início da chamada GetACP
    Retorno GetACP: 1252
[-] Chamada GetACP concluída
[+] GetProcAddress...
[-] Início da chamada GetProcAddress
    Retorno GetProcAddress: 0x7ffb272542c0
[-] Chamada GetProcAddress concluída
[*] Concluído
`.trim();

const M1 = `
7ffde23dadc0   T[0]  C:\\Windows\\System32\\KERNEL32.DLL:LoadLibraryExW
7ffde23daec0   T[0]  C:\\Windows\\System32\\KERNEL32.DLL:GetProcAddress
`.trim();

describe("pipeline e2e (discovery → índice → grafo)", () => {
  it("lê o que o .cdf registou, incluindo APIs fora da antiga lista de 21", () => {
    const interceptor = analyzeLogTextOffline("contradef.1.FunctionInterceptor.cdf", INTERCEPTOR);
    const m1 = analyzeLogTextOffline("contradef.1.TraceFcnCall.M1.cdf", M1);

    expect(interceptor.suspiciousApis).toEqual(expect.arrayContaining(["GetACP", "GetProcAddress"]));
    expect(m1.suspiciousApis).toEqual(expect.arrayContaining(["LoadLibraryExW", "GetProcAddress"]));
    expect(interceptor.triggerCount).toBe(0);

    const hits = [
      ...interceptor.observedHits.map((h) => ({
        fileName: "contradef.1.FunctionInterceptor.cdf",
        logType: interceptor.logType,
        ...h,
      })),
      ...m1.observedHits.map((h) => ({
        fileName: "contradef.1.TraceFcnCall.M1.cdf",
        logType: m1.logType,
        ...h,
      })),
    ];

    const doc = buildTraceIndexDocument({
      sourceFiles: [
        { fileName: "contradef.1.FunctionInterceptor.cdf", sha256: "aa".repeat(32), sizeBytes: INTERCEPTOR.length },
        { fileName: "contradef.1.TraceFcnCall.M1.cdf", sha256: "bb".repeat(32), sizeBytes: M1.length },
      ],
      hits,
      eventCapInGraph: 320,
    });

    expect(doc.observedApiCount).toBeGreaterThanOrEqual(3);
    expect(doc.observedApis.map((a) => a.api)).toEqual(
      expect.arrayContaining(["GetACP", "GetProcAddress", "LoadLibraryExW"]),
    );
    expect(doc.indexSha256).toBe(hashCanonicalIndex(hits));
    expect(hashCanonicalIndex(hits)).toBe(hashCanonicalIndex([...hits].reverse()));
    expect(doc.originCounts.target).toBeGreaterThan(0);
    const origin = compactTraceOriginFromIndexDocument(doc);
    expect(origin.observedApis.map((row) => row.api)).toEqual(
      expect.arrayContaining(["GetACP", "GetProcAddress", "LoadLibraryExW"]),
    );
    expect(origin.observedGraph.nodes.length).toBe(origin.observedApis.length);
    expect(origin.indexSha256).toBe(doc.indexSha256);
  });

  it("separa Pin de amostra: índice guarda os dois; comportamento só usa target", () => {
    const parsed = analyzeLogTextOffline(
      "contradef.1.FunctionInterceptor.cdf",
      `
    Nome da imagem: C:\\pin-3.28\\intel64\\bin\\pin.exe
[-] Início da chamada GetProcAddress
    Nome da imagem: C:\\Analysis\\sample.exe
[-] Início da chamada IsDebuggerPresent
`.trim(),
    );

    const origins = Object.fromEntries(parsed.observedHits.map((h) => [h.apis[0], h.origin]));
    expect(origins.GetProcAddress).toBe("pin-runtime");
    expect(origins.IsDebuggerPresent).toBe("target");
    expect(parsed.suspiciousApis).toEqual(["IsDebuggerPresent"]);
    expect(parsed.techniqueTags).toEqual(["Anti-debug"]);
    expect(parsed.observedHits).toHaveLength(2);
  });

  it("não inventa API no cabeçalho PE", () => {
    const parsed = analyzeLogTextOffline(
      "contradef.1.FunctionInterceptor.cdf",
      "[+] Informação de seções...\n    Nome da seção: .text\n[*] Concluído\n",
    );
    expect(parsed.suspiciousApis).toEqual([]);
    expect(parsed.observedHits).toEqual([]);
  });
});
