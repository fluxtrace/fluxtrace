/**
 * Importa G:\cotb-pin-100\fluxtrace-artifacts para lotes da UI (dashboard / Interpretação).
 * Não volta a ler os .cdf. Idempotente (salta batchId já existente).
 *
 *   cd fluxtrace_web
 *   pnpm cotb:import-ui
 *   pnpm cotb:import-ui -- --force
 */
import "dotenv/config";

import { importOfficialCampaign } from "../../services/analysis/importOfficialCampaign";

const force = process.argv.includes("--force");
const result = await importOfficialCampaign({ createdByUserId: 1, force });
console.log(
  `Campanha oficial → UI  imported=${result.imported} updated=${result.updated} skipped=${result.skipped} failed=${result.failed.length}`,
);
if (result.failed.length) {
  for (const row of result.failed) console.error(`  ${row}`);
  process.exit(1);
}
