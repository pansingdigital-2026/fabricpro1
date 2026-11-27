/**
 * Server-side magic-byte inspection for uploaded media files.
 * Extension and MIME type are derived strictly from verified file signatures,
 * never from client-supplied filenames or Content-Type headers.
 */

export interface DetectedUpload {
  ext: string;
  mimeType: string;
}

function matchesAt(buf: Uint8Array, offset: number, bytes: readonly number[]): boolean {
  if (buf.byteLength < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function asciiAt(buf: Uint8Array, offset: number, text: string): boolean {
  if (buf.byteLength < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (buf[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

const MP4_BRANDS = new Set(["isom", "iso2", "mp41", "mp42", "M4V ", "M4A ", "avc1", "qt  ", "MSNV"]);

/** Inspect file bytes and return the canonical extension + MIME type, or null if disallowed. */
export function detectAllowedUpload(buf: Uint8Array): DetectedUpload | null {
  if (buf.byteLength < 4) return null;

  // JPEG: FF D8 FF
  if (matchesAt(buf, 0, [0xff, 0xd8, 0xff])) {
    return { ext: "jpg", mimeType: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (matchesAt(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ext: "png", mimeType: "image/png" };
  }

  // GIF87a / GIF89a
  if (asciiAt(buf, 0, "GIF87a") || asciiAt(buf, 0, "GIF89a")) {
    return { ext: "gif", mimeType: "image/gif" };
  }

  // WebP: RIFF....WEBP
  if (asciiAt(buf, 0, "RIFF") && asciiAt(buf, 8, "WEBP")) {
    return { ext: "webp", mimeType: "image/webp" };
  }

  // ISO Base Media File Format (AVIF / MP4): ....ftyp<brand>
  if (buf.byteLength >= 12 && asciiAt(buf, 4, "ftyp")) {
    const brand = String.fromCharCode(buf[8]!, buf[9]!, buf[10]!, buf[11]!);
    if (brand === "avif" || brand === "avis") {
      return { ext: "avif", mimeType: "image/avif" };
    }
    if (MP4_BRANDS.has(brand)) {
      return { ext: "mp4", mimeType: "video/mp4" };
    }
  }

  // ICO: 00 00 01 00
  if (matchesAt(buf, 0, [0x00, 0x00, 0x01, 0x00])) {
    return { ext: "ico", mimeType: "image/x-icon" };
  }

  // PDF: %PDF-
  if (asciiAt(buf, 0, "%PDF-")) {
    return { ext: "pdf", mimeType: "application/pdf" };
  }

  // WebM (EBML header): 1A 45 DF A3
  if (matchesAt(buf, 0, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { ext: "webm", mimeType: "video/webm" };
  }

  return null;
}

export function isWebpBuffer(buf: Uint8Array): boolean {
  return asciiAt(buf, 0, "RIFF") && asciiAt(buf, 8, "WEBP");
}