/**
 * Migração idempotente job → batch (enum, tabela analysisJobs, colunas jobId).
 * Seguro se já migrou ou se o esquema veio do Drizzle (`batch_status`, `analysisBatches`).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";
import { resolvePgSslForUrl } from "../../_core/postgres/pgSslInference";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const envPath = path.join(__dirname, "..", "..", "..", ".env");
let url = process.env.DATABASE_URL?.trim();
if (!url && fs.existsSync(envPath)) {
  const line = fs.readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (line) url = line.slice("DATABASE_URL=".length).trim();
}

if (!url) {
  console.error("Defina DATABASE_URL (ou crie .env na pasta fluxtrace_web).");
  process.exit(1);
}

const databaseUrl = url;
const { ssl, reason } = resolvePgSslForUrl(databaseUrl);
console.log(`[migrate] SSL: ${ssl ? "ligado" : "desligado"} (${reason})`);

function pgPoolConfig(databaseUrl: string): pg.PoolConfig {
  return {
    connectionString: databaseUrl,
    max: 2,
    ssl,
    connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS ?? 60000),
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  };
}

async function pgEnumExists(client: pg.PoolClient, name: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM pg_type t
     INNER JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = $1 AND t.typtype = 'e' LIMIT 1`,
    [name],
  );
  return r.rows.length > 0;
}

async function pgTableExists(client: pg.PoolClient, relname: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM pg_class c
     INNER JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = $1 LIMIT 1`,
    [relname],
  );
  return r.rows.length > 0;
}

async function pgColumnExists(client: pg.PoolClient, table: string, column: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM pg_attribute a
     INNER JOIN pg_class c ON c.oid = a.attrelid
     INNER JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1 AND a.attname = $2 AND a.attnum > 0 AND NOT a.attisdropped
     LIMIT 1`,
    [table, column],
  );
  return r.rows.length > 0;
}

async function migrateIdempotent(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  let changes = 0;
  try {
    await client.query("BEGIN");

    const hasJobStatus = await pgEnumExists(client, "job_status");
    const hasBatchStatus = await pgEnumExists(client, "batch_status");

    if (hasJobStatus && hasBatchStatus) {
      await client.query("ROLLBACK");
      throw new Error('Estado inválido: enums "job_status" e "batch_status" coexistem; intervenção manual.');
    }
    if (hasJobStatus && !hasBatchStatus) {
      await client.query(`ALTER TYPE "job_status" RENAME TO "batch_status"`);
      console.log('[migrate] ALTER TYPE "job_status" → "batch_status"');
      changes++;
    } else if (!hasJobStatus && hasBatchStatus) {
      console.log('[migrate] Enum "batch_status" já existe — passo enum ignorado.');
    } else if (!hasJobStatus && !hasBatchStatus) {
      console.log('[migrate] Nenhum enum job_status/batch_status em public — passo enum ignorado.');
    }

    const hasJobsTbl = await pgTableExists(client, "analysisJobs");
    const hasBatchesTbl = await pgTableExists(client, "analysisBatches");

    if (hasJobsTbl && hasBatchesTbl) {
      await client.query("ROLLBACK");
      throw new Error('Tabelas "analysisJobs" e "analysisBatches" coexistem — resolva manualmente.');
    }
    if (hasJobsTbl && !hasBatchesTbl) {
      await client.query(`ALTER TABLE "analysisJobs" RENAME TO "analysisBatches"`);
      console.log('[migrate] ALTER TABLE "analysisJobs" → "analysisBatches"');
      changes++;
    } else if (!hasJobsTbl && hasBatchesTbl) {
      console.log('[migrate] Tabela "analysisBatches" já existe — passo rename ignorado.');
    }

    if (await pgTableExists(client, "analysisBatches")) {
      const batchColRenames: [string, string][] = [
        ["jobId", "batchId"],
        ["pipelineJobId", "pipelineBatchRef"],
        ["pipelineJobPath", "pipelineExternalPath"],
      ];
      for (const [from, to] of batchColRenames) {
        const hasFrom = await pgColumnExists(client, "analysisBatches", from);
        const hasTo = await pgColumnExists(client, "analysisBatches", to);
        if (hasFrom && !hasTo) {
          await client.query(`ALTER TABLE "analysisBatches" RENAME COLUMN "${from}" TO "${to}"`);
          console.log(`[migrate] analysisBatches."${from}" → "${to}"`);
          changes++;
        }
      }
    }

    const childTables = ["analysisEvents", "analysisArtifacts", "analysisInsights", "analysisCommits"] as const;
    for (const tbl of childTables) {
      if (!(await pgTableExists(client, tbl))) continue;
      const hasJobId = await pgColumnExists(client, tbl, "jobId");
      const hasBatchId = await pgColumnExists(client, tbl, "batchId");
      if (hasJobId && !hasBatchId) {
        await client.query(`ALTER TABLE "${tbl}" RENAME COLUMN "jobId" TO "batchId"`);
        console.log(`[migrate] ${tbl}."jobId" → "batchId"`);
        changes++;
      }
    }

    await client.query("COMMIT");

    if (changes === 0) {
      console.log("[migrate] Nenhuma alteração necessária — esquema já está alinhado (lotes / batch).");
    } else {
      console.log(`[migrate] Concluído com ${changes} alteração(ões).`);
    }
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

const RETRYABLE = new Set(["ECONNRESET", "ETIMEDOUT", "EPIPE", "ECONNREFUSED"]);
const MAX_ATTEMPTS = 4;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const pool = new pg.Pool(pgPoolConfig(databaseUrl));
    try {
      await migrateIdempotent(pool);
      await pool.end();
      return;
    } catch (e) {
      lastErr = e;
      await pool.end().catch(() => {});
      const code = e && typeof e === "object" && "code" in e ? String((e as NodeJS.ErrnoException).code) : "";
      const retriable = RETRYABLE.has(code) || /ECONNRESET|timeout/i.test(String((e as Error).message));
      if (attempt < MAX_ATTEMPTS && retriable) {
        const wait = 800 * attempt;
        console.warn(`[migrate] tentativa ${attempt}/${MAX_ATTEMPTS} falhou (${(e as Error).message}). Nova tentativa em ${wait}ms…`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

main().catch((e: Error) => {
  console.error("Falha na migração:", e.message);
  console.error(
    "\nDicas:\n" +
      "  • Postgres na Render: URL externo + SSL (hostname .render.com activa TLS neste script).\n" +
      "  • Esquema novo só com Drizzle: este comando deve terminar sem alterações — use npm run db:push se faltar tabelas.\n",
  );
  process.exitCode = 1;
});
