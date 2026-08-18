/**
 * Pré-verifica PostgreSQL e aplica o schema (drizzle-kit push).
 * O drizzle-kit 0.31 frequentemente termina com exit 1 em «Pulling schema…»
 * sem imprimir ECONNREFUSED / 3D000 / 28P01 — este wrapper mostra a causa.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { normalizePostgresUrlForSslIfNeeded } from "../../_core/postgres/pgConnectionUrl";
import { resolvePgSslForUrl } from "../../_core/postgres/pgSslInference";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const fluxtraceWebRoot = path.resolve(scriptDir, "../../..");
loadEnv({ path: path.join(fluxtraceWebRoot, ".env"), override: true });

const PLACEHOLDER = /SEU-USUARIO|SUA_SENHA|SUA-SENHA|seu-email@exemplo/i;

function fail(message: string, extra?: string): never {
  console.error(`\n[db:push] ${message}`);
  if (extra) {
    console.error(extra);
  }
  console.error(`
Checklist (Windows / avaliadores CTA):
  1. Serviço PostgreSQL a correr (serviços: postgresql-x64-…, ou Docker Desktop).
  2. Ficheiro fluxtrace_web/.env (NÃO backend/.env) com DATABASE_URL real —
     substitua SEU-USUARIO / SUA_SENHA do .env.example. Utilizador típico do
     instalador EDB: postgres. Use 127.0.0.1 (não localhost) se IPv6 falhar.
  3. A base na URL tem de existir, p.ex. fluxtrace_dev:
       CREATE DATABASE fluxtrace_dev;
     (pgAdmin, ou psql -U postgres). Este script tenta criá-la se a ligação
     ao servidor funcionar mas a base ainda não existir.
  4. Porta 5432 livre e igual à da URL.
Detalhes: fluxtrace_web/docs/MANUAL-DEV-LOCAL.md §0.6 / §6.
`);
  process.exit(1);
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/i, "https:"));
    if (u.password) {
      u.password = "***";
    }
    return u.toString().replace(/^https:/, "postgresql:");
  } catch {
    return "(URL inválida)";
  }
}

function parseDbName(url: string): string | undefined {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/i, "https:"));
    return decodeURIComponent(u.pathname.replace(/^\//, "").split("/")[0] ?? "").trim() || undefined;
  } catch {
    return undefined;
  }
}

function adminUrlForCreate(url: string): string {
  const u = new URL(url.replace(/^postgres(ql)?:/i, "https:"));
  u.pathname = "/postgres";
  return u.toString().replace(/^https:/, "postgresql:");
}

function poolFor(url: string): pg.Pool {
  const { ssl } = resolvePgSslForUrl(url);
  return new pg.Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 8_000,
    ssl,
  });
}

async function ping(url: string): Promise<{ ok: true } | { ok: false; code?: string; message: string }> {
  const pool = poolFor(url);
  try {
    await pool.query("SELECT 1");
    return { ok: true };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { ok: false, code: e.code, message: e.message ?? String(err) };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function ensureDatabase(appUrl: string, dbName: string): Promise<void> {
  const admin = normalizePostgresUrlForSslIfNeeded(adminUrlForCreate(appUrl)) || adminUrlForCreate(appUrl);
  const pool = poolFor(admin);
  try {
    const existing = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (existing.rowCount) {
      return;
    }
    const safe = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName);
    if (!safe) {
      fail(
        `O nome da base «${dbName}» não é um identificador SQL simples.`,
        "Crie a base no pgAdmin ou altere DATABASE_URL para um nome como fluxtrace_dev.",
      );
    }
    console.log(`[db:push] Base «${dbName}» não existe — a criar…`);
    await pool.query(`CREATE DATABASE ${dbName}`);
    console.log(`[db:push] Base «${dbName}» criada.`);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    fail(
      `Não foi possível criar a base «${dbName}».`,
      `${e.code ?? "erro"}: ${e.message ?? err}\nCrie-a no pgAdmin (Databases → Create) e volte a correr pnpm db:push.`,
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function explainPg(code: string | undefined, message: string): string {
  if (code === "ECONNREFUSED" || /ECONNREFUSED/i.test(message)) {
    return "PostgreSQL não está a aceitar ligações (serviço parado ou porta errada).";
  }
  if (code === "ENOTFOUND" || /getaddrinfo/i.test(message)) {
    return "Hostname da DATABASE_URL não resolve. Prefira 127.0.0.1 em vez de localhost.";
  }
  if (code === "28P01" || /password authentication failed/i.test(message)) {
    return "Utilizador ou palavra-passe incorrectos. No instalador EDB o superuser é normalmente «postgres».";
  }
  if (code === "3D000" || /database .* does not exist/i.test(message)) {
    return "A base indicada na URL ainda não existe.";
  }
  if (code === "ETIMEDOUT" || /timeout/i.test(message)) {
    return "Timeout a ligar ao Postgres (firewall, host remoto, ou SSL em falta).";
  }
  return message;
}

const raw = process.env.DATABASE_URL?.trim();
if (!raw) {
  fail(
    "DATABASE_URL em falta.",
    "Copie backend/.env.example para fluxtrace_web/.env e preencha a URL do Postgres.",
  );
}
if (PLACEHOLDER.test(raw)) {
  fail(
    "DATABASE_URL ainda tem placeholders (SEU-USUARIO / SUA_SENHA).",
    `Valor actual (redigido): ${redactUrl(raw)}\nExemplo: postgresql://postgres:SUA_SENHA_REAL@127.0.0.1:5432/fluxtrace_dev`,
  );
}

const connectionString = normalizePostgresUrlForSslIfNeeded(raw);
if (!connectionString) {
  fail("DATABASE_URL inválida após normalização SSL.");
}

const dbName = parseDbName(connectionString);
console.log(`[db:push] A verificar ligação: ${redactUrl(connectionString)}`);

let probe = await ping(connectionString);
if (!probe.ok && (probe.code === "3D000" || /database .* does not exist/i.test(probe.message)) && dbName) {
  await ensureDatabase(connectionString, dbName);
  probe = await ping(connectionString);
}

if (!probe.ok) {
  fail(explainPg(probe.code, probe.message), `${probe.code ?? "erro"}: ${probe.message}`);
}

console.log("[db:push] PostgreSQL OK — a aplicar schema (drizzle-kit push)…\n");

const drizzleArgs = [
  "drizzle-kit",
  "push",
  "--config",
  path.join(fluxtraceWebRoot, "backend", "drizzle.config.ts"),
  ...process.argv.slice(2),
];

const child = spawn("pnpm", ["exec", ...drizzleArgs], {
  cwd: fluxtraceWebRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

const code: number = await new Promise((resolve) => {
  child.on("error", (err) => {
    console.error("[db:push] Falha ao lançar drizzle-kit:", err.message);
    resolve(1);
  });
  child.on("close", (exit) => resolve(exit ?? 1));
});

if (code !== 0) {
  fail(
    `drizzle-kit push saiu com código ${code}.`,
    "Se a mensagem acima ficou só em «Pulling schema from database…», a causa já foi a ligação (veja o checklist). Caso contrário, copie o texto completo do terminal.",
  );
}

console.log("\n[db:push] Schema aplicado.");
