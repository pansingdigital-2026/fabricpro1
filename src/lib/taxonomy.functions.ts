import { createServerFn } from "@tanstack/react-start";

import type { TaxonomySyncSummary } from "./taxonomy.server";

export const applyApprovedTaxonomy = createServerFn({ method: "POST" }).handler(
  async (): Promise<TaxonomySyncSummary> => {
    const { requireAdminSession } = await import("./auth.server");
    await requireAdminSession();
    const { syncApprovedTaxonomy } = await import("./taxonomy.server");
    return syncApprovedTaxonomy();
  },
);