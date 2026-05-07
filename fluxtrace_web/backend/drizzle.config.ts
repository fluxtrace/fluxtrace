import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";
import { normalizePostgresUrlForSslIfNeeded } from "./_core/postgres/pgConnectionUrl";

const configDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(configDir, "..", ".env"), override: true });

const connectionString = normalizePostgresUrlForSslIfNeeded(process.env.DATABASE_URL);
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

/** Caminhos com `/` para o drizzle-kit no Windows (glob/resolução falham com `\`). */
function posixPathFromParts(...parts: string[]) {
  return path.join(...parts).split(path.sep).join("/");
}

export default defineConfig({
  schema: posixPathFromParts(configDir, "drizzle", "schema", "index.ts"),
  out: posixPathFromParts(configDir, "drizzle", "migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
