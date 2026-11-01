import Link from "next/link";

import {
  PAGE_SIZE,
  channelLabel,
  contactLabel,
  formatStamp,
  listConversations,
  parseChannel,
  parseStatus,
  statusLabel,
} from "@/lib/inbox";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Conversations · Helpdesk Forge" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumber(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    channel?: string | string[];
    status?: string | string[];
    q?: string | string[];
    page?: string | string[];
    error?: string | string[];
  }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const channel = parseChannel(first(params.channel));
  const status = parseStatus(first(params.status));
  const query = first(params.q)?.trim().slice(0, 200) ?? "";
  const error = first(params.error) === "draft" ? "That draft is no longer waiting to be sent." : null;
  const listed = await listConversations(workspace.id, {
    channel,
    status,
    query,
    page: pageNumber(first(params.page)),
  });

  const from = listed.total === 0 ? 0 : (listed.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(listed.page * PAGE_SIZE, listed.total);

  function href(page: number) {
    const next = new URLSearchParams();
    if (channel) next.set("channel", channel);
    if (status) next.set("status", status);
    if (query) next.set("q", query);
    if (page > 1) next.set("page", String(page));
    const search = next.toString();
    return search ? `/dashboard/conversations?${search}` : "/dashboard/conversations";
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Email and website chat for this workspace, newest first. Open one to
          read the full thread.
        </p>
      </div>

      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      <form method="get" className="grid gap-3 rounded-lg border border-line bg-card p-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Channel</span>
          <select
            name="channel"
            defaultValue={channel ?? ""}
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">All channels</option>
            <option value="email">Email</option>
            <option value="widget">Website chat</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Status</span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">All statuses</option>
            <option value="answered">Answered by the agent</option>
            <option value="handoff">Needs a person</option>
            <option value="draft">Draft</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="space-y-2 text-sm sm:col-span-2">
          <span className="font-medium">Search</span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Customer email or message"
            maxLength={200}
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </form>

      <p className="text-sm text-muted" data-conversation-total={listed.total}>
        {listed.total === 0 ? "No conversations match." : `Showing ${from}–${to} of ${listed.total}.`}
      </p>

      {listed.rows.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
          {listed.rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/conversations/${row.id}`}
                className="block px-5 py-4 hover:bg-paper"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{row.subject}</span>
                  <span className="text-xs font-medium text-muted">{statusLabel[row.status]}</span>
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {channelLabel[row.channel]}
                  {" · "}
                  {contactLabel(row.customerEmail)}
                  {" · "}
                  {formatStamp(row.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {listed.pageCount > 1 ? (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {listed.page > 1 ? (
            <Link href={href(listed.page - 1)} className="text-accent underline-offset-2 hover:underline">
              Previous
            </Link>
          ) : (
            <span className="text-muted">Previous</span>
          )}
          <span className="text-muted">
            Page {listed.page} of {listed.pageCount}
          </span>
          {listed.page < listed.pageCount ? (
            <Link href={href(listed.page + 1)} className="text-accent underline-offset-2 hover:underline">
              Next
            </Link>
          ) : (
            <span className="text-muted">Next</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
