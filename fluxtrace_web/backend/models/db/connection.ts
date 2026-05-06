import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { ENV } from "../../_core/config/env";
import { resolvePgSslForUrl } from "../../_core/postgres/pgSslInference";

function pgPoolConfigFromEnv(databaseUrl: string): pg.PoolConfig {
  const { ssl } = resolvePgSslForUrl(databaseUrl);
  return {
    connectionString: databaseUrl,
    max: 10,
    ssl,
  };
}

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = new pg.Pool(pgPoolConfigFromEnv(process.env.DATABASE_URL));
      _db = drizzle({ client: pool });
    } catch (error) {
      console.warn("[Database] Failed to initialize pool:", error);
      if (ENV.isProduction) {
        throw error;
      }
      _db = null;
    }
  }
  return _db;
}

/** Runs a trivial query when DATABASE_URL is set; fails fast on wrong credentials or network. */
export async function pingDatabaseIfConfigured(): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }
  await db.execute(sql`SELECT 1`);
}
