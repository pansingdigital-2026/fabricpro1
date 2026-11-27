import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectHbuildsDir,
  getCandidateUploadRoots,
  isUploadRootPersistent,
  migratePreviousVersionUploads,
  readUploadedFileFromDb,
  resolveUploadRoot,
  saveUploadedFile,
} from "./uploads.server";
import * as mysqlServer from "@/lib/db/mysql.server";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("uploads.server persistent Hostinger storage", () => {
  it("resolves default ./uploads inside Hostinger hbuilds/versions/<id> to <domain>/uploads", () => {
    const domain = makeTempDir("cm-hostinger-");
    const versionDir = path.join(domain, "hbuilds", "versions", "01a211cc-deploy-2");
    mkdirSync(versionDir, { recursive: true });

    expect(detectHbuildsDir(versionDir)).toBe(path.join(domain, "hbuilds"));
    expect(resolveUploadRoot({ cwd: versionDir, envUploadDir: "./uploads" })).toBe(
      path.join(domain, "uploads"),
    );
    expect(resolveUploadRoot({ cwd: versionDir, envUploadDir: undefined })).toBe(
      path.join(domain, "uploads"),
    );
    expect(isUploadRootPersistent({ cwd: versionDir, envUploadDir: "./uploads" })).toBe(true);
  });

  it("handles hbuilds/current symlink pointing to a version folder", () => {
    const domain = makeTempDir("cm-symlink-");
    const versionDir = path.join(domain, "hbuilds", "versions", "01a211cc-deploy-2");
    const currentLink = path.join(domain, "hbuilds", "current");
    mkdirSync(versionDir, { recursive: true });
    symlinkSync(versionDir, currentLink);

    expect(resolveUploadRoot({ cwd: currentLink, envUploadDir: "./uploads" })).toBe(
      path.join(domain, "uploads"),
    );
    expect(isUploadRootPersistent({ cwd: currentLink, envUploadDir: "./uploads" })).toBe(true);
  });

  it("respects an explicit custom UPLOAD_DIR", () => {
    const domain = makeTempDir("cm-custom-");
    const versionDir = path.join(domain, "hbuilds", "versions", "01a211cc-deploy-2");
    const customDir = path.join(domain, "my-media");
    mkdirSync(versionDir, { recursive: true });

    expect(resolveUploadRoot({ cwd: versionDir, envUploadDir: customDir })).toBe(customDir);
    expect(isUploadRootPersistent({ cwd: versionDir, envUploadDir: customDir })).toBe(true);
  });

  it("migrates images from previous Hostinger version folders without overwriting newer ones", async () => {
    const domain = makeTempDir("cm-migrate-");
    const oldVersion = path.join(domain, "hbuilds", "versions", "01a211a7-old");
    const newVersion = path.join(domain, "hbuilds", "versions", "01a211cc-new");
    const oldUploads = path.join(oldVersion, "uploads", "2026");
    mkdirSync(oldUploads, { recursive: true });
    mkdirSync(newVersion, { recursive: true });

    writeFileSync(path.join(oldUploads, "logo.webp"), "old-logo-bytes");
    writeFileSync(path.join(oldUploads, "article.webp"), "article-bytes");

    // Pre-existing file in permanent folder should not be overwritten
    const permanent = path.join(domain, "uploads", "2026");
    mkdirSync(permanent, { recursive: true });
    writeFileSync(path.join(permanent, "logo.webp"), "newer-logo-bytes");

    const oldRoot = path.join(oldVersion, "uploads");
    utimesSync(oldRoot, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));

    const res = await migratePreviousVersionUploads({ cwd: newVersion, envUploadDir: "./uploads" });
    expect(res.copied).toBe(1);
    expect(readFileSync(path.join(permanent, "logo.webp"), "utf8")).toBe("newer-logo-bytes");
    expect(readFileSync(path.join(permanent, "article.webp"), "utf8")).toBe("article-bytes");

    const candidates = getCandidateUploadRoots({ cwd: newVersion, envUploadDir: "./uploads" });
    expect(candidates[0]).toBe(path.join(domain, "uploads"));
    expect(candidates).toContain(oldRoot);
  });

  it("saves uploaded files into MySQL media_files and reads them back (including variant fallback)", async () => {
    const uploadDir = makeTempDir("cm-db-upload-");
    const prevUploadDir = process.env["UPLOAD_DIR"];
    process.env["UPLOAD_DIR"] = uploadDir;

    const store = new Map<string, { mime_type: string; data: Buffer }>();
    const fakePool = {
      query: vi.fn(async (sqlText: string, params?: unknown[]) => {
        if (sqlText.includes("CREATE TABLE IF NOT EXISTS")) return [[], []];
        if (sqlText.includes("INSERT INTO `media_files`")) {
          const [storagePath, mimeType, , buf] = params as [string, string, number, Buffer];
          store.set(storagePath, { mime_type: mimeType, data: Buffer.from(buf) });
          return [{ affectedRows: 1 }, []];
        }
        if (sqlText.includes("WHERE `storage_path` = ?")) {
          const row = store.get(String(params?.[0] ?? ""));
          return [row ? [row] : [], []];
        }
        if (sqlText.includes("WHERE `storage_path` LIKE ?")) {
          const prefix = String(params?.[0] ?? "").replace(/%$/, "");
          for (const [k, v] of store.entries()) {
            if (k.startsWith(prefix)) return [[v], []];
          }
          return [[], []];
        }
        return [[], []];
      }),
    };

    const cfgSpy = vi.spyOn(mysqlServer, "isDatabaseConfigured").mockReturnValue(true);
    const poolSpy = vi.spyOn(mysqlServer, "getPool").mockReturnValue(fakePool as never);

    try {
      const rel = "2026/0f8fad5b-d9cb-469f-a165-70867728950e.webp";
      const bytes = Buffer.from("fake-webp-bytes");
      await saveUploadedFile(rel, bytes, "image/webp");

      // Delete local disk cache to simulate a fresh Hostinger redeploy
      rmSync(path.join(uploadDir, rel), { force: true });

      const exact = await readUploadedFileFromDb(rel);
      expect(exact?.mimeType).toBe("image/webp");
      expect(exact?.data.toString("utf8")).toBe("fake-webp-bytes");

      // Variant missing -> falls back to original in MySQL
      const fallback = await readUploadedFileFromDb("2026/0f8fad5b-d9cb-469f-a165-70867728950e-w768.webp");
      expect(fallback?.data.toString("utf8")).toBe("fake-webp-bytes");
    } finally {
      cfgSpy.mockRestore();
      poolSpy.mockRestore();
      if (prevUploadDir === undefined) delete process.env["UPLOAD_DIR"];
      else process.env["UPLOAD_DIR"] = prevUploadDir;
    }
  });
});