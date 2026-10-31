import { signOut } from "@/auth";
import { requireWorkspace } from "@/lib/workspace";

import { DashboardNav } from "./nav";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { user, workspace, role } = await requireWorkspace();
  const roleLabel = role === "owner" ? "Owner" : role;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col bg-sidebar px-4 py-5 text-accent-ink md:w-64">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-sidebar-muted uppercase">
            Helpdesk Forge
          </p>
          <p className="mt-2 text-sm font-medium">Your AI support agent</p>
          <p className="mt-4 text-base font-semibold">{workspace.name}</p>
          <p className="text-xs text-sidebar-muted">{roleLabel}</p>
        </div>
        <div className="mt-6">
          <DashboardNav />
        </div>
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="truncate text-xs text-sidebar-muted">{user.email}</p>
          <form
            className="mt-3"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-sidebar-muted hover:text-accent-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line px-6 py-4 md:px-8">
          <p className="text-sm text-muted">{workspace.name}</p>
        </header>
        <div className="flex-1 px-6 py-8 md:px-8">{children}</div>
      </div>
    </div>
  );
}
