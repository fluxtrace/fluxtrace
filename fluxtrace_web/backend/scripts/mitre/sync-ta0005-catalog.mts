/**
 * On-demand MITRE TA0005 catalog sync from official Enterprise STIX.
 * Run: pnpm mitre:sync-catalog
 */
import { syncMitreCatalog } from "../../services/mitre/mitreCatalogSync";

const result = await syncMitreCatalog();
if (!result.ok) {
  console.error(result.message);
  process.exit(1);
}
console.log(
  `Catálogo TA0005 sincronizado: version=${result.version} syncedAt=${result.syncedAt} técnicas=${result.techniqueCount} added=${result.idDelta.added.length} removed=${result.idDelta.removed.length}`,
);
