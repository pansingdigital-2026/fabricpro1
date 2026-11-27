import { createFileRoute } from "@tanstack/react-router";
import {
  ensureUploadsMigrated,
  getDatabaseUploadStatus,
  isUploadRootPersistent,
} from "@/lib/uploads.server";

/**
 * Deployment diagnostics. Reports whether the server can reach the MySQL
 * database and which env vars are present. Never returns secret values.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const env = process.env;
        void ensureUploadsMigrated();
        const dbUploads = await getDatabaseUploadStatus();

        const report: Record<string, unknown> = {
          node: process.version,
          nodeEnv: env["NODE_ENV"] ?? null,
          env: {
            DB_HOST: Boolean(env["DB_HOST"]),
            DB_PORT: env["DB_PORT"] ?? "3306 (default)",
            DB_USER: Boolean(env["DB_USER"]),
            DB_PASSWORD: Boolean(env["DB_PASSWORD"]),
            DB_NAME: Boolean(env["DB_NAME"]),
            SESSION_SECRET: Boolean(env["SESSION_SECRET"]),
            PUBLISH_API_KEY: Boolean(env["PUBLISH_API_KEY"]),
            UPDATE_ARTICLE_API_KEY: Boolean(env["UPDATE_ARTICLE_API_KEY"]),
            UPDATE_IMAGE_API_KEY: Boolean(env["UPDATE_IMAGE_API_KEY"]),
            UPDATE_FINALIZE_API_KEY: Boolean(env["UPDATE_FINALIZE_API_KEY"]),
            UPLOAD_DIR: env["UPLOAD_DIR"] ?? "uploads (default)",
          },
          uploads: {
            storedInDatabase: dbUploads.storedInDatabase,
            databaseFileCount: dbUploads.databaseFileCount,
            persistent: dbUploads.storedInDatabase || isUploadRootPersistent(),
          },
        };

        try {
          const { getPublicServerClient } = await import("@/lib/db.server");
          const db = getPublicServerClient();
          const started = Date.now();
          const { data, error } = await db.from("site_settings").select("key").limit(1);
          report["database"] = {
            ok: !error,
            ms: Date.now() - started,
            rows: data?.length ?? 0,
            error: error ? { message: error.message } : null,
          };
        } catch (err) {
          report["database"] = {
            ok: false,
            thrown: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          };
        }

        return new Response(JSON.stringify(report, null, 2), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      },
    },
  },
});
