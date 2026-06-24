import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttr(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

export function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function slugify(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "article";
}

export function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isoDate(value) {
  const date = toDate(value);
  return date ? date.toISOString() : "";
}

export function htmlDate(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

export function formatDate(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value = "", length = 160) {
  const text = stripHtml(value);
  if (text.length <= length) return text;
  return `${text.slice(0, length).replace(/\s+\S*$/, "")}...`;
}

export function readingTime(markdown = "") {
  const words = String(markdown).replace(/`{3}[\s\S]*?`{3}/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function absoluteUrl(pathOrUrl = "", siteUrl = config.siteUrl) {
  if (!pathOrUrl) return siteUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export function cleanPath(value = "/") {
  const cleaned = `/${String(value || "/").replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
  return cleaned.length > 1 ? cleaned.replace(/\/+$/, "") : "/";
}

export function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    ...headers
  });
  if (res._headOnly) return res.end();
  res.end(body);
}

export function sendText(res, status, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(status, {
    "Content-Type": contentType,
    ...headers
  });
  if (res._headOnly) return res.end();
  res.end(body);
}

export function redirect(res, location, status = 302) {
  res.writeHead(status, { Location: location });
  res.end();
}

export function parseCookies(cookieHeader = "") {
  const cookies = {};
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join("=") || "");
  }
  return cookies;
}

export function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function signValue(value) {
  return crypto.createHmac("sha256", config.sessionSecret).update(value).digest("base64url");
}

export function makeSession(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14
  })).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

export function verifySession(token = "") {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature || signValue(payload) !== signature) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.email || Date.now() > Number(data.exp || 0)) return null;
    return data;
  } catch {
    return null;
  }
}

export function safeJoin(baseDir, relativePath) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.resolve(baseDir, normalized);
  const base = path.resolve(baseDir);
  if (full !== base && !full.startsWith(`${base}${path.sep}`)) return null;
  return full;
}

export function uniqueId(prefix = "id") {
  return `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
}

export function sanitizeFileName(name = "upload") {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".bin";
  const base = slugify(path.basename(name, ext)).slice(0, 60) || "upload";
  return `${Date.now()}-${base}${ext}`;
}
