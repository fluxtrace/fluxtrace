import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { analysisEvents, analysisBatches } from "../../drizzle/schema";
import { getDb } from "../../models/db";

const batchId = process.argv[2] ?? "";
if (!/^ctr-[A-Za-z0-9_-]+$/.test(batchId)) {
  console.error("Usage: npx tsx backend/scripts/db/query-batch-once.mts ctr-...");
  process.exit(1);
}

const db = await getDb();
if (!db) {
  console.log(JSON.stringify({ error: "no_database", hint: "DATABASE_URL not configured or pool failed" }));
  process.exit(0);
}

const [batchRecord] = await db.select().from(analysisBatches).where(eq(analysisBatches.batchId, batchId)).limit(1);
const events = batchRecord
  ? await db.select().from(analysisEvents).where(eq(analysisEvents.batchId, batchId)).orderBy(desc(analysisEvents.id)).limit(10)
  : [];

const ser = (v: unknown) =>
  JSON.stringify(
    v,
    (_k, val) => (val instanceof Date ? val.toISOString() : val),
    2,
  );

console.log(ser({ batch: batchRecord ?? null, lastEvents: events }));
