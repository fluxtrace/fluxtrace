import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Raízes de trabalho temporário da análise.
 *
 * Preferir sempre `CONTRADEF_WORK_TMP` / `CONTRADEF_REDUCE_LOGS_TMP` no `.env`
 * (volume dedicado com espaço suficiente para lotes multi-GB).
 * Sem essas variáveis, usa `{os.tmpdir()}/contradef-tmp/...` em **qualquer** SO
 * (incluindo Windows) — portável; não assume unidade `F:`.
 */

/** Raiz de trabalho da análise (7z, extração) — alinhada a artefactos em `artifactLocalStore`. */
export function getContradefWorkTmpRoot(): string {
  const fromEnv = process.env.CONTRADEF_WORK_TMP?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return join(tmpdir(), "contradef-tmp", "analysis");
}

/** Diretório temporário para upload multipart legado de logs (reduce-logs). */
export function getContradefReduceLogsTmpDir(): string {
  const fromEnv = process.env.CONTRADEF_REDUCE_LOGS_TMP?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return join(tmpdir(), "contradef-tmp", "reduce-logs");
}
