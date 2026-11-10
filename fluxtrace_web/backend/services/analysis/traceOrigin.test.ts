import { describe, expect, it } from "vitest";

import { callSiteSegment, createOriginTracker, extractCallerImages, isPinRuntimeImage } from "./traceOrigin";

describe("traceOrigin", () => {
  it("reconhece imagens do runtime Pin", () => {
    expect(isPinRuntimeImage(String.raw`C:\pin-3.28-98749-g6643ecee5-windows\intel64\bin\pin.exe`)).toBe(true);
    expect(isPinRuntimeImage(String.raw`C:\pin\intel64\bin\pinvm.dll`)).toBe(true);
    expect(isPinRuntimeImage("contradef.dll")).toBe(true);
    expect(isPinRuntimeImage(String.raw`C:\Analysis\sample.exe`)).toBe(false);
    expect(isPinRuntimeImage(String.raw`C:\Windows\System32\KERNEL32.DLL`)).toBe(false);
  });

  it("não trata KERNEL32:Export sozinho como caller (é o callee)", () => {
    const line = String.raw`7ffde23daec0   T[0]  C:\Windows\System32\KERNEL32.DLL:GetProcAddress`;
    expect(extractCallerImages(line)).toEqual([]);
  });

  it("Call site à esquerda de -> é quem chamou; o export à direita não", () => {
    const line =
      "Call 7ff712340010 malware.exe:start+0x0012 -> 7ffe1234abcd KERNEL32.DLL:IsDebuggerPresent [T0] (0, 0, ...)";
    expect(callSiteSegment(line)).toContain("malware.exe");
    expect(callSiteSegment(line)).not.toContain("IsDebuggerPresent");
    expect(extractCallerImages(line)).toEqual(["malware.exe"]);

    const tracker = createOriginTracker("TraceInstructions");
    expect(tracker.classify(line)).toMatchObject({ origin: "target", image: "malware.exe" });
  });

  it("Call a partir do Pin fica pin-runtime", () => {
    const line =
      "Call 7ffd11110000 pin.exe:?+0x0040 -> 7ffe1234abcd ntdll.dll:NtAllocateVirtualMemory [T0] (0, ...)";
    const tracker = createOriginTracker("TraceInstructions");
    expect(tracker.classify(line).origin).toBe("pin-runtime");
  });

  it("instrução com imagem da amostra (sem seta) usa o módulo que executa", () => {
    const tracker = createOriginTracker("TraceInstructions");
    expect(
      tracker.classify("7ff712340010 malware.exe:start+0x0012                    call qword ptr [rip+0x10]").origin,
    ).toBe("target");
  });

  it("Call só com callee, sem imagem à esquerda, continua unknown", () => {
    const tracker = createOriginTracker("TraceInstructions");
    expect(
      tracker.classify("Call 7ff712340010 -> 7ffe1234abcd ntdll.dll:RtlAllocateHeap [T0] (0, ...)").origin,
    ).toBe("unknown");
  });

  it("FunctionInterceptor: Nome da imagem da amostra → target; Pin → pin-runtime", () => {
    const tracker = createOriginTracker("FunctionInterceptor");
    expect(tracker.classify("    Nome da imagem: C:\\Analysis\\sample.exe").origin).toBe("target");
    expect(tracker.classify("[-] Início da chamada GetProcAddress").origin).toBe("target");

    const pin = createOriginTracker("FunctionInterceptor");
    expect(pin.classify("    Nome da imagem: C:\\pin-3.28\\intel64\\bin\\pin.exe").origin).toBe("pin-runtime");
    expect(pin.classify("[-] Início da chamada GetProcAddress").origin).toBe("pin-runtime");
  });

  it("TraceFcnCall sem imagem Pin fica target (hook da app)", () => {
    const tracker = createOriginTracker("TraceFcnCall");
    expect(
      tracker.classify(String.raw`7ffde23daec0   T[0]  C:\Windows\System32\KERNEL32.DLL:LoadLibraryExW`).origin,
    ).toBe("target");
  });

  it("TraceInstructions sem imagem fica unknown", () => {
    const tracker = createOriginTracker("TraceInstructions");
    expect(tracker.classify("0x7ff123  mov rax, rcx").origin).toBe("unknown");
  });

  it("muda de Pin para amostra quando o cabeçalho muda", () => {
    const tracker = createOriginTracker("FunctionInterceptor");
    expect(tracker.classify("Nome da imagem: C:\\pin\\intel64\\bin\\pinvm.dll").origin).toBe("pin-runtime");
    expect(tracker.classify("[-] Início da chamada NtQueryInformationProcess").origin).toBe("pin-runtime");
    expect(tracker.classify("Nome da imagem: C:\\Analysis\\sample.exe").origin).toBe("target");
    expect(tracker.classify("[-] Início da chamada IsDebuggerPresent").origin).toBe("target");
  });
});
