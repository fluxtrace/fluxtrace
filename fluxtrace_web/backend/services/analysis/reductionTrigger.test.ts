import { describe, expect, it } from "vitest";

import { analyzeLogTextOffline, isExecutableProtection } from "./analysisService";

const fiBlock = (api: string, param: string, value: string) =>
  [
    `[+] ${api}...`,
    "    Thread: 0",
    "    Id de chamada: 3",
    "    Endereço da rotina: 7ff923e01950",
    "    Parâmetros: ",
    "        lpAddress: 0x1b2c0000",
    "        dwSize: 4096 bytes",
    `        ${param}: ${value}`,
    "    Endereço da função chamante: 0x7ff6ec130ad9",
    `  [-] Início da chamada ${api}`,
    `    Retorno ${api}: 0x1`,
    `  [-] Chamada ${api} concluída`,
    "[*] Concluído",
    "",
  ].join("\n");

const header = ["", "[+] Informação de seções...", "    Nome da imagem: C:\\Analysis\\sample.exe", "[*] Concluído", ""].join("\n");

describe("gatilho no FunctionInterceptor", () => {
  it("lê a protecção pedida em hexadecimal no bloco do VirtualProtect", () => {
    const text = header + fiBlock("VirtualProtect", "flNewProtect", "0x40");
    const parsed = analyzeLogTextOffline("contradef.1.FunctionInterceptor.cdf", text);
    expect(parsed.protectionArgsSeen).toBe(1);
    expect(parsed.triggerCount).toBe(1);
    expect(parsed.techniqueTags).toContain("Transição RW→RX");
  });

  it("VirtualAlloc com PAGE_READWRITE é avaliado mas não dispara", () => {
    const text = header + fiBlock("VirtualAlloc", "flProtect", "0x4");
    const parsed = analyzeLogTextOffline("contradef.1.FunctionInterceptor.cdf", text);
    expect(parsed.protectionArgsSeen).toBe(1);
    expect(parsed.triggerCount).toBe(0);
    expect(parsed.techniqueTags).not.toContain("Transição RW→RX");
  });

  it("o nome VirtualProtect sozinho não gera a etiqueta", () => {
    const parsed = analyzeLogTextOffline(
      "contradef.1.TraceFcnCall.M2.cdf",
      "7ff923e01950   T[0]  C:\\Windows\\System32\\KERNELBASE.dll:VirtualProtect",
    );
    expect(parsed.triggerCount).toBe(0);
    expect(parsed.techniqueTags).not.toContain("Transição RW→RX");
  });

  it("guarda o bloco do evento inteiro na saída reduzida", () => {
    const filler = Array.from({ length: 30 }, (_, i) => `        extra${i}: 0x0`).join("\n");
    const block = fiBlock("VirtualAlloc", "flProtect", "0x4").replace("        dwSize: 4096 bytes", `        dwSize: 4096 bytes\n${filler}`);
    const text = header + block;
    const parsed = analyzeLogTextOffline("contradef.1.FunctionInterceptor.cdf", text);
    const kept = new Set(parsed.keptLines.map((l) => l.text));
    for (const line of block.split("\n").filter((l) => l.trim())) {
      expect(kept.has(line)).toBe(true);
    }
  });

  it("bits de execução", () => {
    expect(isExecutableProtection(0x40)).toBe(true);
    expect(isExecutableProtection(0x20)).toBe(true);
    expect(isExecutableProtection(0x04)).toBe(false);
    expect(isExecutableProtection(0x02)).toBe(false);
  });
});

describe("redução em TraceInstructions", () => {
  const filler = (n: number) =>
    `0x77072a${n.toString(16).padStart(2, "0")} ntdll.dll:RtlIpv6AddressToStringA+0x01c6      mov esp, esi    | [T0] esp = 0xfef6c8`;

  it("une janelas ±4 sobrepostas e conta cada linha uma vez", () => {
    const lines: string[] = [];
    for (let n = 1; n <= 30; n += 1) {
      if (n === 10) lines.push("Call 0x401010 sample.exe+0x10 -> 0x7ff9 KERNEL32.DLL:IsDebuggerPresent [T0] (0)");
      else if (n === 13) lines.push("Call 0x7704de13 ntdll.dll:RtlFoo+0x00f3 -> 0x7ff9 KERNEL32.DLL:IsDebuggerPresent [T0] (0)");
      else lines.push(filler(n));
    }
    const kept: number[] = [];
    const parsed = analyzeLogTextOffline("contradef.1.TraceInstructions.cdf", lines.join("\n"));
    expect(parsed.originalLineCount).toBe(30);
    // 1–3 (cabeçalho) + 6–17 (janelas de 10 e 13 unidas) + 30 (última linha)
    expect(parsed.reducedLineCount).toBe(3 + 12 + 1);
    for (const line of parsed.keptLines) kept.push(line.lineNumber);
    expect(kept).toEqual([1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 30]);
  });

  it("a linha Return abre janela: o teste e o desvio depois do retorno ficam", () => {
    const lines = [
      "Call 0x401010 sample.exe+0x10 -> 0x7ff9 KERNEL32.DLL:IsDebuggerPresent [T0] (0)",
      ...Array.from({ length: 8 }, (_, i) => filler(i + 2)),
      "Return 0x7ff923e1c4ad KERNELBASE.dll:IsDebuggerPresent+0x000d [T0] returns: 0, ret addr: 0x401015, call addr: 0x401010",
      "0x401015 sample.exe+0x15      test eax, eax  | [T0] eflags = 0x246",
      "0x401017 sample.exe+0x17      jnz 0x401040  | [T0]",
      ...Array.from({ length: 10 }, (_, i) => filler(i + 20)),
    ];
    const parsed = analyzeLogTextOffline("contradef.1.TraceInstructions.cdf", lines.join("\n"));
    const kept = new Set(parsed.keptLines.map((l) => l.lineNumber));
    expect(kept.has(10)).toBe(true);
    expect(kept.has(11)).toBe(true);
    expect(kept.has(12)).toBe(true);
  });

  it("separa a mesma API por origem em vez de herdar a origem da 1.ª ocorrência", () => {
    const text = [
      "Call 0x7704de13 ntdll.dll:RtlFoo+0x00f3 -> 0x7ff9 KERNEL32.DLL:IsDebuggerPresent [T0] (0)",
      filler(2),
      "Call 0x401010 sample.exe+0x10 -> 0x7ff9 KERNEL32.DLL:IsDebuggerPresent [T0] (0)",
      "Call 0x401020 sample.exe+0x20 -> 0x7ff9 KERNEL32.DLL:IsDebuggerPresent [T0] (0)",
    ].join("\n");
    const parsed = analyzeLogTextOffline("contradef.1.TraceInstructions.cdf", text);
    const stats = parsed.observedApiStats.filter((s) => s.api === "IsDebuggerPresent");
    expect(stats.map((s) => [s.origin, s.occurrences, s.lineNumber]).sort()).toEqual(
      [
        ["target", 2, 3],
        ["unknown", 1, 1],
      ].sort(),
    );
    expect(parsed.occurrencesByOrigin.target).toBe(2);
  });
});
