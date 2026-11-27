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

export const Route = createFileRoute("/api/public/agent/updates/ready")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const { verifyBearerKey } = await import("@/lib/agent/auth");
        const auth = verifyBearerKey(request, "UPDATE_FINALIZE_API_KEY");
        if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

        const { getSiteBaseUrl, recordAutomationEvent } = await import("@/lib/agent/events.server");
        const idempotencyKey = request.headers.get("idempotency-key")?.trim() || undefined;

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          await recordAutomationEvent({
            step: "mark_ready",
            outcome: "error",
            errorMessage: "Request body must be valid JSON.",
            idempotencyKey: idempotencyKey ?? null,
          });
          return jsonResponse({ error: "Request body must be valid JSON." }, 400);
        }

        const { finalizeUpdateSchema } = await import("@/lib/agent/schema");
        const parsed = finalizeUpdateSchema.safeParse(rawBody);
        if (!parsed.success) {
          const details = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
          await recordAutomationEvent({
            step: "mark_ready",
            outcome: "error",
            errorMessage: `Invalid finalize payload: ${details.join("; ")}`,
            idempotencyKey: idempotencyKey ?? null,
          });
          return jsonResponse({ error: "Invalid finalize payload.", details }, 400);
        }

        try {
          const baseUrl = await getSiteBaseUrl(request);
          const { finalizeUpdateDraft } = await import("@/lib/agent/updates.server");
          const result = await finalizeUpdateDraft(parsed.data, baseUrl, idempotencyKey);
          await recordAutomationEvent({
            step: "mark_ready",
            outcome: result.reused ? "reused" : "success",
            draftId: result.draftId,
            mediaId: parsed.data.mediaId,
            title: result.title,
            resultState: result.state,
            resultUrl: "liveUrl" in result ? result.liveUrl : result.adminUrl,
            idempotencyKey: idempotencyKey ?? parsed.data.idempotencyKey ?? null,
          });
          return jsonResponse({ ok: true, ...result }, 200);
        } catch (err) {
          const apiErr = err as { status?: number; extra?: Record<string, unknown> };
          const status = typeof apiErr.status === "number" ? apiErr.status : 500;
          const message = err instanceof Error ? err.message : "Failed to finalize update.";
          await recordAutomationEvent({
            step: "mark_ready",
            outcome: "error",
            draftId: parsed.data.draftId,
            mediaId: parsed.data.mediaId,
            errorMessage: message,
            idempotencyKey: idempotencyKey ?? parsed.data.idempotencyKey ?? null,
          });
          return jsonResponse({ error: message, ...(apiErr.extra ?? {}) }, status);
        }
      },
    },
  },
});