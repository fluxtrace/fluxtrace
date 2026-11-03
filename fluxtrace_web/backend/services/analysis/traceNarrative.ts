import type { PivotFlow } from "./mappedCatalogSync";

/** Notas curtas, só para APIs cujo papel no rastro é estável. Não são IDs MITRE. */
const API_NOTES: Record<string, string> = {
  RtlGetCurrentServiceSessionId:
    "Helper ntdll do ID de sessão (arranque típico, também em binários benignos). Sem TA0005.",
  GetProcAddress: "Resolução dinâmica de export. T1027.007 só com origem target.",
  IsDebuggerPresent: "Anti-debug. T1622 se origem target e FI/M1|M2.",
  CheckRemoteDebuggerPresent: "Anti-debug remoto. T1622 se origem target.",
  VirtualProtect: "Protecção de páginas. T1027 exige RW→RX no rastro, não só o nome.",
  VirtualAlloc: "Alocação de memória. Sozinha não prova unpacking.",
  GetACP: "Code page ANSI — CRT de arranque, não evasão.",
  GetTickCount: "Relógio. T1497.003 é etiqueta; também ocorre em CRT benigno.",
};

export function noteForApi(api: string): string {
  return API_NOTES[api] ?? `Export «${api}».`;
}

export function campaignLabelFromSampleName(sampleName: string): "benign" | "infected" | "unknown" {
  const n = sampleName.toLowerCase();
  if (n.includes("benign")) return "benign";
  if (n.includes("infected") || n.includes("malware")) return "infected";
  return "unknown";
}

export function buildDeterministicSampleNarrative(params: {
  sampleName: string;
  flows: PivotFlow[];
  focusApi?: string | null;
}): string {
  const label = campaignLabelFromSampleName(params.sampleName);
  const present = params.flows.filter((flow) => flow.chainLevel !== "absent");
  const focus = present.find((flow) => flow.api === params.focusApi) ?? present[0] ?? null;
  const camp =
    label === "benign" ? "Campanha: benigna." : label === "infected" ? "Campanha: infectada." : "";
  if (!focus) {
    return [camp, "Rastro sem APIs nomeadas."].filter(Boolean).join(" ");
  }
  const mods = focus.modules
    .filter((row) => row.occurrences > 0)
    .map((row) => `${row.module} ×${row.occurrences}`);
  const origin =
    focus.origin.target > 0
      ? "origem amostra"
      : focus.origin["pin-runtime"] > 0
        ? "origem Pin"
        : "origem desconhecida";
  const tiOnly =
    focus.chainLevel === "name-only" && mods.some((m) => m.startsWith("TraceInstructions"))
      ? " Só TI: não se afirma que a amostra fez a chamada."
      : "";
  return [
    camp,
    `\`${focus.api}\` (${focus.chainLevel}, ${origin}).`,
    noteForApi(focus.api),
    mods.length ? mods.join(", ") + "." : "",
    tiOnly,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
