import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type, Idempotency-Key",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/agent/updates/article")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const { verifyBearerKey } = await import("@/lib/agent/auth");
        const auth = verifyBearerKey(request, "UPDATE_ARTICLE_API_KEY");
        if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

        const { recordAutomationEvent } = await import("@/lib/agent/events.server");
        const idempotencyKey = request.headers.get("idempotency-key")?.trim() || undefined;

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          await recordAutomationEvent({
            step: "upload_article",
            outcome: "error",
            errorMessage: "Request body must be valid JSON.",
            idempotencyKey: idempotencyKey ?? null,
          });
          return jsonResponse({ error: "Request body must be valid JSON." }, 400);
        }

        const { uploadArticleSchema } = await import("@/lib/agent/schema");
        const parsed = uploadArticleSchema.safeParse(rawBody);
        if (!parsed.success) {
          const details = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
          await recordAutomationEvent({
            step: "upload_article",
            outcome: "error",
            errorMessage: `Invalid article payload: ${details.join("; ")}`,
            idempotencyKey: idempotencyKey ?? null,
          });
          return jsonResponse({ error: "Invalid article payload.", details }, 400);
        }

        try {
          const { createUpdateDraft } = await import("@/lib/agent/updates.server");
          const created = await createUpdateDraft(parsed.data, idempotencyKey);
          await recordAutomationEvent({
            step: "upload_article",
            outcome: created.reused ? "reused" : "success",
            draftId: created.draftId,
            title: created.title,
            sourceUrl: parsed.data.sourceUrl,
            resultState: "Draft created",
            idempotencyKey: idempotencyKey ?? parsed.data.idempotencyKey ?? null,
          });
          return jsonResponse({ ok: true, ...created }, created.reused ? 200 : 201);
        } catch (err) {
          const apiErr = err as { status?: number; extra?: Record<string, unknown> };
          const status = typeof apiErr.status === "number" ? apiErr.status : 500;
          const message = err instanceof Error ? err.message : "Failed to create draft.";
          await recordAutomationEvent({
            step: "upload_article",
            outcome: "error",
            title: parsed.data.title,
            sourceUrl: parsed.data.sourceUrl,
            errorMessage: message,
            idempotencyKey: idempotencyKey ?? parsed.data.idempotencyKey ?? null,
          });
          return jsonResponse({ error: message, ...(apiErr.extra ?? {}) }, status);
        }
      },
    },
  },
});