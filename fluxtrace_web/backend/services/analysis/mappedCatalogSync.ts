/**
 * Catálogo em disco (`FUNCOES_MAPEADAS`) anota; o rastro manda.
 * Funções novas no interceptor/M1/M2 passam a ter pasta automática.
 * Nomes só em TraceInstructions (muitas vezes callee sem caller) ficam no índice, não abrem pasta.
 * A cadeia entre os seis .cdf é a mesma do fluxo IsDebuggerPresent validado com analista.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { loadMappedCatalogNames, resetMappedCatalogCache } from "./traceApiDiscovery";
import type { TraceIndexHit } from "./traceIndexArtifact";

export const CONTRADEF_MODULES = [
  "FunctionInterceptor",
  "TraceFcnCall.M1",
  "TraceFcnCall.M2",
  "TraceInstructions",
  "TraceMemory",
  "TraceDisassembly",
] as const;

export type ContradefModule = (typeof CONTRADEF_MODULES)[number];

const CATALOG_SOURCE = new Set<ContradefModule>([
  "FunctionInterceptor",
  "TraceFcnCall.M1",
  "TraceFcnCall.M2",
]);

const SKIP_AUTO_NAMES = new Set([
  "isdebuggerpresent_flow",
  "cdf",
  "dll",
  "exe",
  "ntdll",
  "kernel32",
  "kernelbase",
]);

const MAX_ADDR_PER_MODULE = 12;
const MAX_PIVOTS = 200;

export type PivotModuleHits = {
  module: ContradefModule;
  fileName: string;
  occurrences: number;
  firstLine: number;
  addresses: string[];
};

export type PivotValidationStatus = "pass" | "fail";

export type PivotValidationStep = {
  id: "named" | "origin_target" | "m1_or_m2" | "instructions" | "memory" | "disassembly";
  status: PivotValidationStatus;
  detail: string;
};

export type PivotChainLevel = "absent" | "name-only" | "call-origin" | "full-chain";

export type PivotFlow = {
  api: string;
  joinBy: "name";
  mapped: boolean;
  modules: PivotModuleHits[];
  sharedAddresses: string[];
  mermaid: string;
  origin: { "pin-runtime": number; target: number; unknown: number };
  chainLevel: PivotChainLevel;
  likeIsDebuggerPresent: boolean;
  validationSteps: PivotValidationStep[];
};

export type MappedCatalogSyncResult = {
  root: string;
  added: string[];
  already: string[];
  skipped: string[];
};

export function catalogRoot(explicit = process.env.FUNCOES_MAPEADAS?.trim() ?? ""): string {
  return explicit;
}

export function classifyContradefModule(fileName: string, logType = ""): ContradefModule | null {
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

export function isCatalogSourceModule(module: ContradefModule | null): boolean {
  return module != null && CATALOG_SOURCE.has(module);
}

export function isAutoAddableApiName(name: string): boolean {
  if (SKIP_AUTO_NAMES.has(name.toLowerCase())) return false;
  // Pasta de metodologia: Win32/NT em PascalCase. CRT (malloc) e nomes mangled (QEAAEXZ) ficam no índice, não no catálogo.
  if (!/^[A-Z][A-Za-z0-9]{3,79}$/.test(name)) return false;
  if (!/[a-z]/.test(name)) return false;
  return true;
}

export function extractHexAddresses(text: string, cap = MAX_ADDR_PER_MODULE): string[] {
  const found = text.match(/0x[0-9a-fA-F]+/g) ?? [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(raw);
    if (unique.length >= cap) break;
  }
  return unique;
}

function emptyHits(module: ContradefModule): PivotModuleHits {
  return { module, fileName: "", occurrences: 0, firstLine: 0, addresses: [] };
}

function intersectAddresses(groups: readonly string[][]): string[] {
  const nonempty = groups.filter((g) => g.length > 0);
  if (nonempty.length < 2) return [];
  const [first, ...rest] = nonempty;
  const restSets = rest.map((g) => new Set(g.map((a) => a.toLowerCase())));
  return (first ?? []).filter((addr) => restSets.every((set) => set.has(addr.toLowerCase())));
}

function mermaidModuleId(mod: ContradefModule): string {
  return mod.replace(/[^A-Za-z0-9]/g, "");
}

/** Helpers CRT/ntdll que aparecem em quase todo o TI do Windows — não são pivô de análise. */
export const STARTUP_NOISE_APIS = new Set([
  "RtlGetCurrentServiceSessionId",
  "RtlDeactivateActivationContextUnsafeFast",
  "RtlActivateActivationContextUnsafeFast",
  "RtlLeaveCriticalSection",
  "RtlEnterCriticalSection",
  "RtlAcquireSRWLockExclusive",
  "RtlReleaseSRWLockExclusive",
  "FlsAlloc",
  "FlsSetValue",
  "FlsGetValue",
  "FlsFree",
]);

