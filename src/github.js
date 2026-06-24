import fs from "node:fs";
import path from "node:path";
import { config, paths } from "./config.js";
import { ensureDir } from "./utils.js";

function githubReady() {
  return Boolean(config.github.token && config.github.repo);
}

function repoPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return [config.github.basePath, normalized].filter(Boolean).join("/");
}

function apiUrl(relativePath) {
  const encodedPath = repoPath(relativePath).split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${config.github.repo}/contents/${encodedPath}`;
}

async function currentSha(relativePath) {
  const response = await fetch(`${apiUrl(relativePath)}?ref=${encodeURIComponent(config.github.branch)}`, {
    headers: {
      Authorization: `Bearer ${config.github.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (response.status === 404) return "";
  if (!response.ok) throw new Error(`GitHub lookup failed for ${relativePath}: ${response.status}`);
  const data = await response.json();
  return data.sha || "";
}

export async function syncTextFile(relativePath, content, message) {
  const fullPath = path.join(paths.rootDir, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content, "utf8");

  if (!githubReady()) return { local: true, github: false };
  const sha = await currentSha(relativePath);
  const response = await fetch(apiUrl(relativePath), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.github.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: config.github.branch,
      ...(sha ? { sha } : {})
    })
  });
  if (!response.ok) throw new Error(`GitHub save failed for ${relativePath}: ${response.status}`);
  return { local: true, github: true };
}

export async function syncBinaryFile(relativePath, buffer, message) {
  const fullPath = path.join(paths.rootDir, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, buffer);

  if (!githubReady()) return { local: true, github: false };
  const sha = await currentSha(relativePath);
  const response = await fetch(apiUrl(relativePath), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.github.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(buffer).toString("base64"),
      branch: config.github.branch,
      ...(sha ? { sha } : {})
    })
  });
  if (!response.ok) throw new Error(`GitHub upload failed for ${relativePath}: ${response.status}`);
  return { local: true, github: true };
}

export async function deleteSyncedFile(relativePath, message) {
  const fullPath = path.join(paths.rootDir, relativePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  if (!githubReady()) return { local: true, github: false };
  const sha = await currentSha(relativePath);
  if (!sha) return { local: true, github: false };
  const response = await fetch(apiUrl(relativePath), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${config.github.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({
      message,
      sha,
      branch: config.github.branch
    })
  });
  if (!response.ok) throw new Error(`GitHub delete failed for ${relativePath}: ${response.status}`);
  return { local: true, github: true };
}
