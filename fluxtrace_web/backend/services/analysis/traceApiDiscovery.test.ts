import { describe, expect, it } from "vitest";

import { annotateMapped, discoverApisInLine } from "./traceApiDiscovery";

describe("discoverApisInLine", () => {
  it("lê o nome no FunctionInterceptor (português Contradef)", () => {
    expect(discoverApisInLine("  [-] Início da chamada GetProcAddress", [])).toEqual(["GetProcAddress"]);
    expect(discoverApisInLine("[+] VirtualProtect...", [])).toEqual(["VirtualProtect"]);
    expect(discoverApisInLine("    Retorno LoadLibraryA: 0x7ffb272542c0", [])).toEqual(["LoadLibraryA"]);
  });

  it("lê o export em TraceFcnCall.M1/M2", () => {
    const line = "7ffde23daec0   T[0]  C:\\Windows\\System32\\KERNEL32.DLL:GetProcAddress";
    expect(discoverApisInLine(line, [])).toEqual(["GetProcAddress"]);
  });

  it("não depende da lista de 21: GetACP e FlsAlloc saem do próprio log", () => {
    expect(discoverApisInLine("[+] GetACP...", [])).toEqual(["GetACP"]);
    expect(discoverApisInLine("ntdll.dll:FlsAlloc", [])).toEqual(["FlsAlloc"]);
  });

  it("não inventa API em cabeçalho PE sem chamada", () => {
    expect(discoverApisInLine("        Nome da seção: .text", [])).toEqual([]);
    expect(discoverApisInLine("[*] Concluído", [])).toEqual([]);
    expect(discoverApisInLine("[+] Informação de seções...", [])).toEqual([]);
  });

  it("anota catálogo M1 sem filtrar o que o log trouxe", () => {
    const apis = discoverApisInLine("[+] UrlDownloadToFileW...", ["LoadLibraryA"]);
    expect(apis).toContain("UrlDownloadToFileW");
    const { mapped } = annotateMapped(apis, ["LoadLibraryA"]);
    expect(mapped).toEqual([]);
  });
});
