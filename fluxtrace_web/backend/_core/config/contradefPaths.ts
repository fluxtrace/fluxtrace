import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Volume por defeito no Windows para pastas `contradef-tmp/*` quando
 * `CONTRADEF_WORK_TMP` / `CONTRADEF_REDUCE_LOGS_TMP` não estão definidas.
 * Sobrepõe sempre com caminhos absolutos no `.env`.
 */
const WIN_DEFAULT_VOLUME = "F:\\";

/** Raiz de trabalho da análise (7z, extração) — alinhada a artefactos em `artifactLocalStore`. */
export function getContradefWorkTmpRoot(): string {
  const fromEnv = process.env.CONTRADEF_WORK_TMP?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (process.platform === "win32") {
    return join(WIN_DEFAULT_VOLUME, "contradef-tmp", "analysis");
  }
  return join(tmpdir(), "contradef-tmp", "analysis");
}

/** Diretório temporário para upload multipart legado de logs (reduce-logs). */
export function getContradefReduceLogsTmpDir(): string {
  const fromEnv = process.env.CONTRADEF_REDUCE_LOGS_TMP?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (process.platform === "win32") {
    return join(WIN_DEFAULT_VOLUME, "contradef-tmp", "reduce-logs");
  }
  return join(tmpdir(), "contradef-tmp", "reduce-logs");
}