function callerCaption(origin?: { "pin-runtime": number; target: number; unknown: number }): string {
  if (!origin) return "quem chamou: sem evidência";
  if (origin.target > 0) return "quem chamou: amostra";
  if (origin["pin-runtime"] > 0) return "quem chamou: Pin";
  return "quem chamou: sem evidência";
}

export function backboneMermaid(
  api: string,
  modules: readonly PivotModuleHits[],
  origin?: { "pin-runtime": number; target: number; unknown: number },
): string {
  const byMod = new Map(modules.map((row) => [row.module, row]));
  const present = CONTRADEF_MODULES.filter((mod) => (byMod.get(mod)?.occurrences ?? 0) > 0);
  const who = callerCaption(origin);
  if (!present.length) {
    return `flowchart TB\n  who["${who}"]\n  N["${api}"]\n  who --> N\n`;
  }
  const mark = (mod: ContradefModule) => `${mod} ×${byMod.get(mod)!.occurrences}`;
  const hasCall = present.includes("TraceFcnCall.M1") || present.includes("TraceFcnCall.M2");
  const head = ["flowchart TB", `  who["${who}"]`, `  API["${api}"]`, "  who --> API"];
  if (!hasCall) {
    const lines = [...head];
    let prev = "API";
    for (const mod of present) {
      const id = mermaidModuleId(mod);
      lines.push(`  ${id}["${mark(mod)}"]`);
      lines.push(`  ${prev} --> ${id}`);
      prev = id;
    }
    return `${lines.join("\n")}\n`;
  }
  const lines = [...head];
  let from = "API";
  if (present.includes("FunctionInterceptor")) {
    lines.push(`  FI["${mark("FunctionInterceptor")}"]`);
    lines.push("  API --> FI");
    from = "FI";
  }
  lines.push("  como{\"como foi a chamada?\"}");
  lines.push(`  ${from} --> como`);
  const tails: string[] = [];
  if (present.includes("TraceFcnCall.M1")) {
    lines.push(`  M1["${mark("TraceFcnCall.M1")}"]`);
    lines.push("  como -->|directa IAT / thunk| M1");
    tails.push("M1");
  }
  if (present.includes("TraceFcnCall.M2")) {
    lines.push(`  M2["${mark("TraceFcnCall.M2")}"]`);
    lines.push("  como -->|dinâmica / GetProcAddress| M2");
    tails.push("M2");
  }
  const rest = present.filter(
    (mod) => mod === "TraceInstructions" || mod === "TraceMemory" || mod === "TraceDisassembly",
  );
  if (!rest.length) return `${lines.join("\n")}\n`;
  const firstId = mermaidModuleId(rest[0]!);
  lines.push(`  ${firstId}["${mark(rest[0]!)}"]`);
  for (const tail of tails) lines.push(`  ${tail} --> ${firstId}`);
  if (!tails.length) lines.push(`  como --> ${firstId}`);
  let prev = firstId;
  for (const mod of rest.slice(1)) {
    const id = mermaidModuleId(mod);
    lines.push(`  ${id}["${mark(mod)}"]`);
    lines.push(`  ${prev} --> ${id}`);
    prev = id;
  }
  return `${lines.join("\n")}\n`;
}

