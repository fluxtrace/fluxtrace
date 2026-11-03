/**
 * Origem da linha: runtime do Pin vs amostra vs sem evidência no .cdf.
 * Não apaga nada — só anota. KERNEL32:Export é o *callee*, não o caller.
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

/** Caminhos de módulo na linha que NÃO são `DLL:Export` (callee). */
export function extractCallerImages(line: string): string[] {
  const found: string[] = [];
  WIN_OR_UNIX_MODULE.lastIndex = 0;
  for (const match of line.matchAll(WIN_OR_UNIX_MODULE)) {
    const path = match[0];
    const after = line.slice((match.index ?? 0) + path.length);
    if (/^:[A-Za-z_]/.test(after)) continue;
    found.push(path);
  }
  return found;
}

function originFromImage(image: string): OriginVerdict | null {
  if (isPinRuntimeImage(image)) {
    return { origin: "pin-runtime", image, evidence: `pin-image:${image}` };
  }
  if (isSystemCalleeModule(image)) return null;
  return { origin: "target", image, evidence: `app-image:${image}` };
}

export function createOriginTracker(logType: string) {
  let currentImage: string | null = null;

  const classify = (line: string): OriginVerdict => {
    const named = extractNamedImage(line);
    if (named) currentImage = named;

    for (const path of extractCallerImages(line)) {
      if (!isSystemCalleeModule(path)) currentImage = path;
    }

    if (currentImage) {
      const fromCurrent = originFromImage(currentImage);
      if (fromCurrent) return fromCurrent;
    }

    if (isPinRuntimeImage(line)) {
      return { origin: "pin-runtime", image: currentImage, evidence: "pin-token-in-line" };
    }

    const hookLike = logType === "FunctionInterceptor" || logType === "TraceFcnCall";
    if (hookLike) {
      return {
        origin: "target",
        image: currentImage,
        evidence: currentImage ? `hook+image:${currentImage}` : "hook-default",
      };
    }

    return { origin: "unknown", image: currentImage, evidence: "unspecified" };
  };

  return {
    classify,
    currentImage: () => currentImage,
  };
}

export function isBehaviorOrigin(origin: TraceOrigin): boolean {
  return origin === "target";
}
