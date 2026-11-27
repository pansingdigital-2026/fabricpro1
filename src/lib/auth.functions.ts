import { createServerFn } from "@tanstack/react-start";

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { readSession } = await import("./auth.server");
  const session = await readSession();
  if (!session?.userId) return null;
  return { id: session.userId, email: session.email ?? "", role: session.role ?? "" } as SessionUser;
});

export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => {
    if (!input?.email || !input?.password) throw new Error("Email and password are required");
    return { email: String(input.email), password: String(input.password) };
  })
  .handler(async ({ data }) => {
    const { signInWithPassword } = await import("./auth.server");
    const user = await signInWithPassword(data.email, data.password);
    return { id: user.id, email: user.email, role: user.role } as SessionUser;
  });

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const { signOutSession } = await import("./auth.server");
  await signOutSession();
  return { ok: true };
});

export const adminChangePassword = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => {
    if (!input?.password || String(input.password).length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    return { password: String(input.password) };
  })
  .handler(async ({ data }) => {
    const { requireSession, changePassword } = await import("./auth.server");
    const session = await requireSession();
    await changePassword(session.userId!, data.password);
    return { ok: true };
  });
