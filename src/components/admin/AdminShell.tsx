import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  FileText,
  Home,
  Image as ImageIcon,
  Inbox,
  LayoutGrid,
  Layers,
  Link2,
  Menu as MenuIcon,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { adminSignIn, adminSignOut, getAdminSession, type SessionUser } from "@/lib/auth.functions";

import { Btn, Field, TextInput } from "./ui";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: Home, exact: true },
  { to: "/admin/content", label: "Content", icon: FileText },
  { to: "/admin/automation", label: "News Automation", icon: Bot },
  { to: "/admin/homepage", label: "Homepage", icon: LayoutGrid },
  { to: "/admin/pages", label: "Pages", icon: Layers },
  { to: "/admin/taxonomy", label: "Categories & tags", icon: Tags },
  { to: "/admin/authors", label: "Authors", icon: Users },
  { to: "/admin/media", label: "Media", icon: ImageIcon },
  { to: "/admin/menus", label: "Menus", icon: MenuIcon },
  { to: "/admin/redirects", label: "Redirects", icon: Link2 },
  { to: "/admin/inbox", label: "Inbox", icon: Inbox },
  { to: "/admin/types", label: "Content types", icon: Layers },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function LoginScreen({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const user = await adminSignIn({ data: { email, password } });
      onSignedIn(user);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">Fabric-Pro Admin</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Use the staff account created in your database.
        </p>
        <div className="mt-5 space-y-3">
          <Field label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") void signIn();
              }}
            />
          </Field>
          <Btn className="w-full justify-center py-2" disabled={busy} onClick={() => void signIn()}>
            {busy ? "Signing in…" : "Sign in"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let active = true;
    void getAdminSession()
      .then((user) => {
        if (!active) return;
        setSession(user);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return <div className="p-10 text-sm text-muted-foreground">Loading CMS…</div>;
  }
  if (!session) return <LoginScreen onSignedIn={setSession} />;

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border px-4 py-4">
          <p className="text-sm font-semibold text-foreground">Fabric-Pro CMS</p>
          <p className="truncate text-[11px] text-muted-foreground">{session.email}</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="block text-[11px] text-muted-foreground hover:text-foreground"
          >
            View site ↗
          </a>
          <Btn variant="outline" onClick={() => {
              void adminSignOut().then(() => setSession(null));
            }}>
            Sign out
          </Btn>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex gap-2 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="whitespace-nowrap rounded-md px-2 py-1 text-[11px] text-muted-foreground"
            >
              {label}
            </Link>
          ))}
        </div>
        <main className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
