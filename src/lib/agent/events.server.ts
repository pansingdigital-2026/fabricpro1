import { getAdminClient } from "@/lib/db.server";
import type { NewsAutomationSettings } from "@/lib/types";

export interface RecordEventInput {
  step: "upload_article" | "upload_image" | "mark_ready" | "direct_update";
  outcome: "success" | "error" | "reused";
  draftId?: string | null;
  mediaId?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
  resultState?: string | null;
  resultUrl?: string | null;
  errorMessage?: string | null;
  idempotencyKey?: string | null;
  details?: Record<string, unknown> | null;
}

/** Read Admin → News Automation → Automatically publish completed Updates (defaults to Off). */
export async function isAutoPublishEnabled(): Promise<boolean> {
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("site_settings")
      .select("value")
      .eq("key", "news_automation")
      .maybeSingle();
    const val = (data as { value?: Partial<NewsAutomationSettings> } | null)?.value;
    return val?.autoPublish === true;
  } catch {
    return false;
  }
}

/** Resolve the public site base URL (e.g. https://fabric-pro.com) without a trailing slash. */
export async function getSiteBaseUrl(request?: Request): Promise<string> {
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("site_settings")
      .select("value")
      .eq("key", "general")
      .maybeSingle();
    const configured = (data as { value?: { siteUrl?: string } } | null)?.value?.siteUrl?.trim();
    if (configured && /^https?:\/\//i.test(configured)) {
      return configured.replace(/\/+$/, "");
    }
  } catch {
    /* fall back to request origin */
  }
  if (request) {
    try {
      return new URL(request.url).origin.replace(/\/+$/, "");
    } catch {
      /* ignore */
    }
  }
  return "https://fabric-pro.com";
}

/** Persist an automation event for Admin → News Automation. Never throws so uploads stay reliable. */
export async function recordAutomationEvent(input: RecordEventInput): Promise<void> {
  try {
    const db = getAdminClient();
    await db.from("automation_events").insert({
      step: input.step,
      outcome: input.outcome,
      draft_id: input.draftId ?? null,
      media_id: input.mediaId ?? null,
      title: input.title ? input.title.slice(0, 255) : null,
      source_url: input.sourceUrl ?? null,
      result_state: input.resultState ?? null,
      result_url: input.resultUrl ?? null,
      error_message: input.errorMessage ? input.errorMessage.slice(0, 1000) : null,
      idempotency_key: input.idempotencyKey ? input.idempotencyKey.slice(0, 190) : null,
      details: input.details ?? null,
    });
  } catch {
    /* logging must not block API responses */
  }
}