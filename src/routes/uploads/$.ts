import { createFileRoute } from "@tanstack/react-router";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureUploadsMigrated,
  getCandidateUploadRoots,
  readUploadedFileFromDb,
  resolveUploadRoot,
} from "@/lib/uploads.server";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  txt: "text/plain; charset=utf-8",
};

export const Route = createFileRoute("/uploads/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rel = String(params._splat ?? "");
        if (!rel || rel.includes("..") || rel.startsWith("/")) {
          return new Response("Not found", { status: 404 });
        }

        // Trigger background rescue of older Hostinger deployment uploads once per boot.
        void ensureUploadsMigrated();

        const roots = getCandidateUploadRoots();
        const primaryRoot = resolveUploadRoot();

        // Missing optimised copy (older uploads) -> serve the original instead.
        const variant = /^(\d{4})\/([0-9a-f-]{36})-w\d+\.webp$/i.exec(rel);
        const rels = [rel];
        if (variant) {
          for (const root of roots) {
            try {
              const names = await readdir(path.join(root, variant[1]!));
              const orig = names.find((n) => n.startsWith(`${variant[2]}.`));
              if (orig) rels.push(`${variant[1]}/${orig}`);
            } catch {
              /* folder missing in this root */
            }
          }
        }

        for (const r of rels) for (const root of roots) {
          const file = path.resolve(root, r);
          if (!file.startsWith(root + path.sep)) continue;
          try {
            const info = await stat(file);
            if (!info.isFile()) continue;
            const ext = file.split(".").pop()?.toLowerCase() ?? "";
            const body = await readFile(file);
            // If served from an older version folder, copy it into the permanent folder.
            if (root !== primaryRoot) {
              const dest = path.resolve(primaryRoot, r);
              if (dest.startsWith(primaryRoot + path.sep)) {
                void mkdir(path.dirname(dest), { recursive: true })
                  .then(() => copyFile(file, dest))
                  .catch(() => {});
              }
            }
            return new Response(new Uint8Array(body), {
              headers: {
                "Content-Type": TYPES[ext] ?? "application/octet-stream",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Length": String(info.size),
              },
            });
          } catch {
            continue;
          }
        }

        // Not on local disk (e.g. after a fresh redeploy) -> read from MySQL media_files.
        const dbFile = await readUploadedFileFromDb(rel);
        if (dbFile) {
          const ext = rel.split(".").pop()?.toLowerCase() ?? "";
          const dest = path.resolve(primaryRoot, rel);
          if (dest.startsWith(primaryRoot + path.sep)) {
            void mkdir(path.dirname(dest), { recursive: true })
              .then(() => writeFile(dest, dbFile.data))
              .catch(() => {});
          }
          return new Response(new Uint8Array(dbFile.data), {
            headers: {
              "Content-Type": TYPES[ext] ?? "application/octet-stream",
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "public, max-age=31536000, immutable",
              "Content-Length": String(dbFile.data.byteLength),
            },
          });
        }

        return new Response("Not found", { status: 404 });
      },
    },
  },
});
