import { createDbClient } from "./plan";
import { runAdminPlan } from "./data.functions";

/**
 * Browser data client for the admin UI. Every query is executed server-side by
 * `runAdminPlan`, which checks the admin session first.
 */
export const db = createDbClient(async (plan) => {
  const res = await runAdminPlan({ data: { plan } });
  return { data: res.data, error: res.error, count: res.count };
});
