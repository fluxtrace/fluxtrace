/**
 * Exporta artefactos gerados pela ferramenta (relatórios, logs reduzidos JSON,
 * grafo, Mermaid) de CONTRADEF_WORK_TMP (default: {tmpdir}/contradef-tmp/analysis)
 * para resultados/artefatos/ no repo.
 *
 * Uso (a partir de fluxtrace_web/):
 *   npx tsx backend/scripts/export-batch-artifacts.mts
 *   npx tsx backend/scripts/export-batch-artifacts.mts ctr-JD-QvLcmsO
 *
 * Requer DATABASE_URL no .env para mapear batchId → sampleSha256.
 */
import "dotenv/config";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";

import { getContradefWorkTmpRoot } from "../_core/config/contradefPaths";
import { analysisBatches } from "../drizzle/schema/schema";
import { getDb } from "../models/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../../..");
const OUT_ROOT = join(REPO_ROOT, "resultados", "artefatos");

const REPORT_FILES = [
  "final-report.md",
  "flow-graph.json",
  "malware-flow-map.md",
  "reduced-logs.json",
] as const;

async function listBatchDirs(workRoot: string, onlyBatchId?: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(workRoot, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith("ctr-"))
    .map((e) => e.name)
    .filter((id) => !onlyBatchId || id === onlyBatchId);
}

async function main() {
  const onlyBatchId = process.argv[2]?.trim() || undefined;
  const workRoot = getContradefWorkTmpRoot();
  const db = await getDb();

  const batchIds = await listBatchDirs(workRoot, onlyBatchId);
  if (!batchIds.length) {
    console.error(`Nenhum lote ctr-* com pasta em ${workRoot}`);
    process.exit(1);
  }

  await mkdir(OUT_ROOT, { recursive: true });
  let exported = 0;

  for (const batchId of batchIds) {
    const reportsSrc = join(workRoot, batchId, "artifacts", "reports");
    let sampleSha256: string | null = null;
    let sampleName: string | null = null;
    let status: string | null = null;

    if (db) {
      const [row] = await db
        .select({
          sampleSha256: analysisBatches.sampleSha256,
          sampleName: analysisBatches.sampleName,
          status: analysisBatches.status,
        })
        .from(analysisBatches)
        .where(eq(analysisBatches.batchId, batchId))
        .limit(1);
      if (row) {
        sampleSha256 = row.sampleSha256?.trim() || null;
        sampleName = row.sampleName;
        status = row.status;
      }
    }

    const folderKey = sampleSha256 && sampleSha256.length === 64 ? sampleSha256 : batchId;
    const destDir = join(OUT_ROOT, folderKey);
    const destReports = join(destDir, "reports");
    await mkdir(destReports, { recursive: true });

    let copied = 0;
    for (const name of REPORT_FILES) {
      const src = join(reportsSrc, name);
      try {
        await cp(src, join(destReports, name));
        copied++;
      } catch {
        /* ficheiro opcional ausente */
      }
    }

    if (copied === 0) continue;

    const manifest = {
      batchId,
      sampleSha256,
      sampleName,
      status,
      exportedAt: new Date().toISOString(),
      sourcePath: reportsSrc,
      files: REPORT_FILES.filter((f) => copied > 0),
    };
    await writeFile(join(destDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
    console.log(`OK ${batchId} → resultados/artefatos/${folderKey}/ (${copied} ficheiros)`);
    exported++;
  }

  console.log(`\nExportados ${exported} lote(s) para ${OUT_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
