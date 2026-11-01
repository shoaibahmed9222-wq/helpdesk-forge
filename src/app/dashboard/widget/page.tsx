import { headers } from "next/headers";

import { getWidgetSettings } from "@/lib/widget";
import { requireWorkspace } from "@/lib/workspace";

import { SubmitButton } from "../knowledge-base/submit-button";
import { saveWidget } from "./actions";
import { CopySnippet } from "./copy-snippet";

export const metadata = { title: "Website chat · Helpdesk Forge" };

const errorCopy: Record<string, string> = {
  forbidden: "Only the workspace owner can change the website chat.",
  title: "Enter a title, up to 80 characters.",
  greeting: "Enter a greeting, up to 400 characters.",
  accent: "Choose a color.",
  domains: "Enter one site per line, such as example.com.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function appOrigin() {
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (!host) return "";
  const forwarded = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwarded ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { workspace, role } = await requireWorkspace();
  const settings = await getWidgetSettings(workspace.id);
  const origin = await appOrigin();
  const snippet = `<script src="${origin}/widget.js" data-key="${settings.publicKey}" async></script>`;
  const error = errorCopy[first((await searchParams).error) ?? ""] ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Website chat</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Copy this onto your website. Visitors get a chat bubble that answers
          from your docs, shows the source, and asks a person to step in when
          the docs do not cover the question.
        </p>
      </div>

      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      <section className="space-y-3 rounded-lg border border-line bg-card p-5">
        <h2 className="text-sm font-medium">Install</h2>
        <p className="text-sm leading-6 text-muted">
          Paste this before the closing body tag on your site. The key only
          lets visitors ask this workspace a question.
        </p>
        <pre className="overflow-x-auto rounded-md bg-paper px-3 py-2 text-sm break-all whitespace-pre-wrap">
          {snippet}
        </pre>
        <CopySnippet snippet={snippet} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Preview</h2>
        <p className="text-sm leading-6 text-muted">
          This is the chat your visitors will see. Open the bubble to try it.
        </p>
        <iframe
          title="Website chat preview"
          src="/widget-preview"
          className="h-[640px] w-full rounded-lg border border-line bg-card"
        />
      </section>

      <section className="space-y-4 rounded-lg border border-line bg-card p-5">
        <div>
          <h2 className="text-sm font-medium">Appearance</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            The title, greeting, and color show on the chat bubble.
          </p>
        </div>
        {role === "owner" ? (
          <form action={saveWidget} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                maxLength={80}
                defaultValue={settings.title}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="greeting" className="text-sm font-medium">
                Greeting
              </label>
              <textarea
                id="greeting"
                name="greeting"
                required
                maxLength={400}
                rows={3}
                defaultValue={settings.greeting}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="accent" className="text-sm font-medium">
                Color
              </label>
              <input
                id="accent"
                name="accent"
                type="color"
                defaultValue={settings.accent}
                className="h-10 w-16 cursor-pointer rounded-md border border-line bg-paper"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="domains" className="text-sm font-medium">
                Allowed sites
              </label>
              <textarea
                id="domains"
                name="domains"
                rows={4}
                defaultValue={settings.allowedDomains}
                placeholder={"example.com\nhelp.example.com"}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <p className="text-sm leading-6 text-muted">
                Leave this empty to allow the chat on any site. Add one domain
                per line when you want to limit where it runs.
              </p>
            </div>
            <SubmitButton label="Save" pendingLabel="Saving…" />
          </form>
        ) : (
          <p className="text-sm leading-6 text-muted">
            Only the workspace owner can change the website chat.
          </p>
        )}
      </section>
    </div>
  );
}