export function assessPivotChain(
  modules: readonly PivotModuleHits[],
  origin: { "pin-runtime": number; target: number; unknown: number },
): Pick<PivotFlow, "chainLevel" | "likeIsDebuggerPresent" | "validationSteps"> {
  const occ = (mod: ContradefModule) => modules.find((row) => row.module === mod)?.occurrences ?? 0;
  const fi = occ("FunctionInterceptor");
  const m1 = occ("TraceFcnCall.M1");
  const m2 = occ("TraceFcnCall.M2");
  const ti = occ("TraceInstructions");
  const tm = occ("TraceMemory");
  const td = occ("TraceDisassembly");
  const named = fi + m1 + m2 + ti + tm + td > 0;
  const callOrigin = m1 > 0 || m2 > 0;
  const full =
    fi > 0 && callOrigin && ti > 0 && tm > 0 && td > 0;
  const targetOk = origin.target > 0;
  const steps: PivotValidationStep[] = [
    { id: "named", status: named ? "pass" : "fail", detail: named ? "O nome da API aparece em pelo menos um .cdf" : "O rastro desta amostra não nomeia esta API" },
    { id: "origin_target", status: targetOk ? "pass" : "fail", detail: targetOk ? `origem target ×${origin.target}` : "sem evidência de origem amostra (Pin/unknown)" },
    { id: "m1_or_m2", status: callOrigin ? "pass" : "fail", detail: callOrigin ? `${m1 > 0 ? "M1 directa" : ""}${m1 > 0 && m2 > 0 ? " + " : ""}${m2 > 0 ? "M2 dinâmica" : ""}`.trim() : "sem M1 nem M2 — não dá para dizer se a chamada foi directa ou dinâmica" },
    { id: "instructions", status: ti > 0 ? "pass" : "fail", detail: ti > 0 ? `TraceInstructions ×${ti}` : "sem CALL/instrução neste rastro" },
    { id: "memory", status: tm > 0 ? "pass" : "fail", detail: tm > 0 ? `TraceMemory ×${tm}` : "sem contexto de dados neste rastro" },
    { id: "disassembly", status: td > 0 ? "pass" : "fail", detail: td > 0 ? `TraceDisassembly ×${td}` : "sem bloco de decisão neste rastro" },
  ];
  const chainLevel: PivotChainLevel = !named ? "absent" : full ? "full-chain" : callOrigin ? "call-origin" : "name-only";
  return { chainLevel, likeIsDebuggerPresent: full && targetOk, validationSteps: steps };
}

export function buildPivotFlow(api: string, hits: readonly TraceIndexHit[], mappedNames: readonly string[] = []): PivotFlow {
  const acc = new Map<ContradefModule, PivotModuleHits>();
  for (const mod of CONTRADEF_MODULES) acc.set(mod, emptyHits(mod));

  for (const hit of hits) {
    const module = classifyContradefModule(hit.fileName, hit.logType);
    if (!module) continue;
    if (!hit.apis.includes(api) && !hit.mapped.includes(api)) continue;
    const add = hit.occurrences != null && hit.occurrences > 0 ? hit.occurrences : 1;
    const row = acc.get(module) ?? emptyHits(module);
    if (!row.fileName) {
      row.fileName = hit.fileName;
      row.firstLine = hit.lineNumber;
    }
    row.occurrences += add;
    const extra = Array.isArray(hit.addresses) ? hit.addresses : [];
    for (const addr of extra) {
      if (row.addresses.length >= MAX_ADDR_PER_MODULE) break;
      if (!row.addresses.some((a) => a.toLowerCase() === addr.toLowerCase())) row.addresses.push(addr);
    }
    acc.set(module, row);
  }

  const modules = CONTRADEF_MODULES.map((mod) => acc.get(mod) ?? emptyHits(mod));
  const mappedSet = new Set(mappedNames);
  const origin = { "pin-runtime": 0, target: 0, unknown: 0 };
  for (const hit of hits) {
    if (!hit.apis.includes(api) && !hit.mapped.includes(api)) continue;
    const add = hit.occurrences != null && hit.occurrences > 0 ? hit.occurrences : 1;
    const key = hit.origin === "pin-runtime" || hit.origin === "target" ? hit.origin : "unknown";
    origin[key] += add;
  }
  const assessment = assessPivotChain(modules, origin);
  return {
    api,
    joinBy: "name",
    mapped: mappedSet.has(api) || mappedSet.has(api.replace(/A$|W$/, "")),
    modules,
    sharedAddresses: intersectAddresses(modules.map((row) => row.addresses)),
    mermaid: backboneMermaid(api, modules, origin),
    origin,
    ...assessment,
  };
}

