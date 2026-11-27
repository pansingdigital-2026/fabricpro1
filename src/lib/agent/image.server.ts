import { lookup } from "node:dns/promises";
import sharp from "sharp";

import { getAdminClient } from "@/lib/db.server";
import { variantWidthsFor } from "@/lib/images";
import { saveUploadedFile } from "@/lib/uploads.server";
import { isPrivateIp, validateRemoteImageUrl } from "./schema";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
export const UPDATE_IMAGE_WIDTH = 1600;
export const UPDATE_IMAGE_HEIGHT = 900;

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function detectMimeFromMagic(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const records = await lookup(host, { all: true }).catch(() => []);
  if (records.length === 0) throw new Error("Could not resolve image host.");
  for (const rec of records) {
    if (isPrivateIp(rec.address)) {
      throw new Error("Private or local image hosts are not allowed.");
    }
  }
}

async function fetchSafeImage(rawUrl: string): Promise<{ buffer: Buffer; mime: string; fileName: string }> {
  let current = rawUrl;
  let res: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = validateRemoteImageUrl(current);
    if (!check.ok) throw new Error(check.error);
    await assertPublicHost(check.url);

    res = await fetch(check.url.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1" },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Image redirect missing location header.");
      current = new URL(loc, check.url).toString();
      if (hop === MAX_REDIRECTS) throw new Error("Too many image redirects.");
      continue;
    }
    break;
  }

  if (!res || !res.ok) {
    throw new Error(`Could not download featured image (HTTP ${res?.status ?? "error"}).`);
  }

  const declaredLen = Number(res.headers.get("content-length") ?? "0");
  if (declaredLen > MAX_IMAGE_BYTES) {
    throw new Error("Featured image exceeds the 10 MB limit.");
  }

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Empty image response.");

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error("Featured image exceeds the 10 MB limit.");
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks);
  const detected = detectMimeFromMagic(buffer);
  const mime = detected ?? (ALLOWED_MIME[contentType] ? contentType : null);
  if (!mime || !ALLOWED_MIME[mime]) {
    throw new Error("Featured image must be JPG, PNG, or WebP.");
  }

  const parsed = new URL(current);
  const baseName = decodeURIComponent(parsed.pathname.split("/").pop() || "featured-image")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .slice(0, 120);
  const ext = ALLOWED_MIME[mime]!;
  const fileName = baseName.includes(".") ? baseName : `${baseName}.${ext}`;
  return { buffer, mime, fileName };
}

async function tryGenerateVariants(
  buffer: Buffer,
  folder: string,
  uuid: string,
): Promise<{ width: number | null; height: number | null }> {
  try {
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? null;
    const height = meta.height ?? null;
    if (width) {
      for (const w of variantWidthsFor(width)) {
        const variantBuf = await sharp(buffer)
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        await saveUploadedFile(`${folder}/${uuid}-w${w}.webp`, variantBuf, "image/webp");
      }
    }
    return { width, height };
  } catch {
    return { width: null, height: null };
  }
}

/**
 * Convert an uploaded image buffer into a 1600 × 900 WebP, generate responsive
 * copies, save to UPLOAD_DIR, and register it in Media under the Updates folder.
 */
export async function saveUploadedUpdateImage(
  buffer: Buffer,
  originalName: string,
  altText: string,
): Promise<{ mediaId: string; publicUrl: string; width: number; height: number; altText: string }> {
  if (buffer.byteLength === 0) throw new Error("Image file is empty.");
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Image file exceeds the 10 MB limit.");

  let webpBuffer: Buffer;
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.format || !["jpeg", "png", "webp", "avif"].includes(meta.format)) {
      throw new Error("Image must be JPG, PNG, WebP, or AVIF.");
    }
    webpBuffer = await sharp(buffer)
      .rotate()
      .resize(UPDATE_IMAGE_WIDTH, UPDATE_IMAGE_HEIGHT, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Image must be")) throw err;
    throw new Error("Uploaded file is not a valid image.");
  }

  const folder = String(new Date().getFullYear());
  const uuid = crypto.randomUUID();
  const fileDiskName = `${uuid}.webp`;
  const relative = `${folder}/${fileDiskName}`;

  await saveUploadedFile(relative, webpBuffer, "image/webp");
  await tryGenerateVariants(webpBuffer, folder, uuid);

  const cleanBase = (originalName || "update-featured")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const displayName = `${cleanBase || "update-featured"}.webp`;
  const publicUrl = `/uploads/${relative}`;

  const db = getAdminClient();
  const { data, error } = await db
    .from("media")
    .insert({
      storage_path: relative,
      public_url: publicUrl,
      file_name: displayName,
      mime_type: "image/webp",
      size_bytes: webpBuffer.byteLength,
      width: UPDATE_IMAGE_WIDTH,
      height: UPDATE_IMAGE_HEIGHT,
      alt_text: altText,
      title: altText.slice(0, 255),
      folder: "news",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save image in Media library.");
  }

  return {
    mediaId: (data as { id: string }).id,
    publicUrl,
    width: UPDATE_IMAGE_WIDTH,
    height: UPDATE_IMAGE_HEIGHT,
    altText,
  };
}

/** Download a remote featured image, save to UPLOAD_DIR, and register in the media table. */
export async function importRemoteFeaturedImage(
  url: string,
  altText: string,
): Promise<{ mediaId: string | null; publicUrl: string; altText: string }> {
  const { buffer, mime, fileName } = await fetchSafeImage(url);
  const ext = ALLOWED_MIME[mime] ?? "jpg";
  const folder = String(new Date().getFullYear());
  const uuid = crypto.randomUUID();
  const name = `${uuid}.${ext}`;
  const relative = `${folder}/${name}`;

  await saveUploadedFile(relative, buffer, mime);

  const { width, height } = await tryGenerateVariants(buffer, folder, uuid);
  const publicUrl = `/uploads/${relative}`;

  const db = getAdminClient();
  const { data } = await db
    .from("media")
    .insert({
      storage_path: relative,
      public_url: publicUrl,
      file_name: fileName,
      mime_type: mime,
      size_bytes: buffer.byteLength,
      width,
      height,
      alt_text: altText,
      title: altText.slice(0, 255),
      folder: "news",
    })
    .select("id")
    .maybeSingle();

  return { mediaId: (data as { id: string } | null)?.id ?? null, publicUrl, altText };
}