import Link from "next/link";

import { SubmitButton } from "@/app/dashboard/knowledge-base/submit-button";
import { channelLabel, contactLabel, formatStamp, listHandoffs, statusLabel } from "@/lib/inbox";
import { requireWorkspace } from "@/lib/workspace";

import { reopenConversation, replyToConversation, resolveConversation } from "./actions";

export const metadata = { title: "Handoffs · Helpdesk Forge" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const noticeCopy: Record<string, string> = {
  sent: "Reply sent.",
  resolved: "Marked resolved.",
  reopened: "Reopened.",
};

const errorCopy: Record<string, string> = {
  send: "The reply could not be sent.",
  email: "The reply is in the website chat. The email to the visitor could not be sent.",
  empty: "Write a reply first.",
  missing: "That conversation is not waiting for this.",
};

export default async function HandoffsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    sent?: string | string[];
    resolved?: string | string[];
    reopened?: string | string[];
  }>;
}) {
  const { workspace } = await requireWorkspace();
  const query = await searchParams;
  const noticeKey = first(query.sent) === "1"
    ? "sent"
    : first(query.resolved) === "1"
      ? "resolved"
      : first(query.reopened) === "1"
        ? "reopened"
        : "";
  const notice = noticeCopy[noticeKey] ?? null;
  const error = errorCopy[first(query.error) ?? ""] ?? null;
  const cards = await listHandoffs(workspace.id);
  const openCount = cards.filter((card) => card.status === "handoff").length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Handoffs</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Conversations the agent could not answer. Open ones are first.
          {openCount > 0 ? ` ${openCount} need a person.` : " None are waiting."}
        </p>
      </div>

      {notice ? <p className="text-sm text-muted">{notice}</p> : null}
      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      {cards.length === 0 ? (
        <p className="text-sm leading-6 text-muted">No handoffs yet.</p>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <article key={card.id} className="space-y-4 rounded-lg border border-line bg-card p-5">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-medium">{card.subject}</h2>
                  <p className="text-xs font-medium text-muted">{statusLabel[card.status]}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {channelLabel[card.channel]}
                  {" · "}
                  {contactLabel(card.customerEmail)}
                  {" · "}
                  {formatStamp(card.updatedAt)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Customer</p>
                <p className="text-sm leading-6 whitespace-pre-wrap break-words">{card.question}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Agent</p>
                <p className="text-sm leading-6 whitespace-pre-wrap break-words">{card.agentReply}</p>
                {card.citations.length > 0 ? (
                  <p className="text-sm text-muted">
                    Sources: {card.citations.map((citation) => citation.title).join(", ")}
                  </p>
                ) : null}
              </div>
              {card.humanReplies.map((reply) => (
                <div key={reply.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted">Team · {formatStamp(reply.createdAt)}</p>
                  <p className="text-sm leading-6 whitespace-pre-wrap break-words">{reply.body}</p>
                </div>
              ))}
              <form action={replyToConversation} className="space-y-3">
                <input type="hidden" name="conversationId" value={card.id} />
                <label className="block space-y-2 text-sm">
                  <span className="font-medium">Reply</span>
                  <textarea
                    name="body"
                    required
                    rows={3}
                    maxLength={5000}
                    placeholder="Write the reply the customer should see"
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </label>
                <SubmitButton label="Send reply" pendingLabel="Sending…" />
              </form>
              <div className="flex flex-wrap items-center gap-4">
                {card.status === "handoff" ? (
                  <form action={resolveConversation}>
                    <input type="hidden" name="conversationId" value={card.id} />
                    <SubmitButton label="Mark resolved" pendingLabel="Saving…" />
                  </form>
                ) : (
                  <form action={reopenConversation}>
                    <input type="hidden" name="conversationId" value={card.id} />
                    <SubmitButton label="Reopen" pendingLabel="Saving…" />
                  </form>
                )}
                <Link
                  href={`/dashboard/conversations/${card.id}`}
                  className="text-sm text-accent underline-offset-2 hover:underline"
                >
                  Open conversation
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