export function hitsFromObservedRows(
  rows: ReadonlyArray<{
    api: string;
    fileName: string;
    logType: string;
    lineNumber: number;
    occurrences?: number;
    mapped?: string[];
    origin?: "pin-runtime" | "target" | "unknown";
  }>,
): TraceIndexHit[] {
  return rows.map((row) => ({
    fileName: row.fileName,
    logType: row.logType,
    lineNumber: row.lineNumber,
    apis: [row.api],
    mapped: Array.isArray(row.mapped) ? row.mapped : [],
    occurrences: row.occurrences,
    origin: row.origin,
  }));
}

export function catalogSourceApis(hits: readonly TraceIndexHit[]): string[] {
  const names = new Set<string>();
  for (const hit of hits) {
    const module = classifyContradefModule(hit.fileName, hit.logType);
    if (!isCatalogSourceModule(module)) continue;
    for (const api of hit.apis) {
      if (isAutoAddableApiName(api)) names.add(api);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function hydratePivotFlow(flow: PivotFlow): PivotFlow {
  const hasHits = flow.modules.some((row) => row.occurrences > 0);
  if (flow.validationSteps.length && !(flow.chainLevel === "absent" && hasHits)) {
    return flow;
  }
  return { ...flow, ...assessPivotChain(flow.modules, flow.origin) };
}

export function presentApisMermaid(flows: readonly PivotFlow[], cap = 40): string {
  const named = flows.filter((flow) => flow.chainLevel !== "absent");
  const withTarget = named.filter((flow) => flow.origin.target > 0);
  const present = (withTarget.length ? withTarget : named.filter((flow) => flow.origin["pin-runtime"] <= 0)).slice(0, cap);
  if (!present.length) return "";
  const lines = ["flowchart LR"];
  present.forEach((flow, index) => {
    const who = flow.origin.target > 0 ? "amostra" : flow.origin["pin-runtime"] > 0 ? "Pin" : "sem caller";
    lines.push(`  p${index}["${flow.api}\\n${flow.chainLevel} · ${who}"]`);
    if (index > 0) lines.push(`  p${index - 1} --> p${index}`);
  });
  return `${lines.join("\n")}\n`;
}

export function rankPivotFlow(flow: PivotFlow): number {
  const level = { "full-chain": 3, "call-origin": 2, "name-only": 1, absent: 0 }[flow.chainLevel];
  const modules = flow.modules.filter((row) => row.occurrences > 0).length;
  const target = flow.origin.target > 0 ? 20 : 0;
  const noise = STARTUP_NOISE_APIS.has(flow.api) ? -80 : 0;
  return level * 100 + modules * 10 + (flow.mapped ? 5 : 0) + target + noise;
}

export function pickDefaultPivot(flows: readonly PivotFlow[]): PivotFlow | null {
  const present = flows.filter((flow) => flow.chainLevel !== "absent");
  if (!present.length) return null;
  return [...present].sort((a, b) => rankPivotFlow(b) - rankPivotFlow(a))[0] ?? null;
}

export function buildPivotFlows(
  hits: readonly TraceIndexHit[],
  opts: { catalogNames?: readonly string[]; extraApis?: readonly string[] } = {},
): PivotFlow[] {
  const catalog = opts.catalogNames ?? loadMappedCatalogNames();
  const wanted = new Set<string>(catalogSourceApis(hits));
  for (const name of catalog) {
    if (hits.some((hit) => hit.apis.includes(name) || hit.mapped.includes(name))) wanted.add(name);
  }
  for (const name of opts.extraApis ?? []) wanted.add(name);
  const apis = [...wanted].sort((a, b) => a.localeCompare(b)).slice(0, MAX_PIVOTS);
  return apis.map((api) => buildPivotFlow(api, hits, catalog));
}

function fluxoMarkdownFilename(slug: string): string {
  const safe = slug.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return `fluxo_${safe}_mapeado.md`;
}

export function autoCatalogMarkdown(api: string, coverage?: PivotFlow): string {
  const mermaid = coverage?.mermaid ?? backboneMermaid(api, CONTRADEF_MODULES.map(emptyHits), coverage?.origin);
  return `# Fluxo ${api}

Pasta criada automaticamente porque **\`${api}\` apareceu no rastro Contradef**. O log manda: o catálogo anota, não filtra.

A cadeia é a mesma validada com analista em \`IsDebuggerPresent\`: o **nome da função** liga os seis artefatos; endereços hexadecimais na mesma linha (RIP, retorno, call site) reforçam o cruzamento quando coincidem.

| Artefato | Papel relativamente a \`${api}\` |
|---|---|
| **FunctionInterceptor** | Evento soberano da chamada / retorno |
| **TraceFcnCall.M1** | Chamada directa (IAT / thunk) |
| **TraceFcnCall.M2** | Chamada indirecta / dinâmica (\`GetProcAddress\`, trampolim) |
| **TraceInstructions** | \`CALL\` e preparação de argumentos |
| **TraceMemory** | Leituras/escritas coerentes com argumentos ou resultado |
| **TraceDisassembly** | Blocos onde o resultado decide o fluxo |

\`\`\`mermaid
${mermaid.trim()}
\`\`\`
`;
}

export async function ensureMappedCatalogEntry(
  api: string,
  root = catalogRoot(),
  coverage?: PivotFlow,
): Promise<"added" | "already" | "skipped"> {
  if (!root || !existsSync(root) || !isAutoAddableApiName(api)) return "skipped";
  const slugDir = join(root, api);
  if (existsSync(slugDir)) return "already";
  await mkdir(slugDir, { recursive: true });
  await writeFile(join(slugDir, fluxoMarkdownFilename(api)), autoCatalogMarkdown(api, coverage), "utf8");
  return "added";
}

export async function syncMappedCatalogFromApis(
  apis: readonly string[],
  opts: { root?: string; hits?: readonly TraceIndexHit[] } = {},
): Promise<MappedCatalogSyncResult> {
  const root = opts.root ?? catalogRoot();
  const result: MappedCatalogSyncResult = { root, added: [], already: [], skipped: [] };
  if (!opts.root && process.env.VITEST && process.env.CONTRADEF_ALLOW_CATALOG_SYNC !== "1") {
    result.skipped.push(...apis);
    return result;
  }
  if (!root || !existsSync(root)) {
    result.skipped.push(...apis);
    return result;
  }
  for (const api of apis) {
    const coverage = opts.hits?.length ? buildPivotFlow(api, opts.hits, loadMappedCatalogNames(root)) : undefined;
    const status = await ensureMappedCatalogEntry(api, root, coverage);
    result[status].push(api);
  }
  resetMappedCatalogCache();
  return result;
}

export async function listCatalogFolderNames(root = catalogRoot()): Promise<string[]> {
  if (!root || !existsSync(root)) return [];
  const ents = await readdir(root, { withFileTypes: true });
  return ents
    .filter((e) => e.isDirectory() && /^[A-Za-z_][A-Za-z0-9_]*$/.test(e.name) && e.name !== "isdebuggerpresent_flow")
    .map((e) => basename(e.name))
    .sort((a, b) => a.localeCompare(b));
}
