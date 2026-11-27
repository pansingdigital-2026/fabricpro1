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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/agent/updates/image")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const { verifyBearerKey } = await import("@/lib/agent/auth");
        const auth = verifyBearerKey(request, "UPDATE_IMAGE_API_KEY");
        if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

        const { recordAutomationEvent } = await import("@/lib/agent/events.server");
        const headerKey = request.headers.get("idempotency-key")?.trim() || undefined;

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          await recordAutomationEvent({
            step: "upload_image",
            outcome: "error",
            errorMessage: "Request must be multipart/form-data with file, draftId, and altText.",
            idempotencyKey: headerKey ?? null,
          });
          return jsonResponse(
            { error: "Request must be multipart/form-data with file, draftId, and altText." },
            400,
          );
        }

        const file = form.get("file");
        const draftId = String(form.get("draftId") ?? "").trim();
        const altText = String(form.get("altText") ?? "").trim();
        const idempotencyKey = headerKey || String(form.get("idempotencyKey") ?? "").trim() || undefined;

        if (!UUID_RE.test(draftId)) {
          await recordAutomationEvent({
            step: "upload_image",
            outcome: "error",
            errorMessage: "draftId must be a valid UUID.",
            idempotencyKey: idempotencyKey ?? null,
          });
          return jsonResponse({ error: "draftId must be a valid UUID." }, 400);
        }
        if (altText.length < 3 || altText.length > 300) {
          await recordAutomationEvent({
            step: "upload_image",
            outcome: "error",
            draftId,
            errorMessage: "altText is required (3 to 300 characters).",
            idempotencyKey: idempotencyKey ?? null,
          });
          return jsonResponse({ error: "altText is required (3 to 300 characters)." }, 400);
        }
        if (!(file instanceof File) || file.size === 0) {
          await recordAutomationEvent({
            step: "upload_image",
            outcome: "error",
            draftId,
            errorMessage: "An image file is required in the `file` field.",
            idempotencyKey: idempotencyKey ?? null,
          });
          return jsonResponse({ error: "An image file is required in the `file` field." }, 400);
        }

        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const { attachUpdateDraftImage } = await import("@/lib/agent/updates.server");
          const saved = await attachUpdateDraftImage({
            draftId,
            buffer,
            fileName: file.name || "update-featured.webp",
            altText,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          });
          await recordAutomationEvent({
            step: "upload_image",
            outcome: saved.reused ? "reused" : "success",
            draftId: saved.draftId,
            mediaId: saved.mediaId,
            title: saved.title,
            resultState: "Image attached (1600×900 WebP)",
            resultUrl: saved.publicUrl,
            idempotencyKey: idempotencyKey ?? null,
          });
          return jsonResponse({ ok: true, ...saved }, saved.reused ? 200 : 201);
        } catch (err) {
          const apiErr = err as { status?: number; extra?: Record<string, unknown> };
          const status = typeof apiErr.status === "number" ? apiErr.status : 500;
          const message = err instanceof Error ? err.message : "Failed to upload image.";
          await recordAutomationEvent({
            step: "upload_image",
            outcome: "error",
            draftId,
            errorMessage: message,
            idempotencyKey: idempotencyKey ?? null,
          });
          return jsonResponse({ error: message, ...(apiErr.extra ?? {}) }, status);
        }
      },
    },
  },
});