/**
 * SERVER-ONLY database clients.
 *
 * The CMS talks to MySQL (Hostinger) through a small query-plan builder that
 * mirrors the API the project used previously, so callers are unchanged.
 */
import { createDbClient, type DbClient } from "./db/plan";
import { executePlan, isDatabaseConfigured } from "./db/mysql.server";

/** Read-only client for public (signed-out) SSR reads. */
export function getPublicServerClient(): DbClient {
  return createDbClient((plan) => executePlan(plan, { publicOnly: true }));
}

/** Full-access client. Only use after the caller has been verified. */
export function getAdminClient(): DbClient {
  return createDbClient((plan) => executePlan(plan));
}

export function isServerDatabaseConfigured(): boolean {
  return isDatabaseConfigured();
}

/** Backwards-compatible alias used by the health check. */
export const isServerSupabaseConfigured = isServerDatabaseConfigured;
