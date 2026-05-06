import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const WIN_WORK_ROOT = join("E:\\", "contradef-tmp", "analysis");

function preferredArtifactRoot() {
  return process.platform === "win32" ? WIN_WORK_ROOT : join(tmpdir(), "contradef-analysis");
}

export function jobArtifactsDirectory(batchId: string) {
  return resolve(join(preferredArtifactRoot(), batchId, "artifacts"));
}

/** Remove a pasta de trabalho local do lote (artefactos, etc.); best-effort. */
export async function removeLocalBatchWorkspace(batchId: string) {
  if (!/^ctr-[A-Za-z0-9_-]+$/.test(batchId)) {
    return;
  }
  const safeRoot = resolve(join(preferredArtifactRoot(), batchId));
  await rm(safeRoot, { recursive: true, force: true });
}

export function assertSafeRelativeArtifactPath(relativePath: string) {
  if (!relativePath || relativePath.trim() !== relativePath) {
    throw new Error("Caminho de artefato inválido.");
  }
  if (relativePath.includes("..") || relativePath.startsWith("/") || relativePath.startsWith("\\")) {
    throw new Error("Caminho de artefato não pode conter segmentos '..'.");
  }
}

export function resolveLocalArtifactPath(batchId: string, relativePath: string) {
  assertSafeRelativeArtifactPath(relativePath);
  const root = jobArtifactsDirectory(batchId);
  const target = normalize(join(root, ...relativePath.split(/[/\\]/)));
  if (!target.startsWith(root)) {
    throw new Error("Caminho de artefato fora do diretório do lote.");
  }
  return target;
}

export async function localArtifactExists(batchId: string, relativePath: string) {
  try {
    await access(resolveLocalArtifactPath(batchId, relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function persistBatchArtifactBuffer(batchId: string, relativePath: string, buffer: Buffer) {
  const target = resolveLocalArtifactPath(batchId, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buffer);
}

export async function copyTempFileToLocalArtifact(batchId: string, relativePath: string, tempFilePath: string) {
  const target = resolveLocalArtifactPath(batchId, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await pipeline(createReadStream(tempFilePath), createWriteStream(target));
}

export async function localArtifactByteSize(batchId: string, relativePath: string) {
  const st = await stat(resolveLocalArtifactPath(batchId, relativePath));
  return st.size;
}
