import { config } from "./config.js";

async function readBuffer(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > config.maxBodyBytes) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function bufferSplit(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);
  while (index !== -1) {
    parts.push(buffer.slice(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }
  parts.push(buffer.slice(start));
  return parts;
}

function trimMultipartContent(buffer) {
  let start = 0;
  let end = buffer.length;
  if (buffer.slice(0, 2).toString() === "\r\n") start = 2;
  if (buffer.slice(end - 2).toString() === "\r\n") end -= 2;
  if (buffer.slice(end - 2, end).toString() === "--") end -= 2;
  return buffer.slice(start, end);
}

function parseMultipart(buffer, boundary) {
  const fields = {};
  const files = {};
  const delimiter = Buffer.from(`--${boundary}`);
  for (const rawPart of bufferSplit(buffer, delimiter)) {
    const part = trimMultipartContent(rawPart);
    if (!part.length) continue;
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd).toString("utf8");
    const body = part.slice(headerEnd + 4);
    const disposition = headers.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/)?.[1];
    if (!name) continue;
    if (filename) {
      const contentType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream";
      files[name] = { filename, contentType, buffer: body };
    } else {
      const value = body.toString("utf8");
      if (fields[name] === undefined) fields[name] = value;
      else if (Array.isArray(fields[name])) fields[name].push(value);
      else fields[name] = [fields[name], value];
    }
  }
  return { fields, files };
}

function parseUrlEncoded(buffer) {
  const fields = {};
  const params = new URLSearchParams(buffer.toString("utf8"));
  for (const [key, value] of params.entries()) {
    if (fields[key] === undefined) fields[key] = value;
    else if (Array.isArray(fields[key])) fields[key].push(value);
    else fields[key] = [fields[key], value];
  }
  return { fields, files: {} };
}

export async function parseRequestBody(req) {
  const buffer = await readBuffer(req);
  const type = req.headers["content-type"] || "";
  if (type.includes("multipart/form-data")) {
    const boundary = type.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || type.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
    if (!boundary) return { fields: {}, files: {} };
    return parseMultipart(buffer, boundary);
  }
  if (type.includes("application/json")) {
    return { fields: JSON.parse(buffer.toString("utf8") || "{}"), files: {} };
  }
  return parseUrlEncoded(buffer);
}

export function fieldValue(fields, key, fallback = "") {
  const value = fields?.[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export function fieldArray(fields, key) {
  const value = fields?.[key];
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}
