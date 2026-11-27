/**
 * SERVER-ONLY admin authentication.
 *
 * Replaces Supabase Auth: credentials live in the `admin_users` MySQL table
 * (bcrypt hashed) and the session is an encrypted, HttpOnly cookie.
 */
import { compare, hash } from "bcryptjs";
import { clearSession, getSession, updateSession } from "@tanstack/react-start/server";

import { sql } from "./db/mysql.server";

export interface AdminSession {
  userId?: string;
  email?: string;
  role?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  password_hash: string;
}

function sessionConfig() {
  const password = process.env["SESSION_SECRET"] ?? "";
  if (password.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short — set a random string of at least 32 characters.",
    );
  }
  return {
    password,
    name: "cms_session",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/" },
  };
}

export async function readSession(): Promise<AdminSession | null> {
  try {
    const session = await getSession<AdminSession>(sessionConfig());
    return session.data?.userId ? session.data : null;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<AdminSession> {
  const session = await readSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await requireSession();
  if (session.role !== "administrator") {
    throw new Error("Forbidden: administrator access required");
  }
  return session;
}

async function findByEmail(email: string): Promise<AdminUser | null> {
  const rows = await sql<AdminUser>("SELECT * FROM `admin_users` WHERE `email` = ? LIMIT 1", [
    email.trim().toLowerCase(),
  ]);
  return rows[0] ?? null;
}

/**
 * Creates the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD when the
 * table is still empty, so a fresh deployment can be logged into.
 */
export async function ensureSeedAdmin(): Promise<void> {
  const email = process.env["ADMIN_EMAIL"];
  const password = process.env["ADMIN_PASSWORD"];
  if (!email || !password) return;
  const rows = await sql<{ n: number }>("SELECT COUNT(*) AS n FROM `admin_users`");
  if (Number(rows[0]?.n ?? 0) > 0) return;
  await sql(
    "INSERT INTO `admin_users` (`id`, `email`, `full_name`, `role`, `password_hash`) VALUES (?, ?, ?, ?, ?)",
    [
      crypto.randomUUID(),
      email.trim().toLowerCase(),
      "Administrator",
      "administrator",
      await hash(password, 10),
    ],
  );
}

export async function signInWithPassword(email: string, password: string) {
  await ensureSeedAdmin();
  const user = await findByEmail(email);
  if (!user || !(await compare(password, user.password_hash))) {
    throw new Error("Invalid email or password");
  }
  await updateSession<AdminSession>(sessionConfig(), {
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  return { id: user.id, email: user.email, role: user.role, full_name: user.full_name };
}

export async function signOutSession() {
  await clearSession(sessionConfig());
}

export async function changePassword(userId: string, next: string) {
  await sql("UPDATE `admin_users` SET `password_hash` = ? WHERE `id` = ?", [
    await hash(next, 10),
    userId,
  ]);
}
