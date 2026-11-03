/**
 * APIs vêm do rastro, não de uma lista fechada no código.
 * O catálogo M1 (`FUNCOES_MAPEADAS`) só anota o que já apareceu no .cdf.
 */
import { existsSync, readdirSync } from "node:fs";
import { basename } from "node:path";

const INTERCEPTOR_API = /(?:In[ií]cio da chamada|Retorno|Chamada|\[\+\])\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
const MODULE_EXPORT = /(?:[A-Za-z0-9_\-]+\.(?:dll|exe|DLL|EXE)|ntdll(?:\.dll)?):([A-Za-z_][A-Za-z0-9_]*)/g;
const BARE_EXPORT = /(?<![A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]{2,})\s*$/;

const SKIP_BARE = new Set([
  "cdf",
  "dll",
  "exe",
  "log",
  "the",
  "and",
  "for",
  "end",
  "thread",
]);

let mappedCache: string[] | null = null;

export function loadMappedCatalogNames(root = process.env.FUNCOES_MAPEADAS?.trim() ?? ""): string[] {
  if (mappedCache) return mappedCache;
  if (!root || !existsSync(root)) {
    mappedCache = [];
    return mappedCache;
  }
  const names: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = basename(entry.name);
    if (name.startsWith(".") || name === "isdebuggerpresent_flow") continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) names.push(name);
  }
  mappedCache = names.sort((a, b) => b.length - a.length);
  return mappedCache;
}

/** Testes / recarregar pasta. */
export function resetMappedCatalogCache(): void {
  mappedCache = null;
}

function isCompleteToken(name: string, line: string, start: number): boolean {
  if (name.length < 3 || !/^[A-Za-z_]/.test(name)) return false;
  if (SKIP_BARE.has(name.toLowerCase())) return false;
  const after = line[start + name.length] ?? "";
  if (!after) return true;
  return /[\s.:)\]\[]/.test(after);
}

export function discoverApisInLine(line: string, mappedNames: readonly string[] = loadMappedCatalogNames()): string[] {
  if (!line) return [];
  const found = new Set<string>();

  const take = (name: string | undefined, match: RegExpMatchArray) => {
    if (!name || match.index == null) return;
    const start = match.index + match[0].length - name.length;
    if (isCompleteToken(name, line, start)) found.add(name);
  };

  INTERCEPTOR_API.lastIndex = 0;
  for (const match of line.matchAll(INTERCEPTOR_API)) take(match[1], match);

  MODULE_EXPORT.lastIndex = 0;
  for (const match of line.matchAll(MODULE_EXPORT)) take(match[1], match);

  if (found.size === 0 && /TraceFcnCall|T\[\d+\]/.test(line)) {
    const bare = line.match(BARE_EXPORT);
    const name = bare?.[1];
    if (name && isCompleteToken(name, line, bare.index ?? 0)) found.add(name);
  }

  for (const api of mappedNames) {
    const idx = line.indexOf(api);
    if (idx >= 0 && isCompleteToken(api, line, idx)) found.add(api);
  }

  return Array.from(found);
}

export function annotateMapped(apis: readonly string[], mappedNames: readonly string[] = loadMappedCatalogNames()): {
  apis: string[];
  mapped: string[];
} {
  const mappedSet = new Set(mappedNames);
  const mapped = apis.filter((api) => mappedSet.has(api) || mappedSet.has(api.replace(/A$|W$/, "")));
  return { apis: [...apis], mapped };
}
