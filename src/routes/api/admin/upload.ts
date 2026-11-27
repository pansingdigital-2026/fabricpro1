import { createFileRoute } from "@tanstack/react-router";
import { saveUploadedFile } from "@/lib/uploads.server";
import { detectAllowedUpload, isWebpBuffer } from "@/lib/upload-validation";

export const Route = createFileRoute("/api/admin/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readSession } = await import("@/lib/auth.server");
        const session = await readSession();
        if (!session) return new Response("Unauthorized", { status: 401 });
        if (session.role !== "administrator") {
          return new Response("Forbidden", { status: 403 });
        }

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return new Response("No file", { status: 400 });
        if (file.size > 25 * 1024 * 1024) return new Response("File too large", { status: 413 });

        const bytes = Buffer.from(await file.arrayBuffer());

        // Optimised smaller copy of an existing upload: <name>-w<width>.webp
        const variantOf = form.get("variantOf");
        if (typeof variantOf === "string" && variantOf) {
          const m = /^(\d{4})\/([0-9a-f-]{36})\.[a-z0-9]{1,8}$/i.exec(variantOf);
          const width = Number(form.get("width"));
          if (!m || !Number.isInteger(width) || width < 100 || width > 4096) {
            return new Response("Bad variant", { status: 400 });
          }
          if (!isWebpBuffer(bytes)) {
            return new Response("Unsupported variant type", { status: 415 });
          }
          await saveUploadedFile(
            `${m[1]}/${m[2]}-w${width}.webp`,
            bytes,
            "image/webp",
          );
          return Response.json({ ok: true });
        }

        const detected = detectAllowedUpload(bytes);
        if (!detected) {
          return new Response("Unsupported file type", { status: 415 });
        }

        const folder = String(new Date().getFullYear());
        const name = `${crypto.randomUUID()}.${detected.ext}`;
        const relative = `${folder}/${name}`;

        await saveUploadedFile(relative, bytes, detected.mimeType);

        return Response.json({
          storage_path: relative,
          public_url: `/uploads/${relative}`,
          file_name: file.name,
          mime_type: detected.mimeType,
          size_bytes: file.size,
        });
      },
    },
  },
});
