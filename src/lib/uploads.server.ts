import { accessSync, constants, mkdirSync, realpathSync, readdirSync, statSync } from "node:fs";
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPool, isDatabaseConfigured } from "@/lib/db/mysql.server";

export interface UploadEnvOptions {
  cwd?: string;
  envUploadDir?: string | undefined;
}

const DEFAULT_UPLOAD_VALUES = new Set(["", "uploads", "./uploads", "uploads/", "./uploads/"]);

function safeRealpath(dir: string): string {
  try {
    return realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

/**
 * Detect Hostinger Node.js deployment layout:
 *   <domain>/hbuilds/versions/<uuid>
 *   <domain>/hbuilds/current (symlink to versions/<uuid>)
 * Returns the <domain>/hbuilds directory path, or null when not in hbuilds.
 */
export function detectHbuildsDir(cwd = process.cwd()): string | null {
  for (const candidate of [path.resolve(cwd), safeRealpath(cwd)]) {
    const parent = path.dirname(candidate);
    const grandParent = path.dirname(parent);
    if (path.basename(parent) === "versions" && path.basename(grandParent) === "hbuilds") {
      return grandParent;
    }
    if (path.basename(candidate) === "current" && path.basename(parent) === "hbuilds") {
      return parent;
    }
  }
  return null;
}

function isWritableDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the primary directory for saving uploaded files.
 * - Respects any explicit UPLOAD_DIR outside the default "./uploads".
 * - On Hostinger (hbuilds/versions/<id>), automatically moves default "./uploads"
 *   to <domain>/uploads (outside hbuilds) so redeploys never wipe media files.
 */
export function resolveUploadRoot(opts?: UploadEnvOptions): string {
  const cwd = path.resolve(opts?.cwd ?? process.cwd());
  const rawEnv = (opts && "envUploadDir" in opts ? opts.envUploadDir : process.env["UPLOAD_DIR"])?.trim() ?? "";

  if (rawEnv && !DEFAULT_UPLOAD_VALUES.has(rawEnv)) {
    return path.resolve(cwd, rawEnv);
  }

  const hbuildsDir = detectHbuildsDir(cwd);
  if (hbuildsDir) {
    const domainUploads = path.resolve(hbuildsDir, "..", "uploads");
    if (isWritableDir(domainUploads)) return domainUploads;
    const hbuildsUploads = path.resolve(hbuildsDir, "uploads");
    if (isWritableDir(hbuildsUploads)) return hbuildsUploads;
  }

  return path.join(cwd, "uploads");
}

/** Whether the active upload directory lives outside the replaceable deployment folder. */
export function isUploadRootPersistent(opts?: UploadEnvOptions): boolean {
  const cwd = safeRealpath(opts?.cwd ?? process.cwd());
  const root = safeRealpath(resolveUploadRoot(opts));
  return root !== cwd && !root.startsWith(cwd + path.sep);
}

function listPreviousVersionUploadDirs(hbuildsDir: string): string[] {
  const versionsDir = path.join(hbuildsDir, "versions");
  try {
    const entries = readdirSync(versionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const uploadsPath = path.join(versionsDir, d.name, "uploads");
        try {
          const st = statSync(uploadsPath);
          return st.isDirectory() ? { uploadsPath, mtimeMs: st.mtimeMs } : null;
        } catch {
          return null;
        }
      })
      .filter((item): item is { uploadsPath: string; mtimeMs: number } => item !== null)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return entries.map((e) => e.uploadsPath);
  } catch {
    return [];
  }
}

/** Ordered, deduplicated roots searched when serving /uploads/* files. */
export function getCandidateUploadRoots(opts?: UploadEnvOptions): string[] {
  const cwd = path.resolve(opts?.cwd ?? process.cwd());
  const rawEnv = (opts && "envUploadDir" in opts ? opts.envUploadDir : process.env["UPLOAD_DIR"])?.trim();
  const primary = resolveUploadRoot(opts);
  const hbuildsDir = detectHbuildsDir(cwd);

  const list: Array<string | undefined> = [
    primary,
    rawEnv ? path.resolve(cwd, rawEnv) : undefined,
    path.join(cwd, "uploads"),
    path.join(cwd, "..", "uploads"),
    path.join(cwd, "..", "..", "uploads"),
    path.join(cwd, "..", "..", "..", "uploads"),
  ];

  if (hbuildsDir) {
    list.push(path.resolve(hbuildsDir, "..", "uploads"));
    list.push(path.resolve(hbuildsDir, "uploads"));
    list.push(...listPreviousVersionUploadDirs(hbuildsDir));
  }

  list.push(path.join(cwd, "public", "uploads"));

  return Array.from(new Set(list.filter(Boolean).map((p) => path.resolve(p!))));
}

async function copyMissingFiles(sourceDir: string, targetDir: string): Promise<number> {
  let copied = 0;
  let entries;
  try {
    entries = await readdir(sourceDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const dstPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copied += await copyMissingFiles(srcPath, dstPath);
    } else if (entry.isFile()) {
      try {
        await stat(dstPath);
      } catch {
        try {
          await mkdir(targetDir, { recursive: true });
          await copyFile(srcPath, dstPath);
          copied += 1;
        } catch {
          /* ignore unreadable/unwritable individual file */
        }
      }
    }
  }
  return copied;
}

/**
 * Copy any uploaded files left inside older Hostinger version folders
 * (hbuilds/versions/<id>/uploads) into the permanent uploads directory.
 * Existing files in the permanent directory are never overwritten.
 */
export async function migratePreviousVersionUploads(opts?: UploadEnvOptions): Promise<{ copied: number }> {
  const cwd = path.resolve(opts?.cwd ?? process.cwd());
  const hbuildsDir = detectHbuildsDir(cwd);
  if (!hbuildsDir) return { copied: 0 };

  const target = resolveUploadRoot(opts);
  const versionsDir = path.join(hbuildsDir, "versions");
  if (safeRealpath(target).startsWith(safeRealpath(versionsDir) + path.sep)) {
    return { copied: 0 };
  }

  let copied = 0;
  for (const oldUploads of listPreviousVersionUploadDirs(hbuildsDir)) {
    if (safeRealpath(oldUploads) === safeRealpath(target)) continue;
    copied += await copyMissingFiles(oldUploads, target);
  }
  return { copied };
}

let migrationStarted: Promise<{ copied: number }> | null = null;

/** Run the previous-version rescue migration at most once per server process. */
export function ensureUploadsMigrated(): Promise<{ copied: number }> {
  if (!migrationStarted) {
    migrationStarted = migratePreviousVersionUploads().catch(() => ({ copied: 0 }));
  }
  return migrationStarted;
}

/* ------------------------------------------------------------------ */
/* Persistent MySQL binary storage (survives every Hostinger redeploy) */
/* ------------------------------------------------------------------ */

let mediaTableReady: Promise<void> | null = null;

export function ensureMediaFilesTable(): Promise<void> {
  if (!isDatabaseConfigured()) return Promise.resolve();
  if (!mediaTableReady) {
    mediaTableReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS \`media_files\` (
          \`storage_path\` VARCHAR(255) NOT NULL PRIMARY KEY,
          \`mime_type\` VARCHAR(190) NOT NULL DEFAULT 'application/octet-stream',
          \`size_bytes\` BIGINT NOT NULL DEFAULT 0,
          \`data\` LONGBLOB NOT NULL,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      )
      .then(() => undefined)
      .catch((err) => {
        mediaTableReady = null;
        throw err;
      });
  }
  return mediaTableReady;
}

/**
 * Save an uploaded file to MySQL (permanent across redeploys) and to the local
 * uploads folder as a fast cache.
 */
export async function saveUploadedFile(
  relativePath: string,
  data: Buffer,
  mimeType = "application/octet-stream",
): Promise<void> {
  const cleanRel = relativePath.replace(/^\/+/, "");
  const root = resolveUploadRoot();
  const diskPath = path.resolve(root, cleanRel);
  if (!diskPath.startsWith(root + path.sep)) {
    throw new Error("Invalid upload path.");
  }

  if (isDatabaseConfigured()) {
    await ensureMediaFilesTable();
    await getPool().query(
      `INSERT INTO \`media_files\` (\`storage_path\`, \`mime_type\`, \`size_bytes\`, \`data\`)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`mime_type\` = VALUES(\`mime_type\`),
         \`size_bytes\` = VALUES(\`size_bytes\`),
         \`data\` = VALUES(\`data\`)`,
      [cleanRel, mimeType, data.byteLength, data],
    );
    // Warm local disk cache (non-fatal if hosting filesystem is read-only).
    try {
      await mkdir(path.dirname(diskPath), { recursive: true });
      await writeFile(diskPath, data);
    } catch {
      /* disk cache optional when DB holds the file */
    }
    return;
  }

  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, data);
}

