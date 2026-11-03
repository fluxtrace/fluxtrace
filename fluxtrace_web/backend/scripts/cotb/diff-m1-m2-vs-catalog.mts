/**
 * Cruza APIs em TraceFcnCall M1/M2 (índices oficiais A5) com pastas em FUNCOES_MAPEADAS.
 */
import "dotenv/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { compactTraceOriginFromIndexDocument } from "../../services/analysis/traceIndexArtifact";

const ARTIFACT_ROOT = process.env.COTB_ARTIFACT_ROOT?.trim() || "G:\\cotb-pin-100\\fluxtrace-artifacts";
const CATALOG = process.env.FUNCOES_MAPEADAS?.trim() || "D:\\MMB\\workspace\\fluxtrace\\funcoes-mapeadas";

function catalogNames(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[A-Za-z_][A-Za-z0-9_]*$/.test(e.name) && e.name !== "isdebuggerpresent_flow")
    .map((e) => basename(e.name));
}

function isM1orM2(fileName: string, logType: string) {
  const f = fileName.toLowerCase();
  const t = logType.toLowerCase();
  return t.includes("tracefcncall") || f.includes("tracefcncall") || f.includes(".m1.") || f.includes(".m2.");
}

const catalog = catalogNames(CATALOG);
const catalogSet = new Set(catalog);
const m1m2 = new Set<string>();
const interceptor = new Set<string>();
const hashes = existsSync(ARTIFACT_ROOT)
  ? readdirSync(ARTIFACT_ROOT).filter((n) => /^[a-f0-9]{64}$/i.test(n))
  : [];

for (const hash of hashes) {
  const indexPath = join(ARTIFACT_ROOT, hash, "trace-index.json");
  if (!existsSync(indexPath)) continue;
  const raw = JSON.parse(readFileSync(indexPath, "utf8")) as Record<string, unknown>;
  const origin = compactTraceOriginFromIndexDocument({
    observedApis: Array.isArray(raw.observedApis) ? raw.observedApis : undefined,
  });
  for (const row of origin.observedApis) {
    if (isM1orM2(row.fileName, row.logType)) m1m2.add(row.api);
    if (row.logType === "FunctionInterceptor" || row.fileName.toLowerCase().includes("functioninterceptor")) {
      interceptor.add(row.api);
    }
  }
}

const inLogNotCatalog = [...m1m2].filter((api) => !catalogSet.has(api)).sort();
const inCatalogNotM1M2 = catalog.filter((api) => !m1m2.has(api)).sort();
const overlap = catalog.filter((api) => m1m2.has(api)).sort();

console.log(`catalog_folders=${catalog.length}`);
console.log(`official_indexes=${hashes.length}`);
console.log(`unique_apis_m1_m2=${m1m2.size}`);
console.log(`unique_apis_interceptor=${interceptor.size}`);
console.log(`overlap_catalog_and_m1m2=${overlap.length}`);
console.log(`in_m1m2_not_catalog=${inLogNotCatalog.length}`);
console.log(`in_catalog_not_m1m2=${inCatalogNotM1M2.length}`);
console.log("--- m1/m2 não mapeadas ---");
console.log(inLogNotCatalog.join("\n") || "(nenhuma)");
console.log("--- catálogo sem ocorrência M1/M2 nesta campanha ---");
console.log(inCatalogNotM1M2.join("\n") || "(nenhuma)");
console.log("--- overlap ---");
console.log(overlap.join("\n"));
