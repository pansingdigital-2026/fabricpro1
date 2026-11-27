import { createServerFn } from "@tanstack/react-start";

import { sanitizeHtml } from "../sanitize-html";
import type { QueryPlan } from "./plan";

function sanitizeRecordHtml(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...row };
  if (table === "content" && typeof copy["body_html"] === "string") {
    copy["body_html"] = sanitizeHtml(copy["body_html"]);
  }
  if (table === "pages" && Array.isArray(copy["sections"])) {
    copy["sections"] = copy["sections"].map((sec) => {
      if (!sec || typeof sec !== "object") return sec;
      const s = sec as Record<string, unknown>;
      const settings = s["settings"];
      if (settings && typeof settings === "object" && typeof (settings as Record<string, unknown>)["html"] === "string") {
        return {
          ...s,
          settings: {
            ...(settings as Record<string, unknown>),
            html: sanitizeHtml((settings as Record<string, unknown>)["html"] as string),
          },
        };
      }
      return sec;
    });
  }
  if (table === "homepage_sections" && copy["settings"] && typeof copy["settings"] === "object") {
    const settings = copy["settings"] as Record<string, unknown>;
    if (typeof settings["html"] === "string") {
      copy["settings"] = { ...settings, html: sanitizeHtml(settings["html"]) };
    }
  }
  return copy;
}

function sanitizePlan(plan: QueryPlan): QueryPlan {
  if (plan.op !== "insert" && plan.op !== "update" && plan.op !== "upsert") return plan;
  if (!plan.values) return plan;
  const values = Array.isArray(plan.values)
    ? plan.values.map((v) => sanitizeRecordHtml(plan.table, v))
    : sanitizeRecordHtml(plan.table, plan.values);
  return { ...plan, values };
}

export interface PlanResponse {
  // JSON-serialized rows; shaped by the caller's select.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: { message: string } | null;
  count: number | null;
}

/**
 * Authenticated data endpoint for the admin UI. MySQL cannot be reached from a
 * browser, so admin reads/writes travel as query plans through this function,
 * which verifies the session before executing anything.
 */
export const runAdminPlan = createServerFn({ method: "POST" })
  .inputValidator((input: { plan: QueryPlan }) => {
    if (!input?.plan?.table || !input.plan.op) throw new Error("Invalid query");
    return input;
  })
  .handler(async ({ data }): Promise<PlanResponse> => {
    const { requireSession } = await import("../auth.server");
    const { executePlan } = await import("./mysql.server");
    try {
      await requireSession();
    } catch {
      return { data: null, error: { message: "Unauthorized" }, count: null };
    }
    const result = await executePlan(sanitizePlan(data.plan));
    return JSON.parse(JSON.stringify(result)) as PlanResponse;
  });