/** Read an uploaded file from MySQL, falling back from a missing variant to its original. */
export async function readUploadedFileFromDb(
  relativePath: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    await ensureMediaFilesTable();
    const [rows] = await getPool().query(
      `SELECT \`mime_type\`, \`data\` FROM \`media_files\` WHERE \`storage_path\` = ? LIMIT 1`,
      [relativePath],
    );
    const list = rows as Array<{ mime_type: string; data: Buffer }>;
    if (list[0]?.data) {
      return { data: Buffer.from(list[0].data), mimeType: list[0].mime_type };
    }

    // Missing optimised copy -> fall back to original image in MySQL.
    const variant = /^(\d{4})\/([0-9a-f-]{36})-w\d+\.webp$/i.exec(relativePath);
    if (variant) {
      const [origRows] = await getPool().query(
        `SELECT \`mime_type\`, \`data\` FROM \`media_files\` WHERE \`storage_path\` LIKE ? LIMIT 1`,
        [`${variant[1]}/${variant[2]}.%`],
      );
      const origList = origRows as Array<{ mime_type: string; data: Buffer }>;
      if (origList[0]?.data) {
        return { data: Buffer.from(origList[0].data), mimeType: origList[0].mime_type };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Report database-backed upload storage health for /api/public/health. */
export async function getDatabaseUploadStatus(): Promise<{
  storedInDatabase: boolean;
  databaseFileCount: number;
}> {
  if (!isDatabaseConfigured()) {
    return { storedInDatabase: false, databaseFileCount: 0 };
  }
  try {
    await ensureMediaFilesTable();
    const [rows] = await getPool().query(`SELECT COUNT(*) AS cnt FROM \`media_files\``);
    const count = Number((rows as Array<{ cnt: number | string }>)[0]?.cnt ?? 0);
    return { storedInDatabase: true, databaseFileCount: count };
  } catch {
    return { storedInDatabase: false, databaseFileCount: 0 };
  }
}