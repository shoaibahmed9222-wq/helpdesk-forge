import { redirect } from "next/navigation";

import { requireUser } from "@/lib/session";
import { getMembership } from "@/lib/workspace";

import { createWorkspace } from "./actions";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const user = await requireUser();
  const membership = await getMembership(user.id);
  if (membership) {
    redirect("/dashboard");
  }

  const error = first((await searchParams).error);

  return (
    <main className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-lg border border-line bg-card px-8 py-10">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
          Helpdesk Forge
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Name your workspace
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This is the business your AI support agent works for.
        </p>
        <form className="mt-8 space-y-4" action={createWorkspace}>
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Workspace name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={80}
              placeholder="Northwind Outfitters"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          {error === "name" ? (
            <p className="text-sm text-red-800">Use 2–80 characters.</p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            Create workspace
          </button>
        </form>
      </div>
    </main>
  );
}
