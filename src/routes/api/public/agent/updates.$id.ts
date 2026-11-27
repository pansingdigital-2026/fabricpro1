import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/agent/updates/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      PATCH: async ({ request, params }) => {
        const { verifyAgentAuth } = await import("@/lib/agent/auth");
        const auth = verifyAgentAuth(request);
        if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return jsonResponse({ error: "Request body must be valid JSON." }, 400);
        }

        const { patchUpdateSchema } = await import("@/lib/agent/schema");
        const parsed = patchUpdateSchema.safeParse(rawBody);
        if (!parsed.success) {
          return jsonResponse(
            {
              error: "Invalid update payload.",
              details: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
            },
            400,
          );
        }

        try {
          const { patchAgentUpdate } = await import("@/lib/agent/updates.server");
          const updated = await patchAgentUpdate(params.id, parsed.data);
          return jsonResponse({ ok: true, article: updated }, 200);
        } catch (err) {
          const apiErr = err as { status?: number; extra?: Record<string, unknown> };
          const status = typeof apiErr.status === "number" ? apiErr.status : 500;
          return jsonResponse(
            { error: err instanceof Error ? err.message : "Failed to edit update.", ...(apiErr.extra ?? {}) },
            status,
          );
        }
      },
    },
  },
});