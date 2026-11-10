/**
 * Origem da linha: runtime do Pin vs amostra vs sem evidência no .cdf.
 * Não apaga nada — só anota.
 *
 * Em TraceInstructions a Contradef grava `Call <call-site> -> <callee>`.
 * O *callee* (`ntdll.dll:RtlAllocateHeap`) não diz quem chamou.
 * Quem chamou está à esquerda de ` -> ` (`sample.exe:WinMain`).
 */

export type TraceOrigin = "pin-runtime" | "target" | "unknown";

export type OriginVerdict = {
  origin: TraceOrigin;
  image: string | null;
  evidence: string;
};

const NAMED_IMAGE =
  /(?:Nome da imagem|Nome do m[oó]dulo|Image(?:\s+name)?|IMG)\s*[:]\s*(.+?)\s*$/i;

const WIN_OR_UNIX_MODULE =
  /(?:[A-Za-z]:[\\/]|[\\/])[^\s:"']+\.(?:dll|exe|DLL|EXE)\b/g;

const LEAF_IMAGE = /(?:^|[\s>|])([A-Za-z0-9_\-]+\.(?:dll|exe|DLL|EXE))\b/g;

const PIN_IMAGE =
  /(?:^|[\\/\s])(?:pin(?:\.exe)?|pinvm(?:\.dll)?|pincrt(?:\.dll)?|pin_crt|pin-crt|xed(?:\.dll)?|contradef(?:64)?(?:\.dll)?)(?:$|[\\/\s.])/i;

const PIN_KIT = /pin-\d+\.|[\\/](?:ia32|intel64)[\\/]bin[\\/]/i;

const SYSTEM_CALLEE = new Set(
  [
    "kernel32",
    "kernelbase",
    "ntdll",
    "user32",
    "advapi32",
    "ucrtbase",
    "msvcrt",
    "sechost",
    "rpcrt4",
    "bcrypt",
    "ws2_32",
    "winhttp",
    "wininet",
    "ole32",
    "oleaut32",
    "gdi32",
    "combase",
    "shlwapi",
    "shell32",
    "crypt32",
    "iphlpapi",
    "psapi",
    "version",
    "imm32",
    "win32u",
    "msvcp140",
    "vcruntime140",
    "advapi32",
  ].map((n) => n.toLowerCase()),
);

function basenameModule(path: string): string {
  const leaf = path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? path;
  return leaf.replace(/\.(dll|exe)$/i, "").toLowerCase();
}

export function isPinRuntimeImage(path: string): boolean {
  if (!path) return false;
  return PIN_IMAGE.test(path) || PIN_KIT.test(path);
}

export function isSystemCalleeModule(path: string): boolean {
  return SYSTEM_CALLEE.has(basenameModule(path));
}

function extractNamedImage(line: string): string | null {
  const named = line.match(NAMED_IMAGE);
  if (named?.[1]) return named[1].trim();
  return null;
}

function isUnresolvedImage(path: string): boolean {
  return /unknow/i.test(path);
}

/** Lado esquerdo de ` -> ` numa linha Call/Tailcall da Contradef (o call site). */
export function callSiteSegment(line: string): string {
  if (!/^(?:\| )*(?:Call|Tailcall|PcMaterialization)\b/i.test(line.trimStart())) {
    return line;
  }
  const arrow = line.indexOf(" -> ");
  if (arrow < 0) return line;
  return line.slice(0, arrow);
}

function collectImages(text: string, skipColonExport: boolean): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const push = (path: string) => {
    if (!path || isUnresolvedImage(path) || seen.has(path)) return;
    seen.add(path);
    found.push(path);
  };

  WIN_OR_UNIX_MODULE.lastIndex = 0;
  for (const match of text.matchAll(WIN_OR_UNIX_MODULE)) {
    const path = match[0];
    const after = text.slice((match.index ?? 0) + path.length);
    if (skipColonExport && /^:[A-Za-z_]/.test(after)) continue;
    push(path);
  }

  LEAF_IMAGE.lastIndex = 0;
  for (const match of text.matchAll(LEAF_IMAGE)) {
    const path = match[1];
    if (!path) continue;
    const after = text.slice((match.index ?? 0) + match[0].length);
    if (skipColonExport && /^:[A-Za-z_]/.test(after)) continue;
    push(path);
  }
  return found;
}

/**
 * Imagens de quem executa / chama nesta linha.
 * Em `Call A -> B`, só A (call site). O export à direita é o callee.
 */
export function extractCallerImages(line: string): string[] {
  const site = callSiteSegment(line);
  if (site !== line) return collectImages(site, false);
  const instructionStyle = /\.(?:exe|dll):[A-Za-z_?]/i.test(line) && !/\sT\[\d+\]\s/.test(line);
  return collectImages(line, !instructionStyle);
}

function originFromImage(image: string): OriginVerdict | null {
  if (isUnresolvedImage(image)) {
    return { origin: "unknown", image, evidence: `unresolved-img:${image}` };
  }
  if (isPinRuntimeImage(image)) {
    return { origin: "pin-runtime", image, evidence: `pin-image:${image}` };
  }
  if (isSystemCalleeModule(image)) return null;
  return { origin: "target", image, evidence: `app-image:${image}` };
}

export function createOriginTracker(logType: string) {
  let currentImage: string | null = null;
  const hookLike = logType === "FunctionInterceptor" || logType === "TraceFcnCall";

  const classify = (line: string): OriginVerdict => {
    const named = extractNamedImage(line);
    if (named) currentImage = named;

    const callers = extractCallerImages(line);
    for (const path of callers) {
      if (!isSystemCalleeModule(path) && !isUnresolvedImage(path)) {
        if (hookLike) currentImage = path;
        const fromCaller = originFromImage(path);
        if (fromCaller) return fromCaller;
      }
    }

    if (hookLike && currentImage) {
      const fromCurrent = originFromImage(currentImage);
      if (fromCurrent) return fromCurrent;
    }

    if (isPinRuntimeImage(line)) {
      return { origin: "pin-runtime", image: currentImage, evidence: "pin-token-in-line" };
    }

    if (hookLike) {
      return {
        origin: "target",
        image: currentImage,
        evidence: currentImage ? `hook+image:${currentImage}` : "hook-default",
      };
    }

    return { origin: "unknown", image: hookLike ? currentImage : callers[0] ?? null, evidence: "unspecified" };
  };

  return {
    classify,
    currentImage: () => currentImage,
  };
}

export function isBehaviorOrigin(origin: TraceOrigin): boolean {
  return origin === "target";
}
