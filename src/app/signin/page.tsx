import { redirect } from "next/navigation";

import { signIn } from "@/auth";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const error = first((await searchParams).error);

  return (
    <main className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-lg border border-line bg-card px-8 py-10">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
          Helpdesk Forge
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Your AI support agent
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          It answers customers from your knowledge base and hands off to a
          person when it is unsure.
        </p>
        <form
          className="mt-8 space-y-4"
          action={async (formData) => {
            "use server";
            const email = String(formData.get("email") ?? "")
              .trim()
              .toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              redirect("/signin?error=email");
            }
            await signIn("nodemailer", { email, redirectTo: "/" });
          }}
        >
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          {error === "email" ? (
            <p className="text-sm text-red-800">Enter a valid email address.</p>
          ) : error ? (
            <p className="text-sm text-red-800">
              That sign-in link did not work. Request a new one.
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            Email me a sign-in link
          </button>
        </form>
        <p className="mt-6 text-xs leading-5 text-muted">
          In local development the link is printed in the server console. No
          email is sent.
        </p>
      </div>
    </main>
  );
}
