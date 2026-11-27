import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type, Idempotency-Key",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/agent/updates")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const { verifyAgentAuth } = await import("@/lib/agent/auth");
        const auth = verifyAgentAuth(request);
        if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

        const url = new URL(request.url);
        const rawLimit = Number(url.searchParams.get("limit") ?? "20");
        const limit = Number.isFinite(rawLimit) ? rawLimit : 20;

        try {
          const { listRecentUpdates } = await import("@/lib/agent/updates.server");
          const updates = await listRecentUpdates(limit);
          return jsonResponse({ updates });
        } catch (err) {
          const status = (err as { status?: number }).status ?? 500;
          return jsonResponse({ error: err instanceof Error ? err.message : "Failed to list updates." }, status);
        }
      },

      POST: async ({ request }) => {
        const { verifyAgentAuth } = await import("@/lib/agent/auth");
        const auth = verifyAgentAuth(request);
        if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

        const { getSiteBaseUrl, recordAutomationEvent } = await import("@/lib/agent/events.server");
        const idempotencyKey = request.headers.get("idempotency-key")?.trim() || undefined;

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return jsonResponse({ error: "Request body must be valid JSON." }, 400);
        }

        const { publishUpdateSchema } = await import("@/lib/agent/schema");
        const parsed = publishUpdateSchema.safeParse(rawBody);
        if (!parsed.success) {
          return jsonResponse(
            {
              error: "Invalid article payload.",
              details: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
            },
            400,
          );
        }

        try {
          const { publishAgentUpdate } = await import("@/lib/agent/updates.server");
          const baseUrl = await getSiteBaseUrl(request);
          const created = await publishAgentUpdate(parsed.data, baseUrl, idempotencyKey);
          await recordAutomationEvent({
            step: "direct_update",
            outcome: created.reused ? "reused" : "success",
            draftId: created.id,
            title: created.title,
            sourceUrl: parsed.data.sourceUrl,
            resultState: created.state,
            resultUrl: "liveUrl" in created ? created.liveUrl : created.adminUrl,
            idempotencyKey: idempotencyKey ?? parsed.data.idempotencyKey ?? null,
          });
          return jsonResponse({ ok: true, article: created }, created.reused ? 200 : 201);
        } catch (err) {
          const apiErr = err as { status?: number; extra?: Record<string, unknown> };
          const status = typeof apiErr.status === "number" ? apiErr.status : 500;
          const message = err instanceof Error ? err.message : "Failed to publish update.";
          await recordAutomationEvent({
            step: "direct_update",
            outcome: "error",
            title: parsed.data.title,
            sourceUrl: parsed.data.sourceUrl,
            errorMessage: message,
            idempotencyKey: idempotencyKey ?? parsed.data.idempotencyKey ?? null,
          });
          return jsonResponse(
            { error: message, ...(apiErr.extra ?? {}) },
            status,
          );
        }
      },
    },
  },
});