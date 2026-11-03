import "dotenv/config";
import { readdirSync, existsSync } from "node:fs";
import { basename } from "node:path";

import { getDb } from "../../models/db/connection";
import { analysisInsights } from "../../drizzle/schema/schema";

const CATALOG = process.env.FUNCOES_MAPEADAS?.trim() || "D:\\MMB\\workspace\\fluxtrace\\funcoes-mapeadas";

function catalogNames(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[A-Za-z_][A-Za-z0-9_]*$/.test(e.name) && e.name !== "isdebuggerpresent_flow")
    .map((e) => basename(e.name));
}

function isM1orM2(fileName: string, logType: string) {
  const f = (fileName ?? "").toLowerCase();
  const t = (logType ?? "").toLowerCase();
  return t.includes("tracefcncall") || f.includes("tracefcncall") || f.includes(".m1.") || f.includes(".m2.");
}

const db = await getDb();
if (!db) {
  console.error("sem postgres");
  process.exit(1);
}

const rows = await db.select({ batchId: analysisInsights.batchId, summaryJson: analysisInsights.summaryJson }).from(analysisInsights);
const catalog = catalogNames(CATALOG);
const catalogSet = new Set(catalog);
const m1m2 = new Set<string>();
const interceptor = new Set<string>();
const allObserved = new Set<string>();
let batches = 0;

for (const row of rows) {
  const json = row.summaryJson && typeof row.summaryJson === "object" && !Array.isArray(row.summaryJson)
    ? (row.summaryJson as Record<string, unknown>)
    : {};
  const origin = json.traceOrigin && typeof json.traceOrigin === "object" ? (json.traceOrigin as Record<string, unknown>) : {};
  const observed = Array.isArray(origin.observedApis) ? origin.observedApis : [];
  if (!observed.length) continue;
  batches += 1;
  for (const item of observed) {
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const api = typeof rec.api === "string" ? rec.api : "";
    if (!api) continue;
    allObserved.add(api);
    const fileName = typeof rec.fileName === "string" ? rec.fileName : "";
    const logType = typeof rec.logType === "string" ? rec.logType : "";
    if (isM1orM2(fileName, logType)) m1m2.add(api);
    if (logType === "FunctionInterceptor" || fileName.toLowerCase().includes("functioninterceptor")) interceptor.add(api);
  }
}

const inLogNotCatalog = [...m1m2].filter((api) => !catalogSet.has(api)).sort();
const inCatalogNotM1M2 = catalog.filter((api) => !m1m2.has(api)).sort();
const overlap = catalog.filter((api) => m1m2.has(api)).sort();

console.log(`catalog=${catalog.length} batches_with_origin=${batches} unique_observed=${allObserved.size}`);
console.log(`first_seen_as_m1m2=${m1m2.size} first_seen_as_interceptor=${interceptor.size}`);
console.log(`overlap=${overlap.length} m1m2_not_catalog=${inLogNotCatalog.length} catalog_not_firstseen_m1m2=${inCatalogNotM1M2.length}`);
console.log("--- m1/m2 (1ª ocorrência) fora do catálogo ---");
console.log(inLogNotCatalog.join("\n") || "(nenhuma)");
console.log("--- catálogo sem 1ª ocorrência em M1/M2 ---");
console.log(inCatalogNotM1M2.join("\n") || "(nenhuma)");
console.log("--- overlap ---");
console.log(overlap.join("\n"));
process.exit(0);
