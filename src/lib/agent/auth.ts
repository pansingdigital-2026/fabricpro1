import { createHash, timingSafeEqual } from "node:crypto";

export type AuthCheck =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export type AutomationKeyName =
  | "PUBLISH_API_KEY"
  | "UPDATE_ARTICLE_API_KEY"
  | "UPDATE_IMAGE_API_KEY"
  | "UPDATE_FINALIZE_API_KEY";

/**
 * Verify `Authorization: Bearer <key>` against a named server env var using
 * constant-time comparison.
 * Reads the secret from the provided env object (defaults to `process.env`) at call time.
 */
export function verifyBearerKey(
  request: Request,
  envVar: AutomationKeyName,
  env: Record<string, string | undefined> = process.env,
): AuthCheck {
  const expected = env[envVar]?.trim();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: `Agent publishing is not configured. Set ${envVar} on the server.`,
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const provided = match?.[1]?.trim();
  if (!provided) {
    return { ok: false, status: 401, error: "Missing Bearer token." };
  }

  // Hash both values so timingSafeEqual always compares fixed 32-byte digests.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Invalid API key." };
  }

  return { ok: true };
}

/** Verify `Authorization: Bearer <PUBLISH_API_KEY>`. */
export function verifyAgentAuth(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): AuthCheck {
  return verifyBearerKey(request, "PUBLISH_API_KEY", env);
}