/**
 * Runs the same backlog sync as admin `fluxosSpreadsheet.syncBacklog`:
 * mkdir under legacy_artifacts/<funcao>/, minimal Markdown+Mermaid when missing,
 * backfill spreadsheet URLs when blank.
 *
 * Execute from fluxtrace_web: `pnpm exec tsx backend/scripts/db/sync-legacy-backlog.mts`
 * (cwd must be fluxtrace_web; opcional: FUNCOES_MAPEADAS apontando para pasta dos artefactos).
 */
import { syncLegacySpreadsheetBacklog } from "../../controllers/analysis/routes/legacyArtifactsRouter";

void syncLegacySpreadsheetBacklog()
  .then(r => {
    console.log(`OK: ${r.count} row(s)`);
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
