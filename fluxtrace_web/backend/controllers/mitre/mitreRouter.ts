import { TRPCError } from "@trpc/server";

import { getMitreCatalogStatus, syncMitreCatalog } from "../../services/mitre/mitreCatalogSync";
import { protectedProcedure, router } from "../../_core/trpc";

export const mitreRouter = router({
  catalogStatus: protectedProcedure.query(() => getMitreCatalogStatus()),

  /** On-demand STIX Enterprise sync. Not a polling loop — ATT&CK muda em releases. */
  syncCatalog: protectedProcedure.mutation(async () => {
    const result = await syncMitreCatalog();
    if (!result.ok) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: result.message });
    }
    return result;
  }),
});
