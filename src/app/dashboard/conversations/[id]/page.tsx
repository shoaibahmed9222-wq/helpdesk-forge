import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/app/dashboard/knowledge-base/submit-button";
import type { EmailCitation } from "@/lib/email-channel";
import {
  channelLabel,
  contactLabel,
  formatStamp,
  getConversation,
  statusLabel,
  type ThreadMessage,
} from "@/lib/inbox";
import { requireWorkspace } from "@/lib/workspace";

import { sendDraft } from "../actions";
import { reopenConversation, replyToConversation, resolveConversation } from "../../handoffs/actions";

export const metadata = { title: "Conversation · Helpdesk Forge" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const noticeCopy: Record<string, string> = {
  sent: "Reply sent.",
  resolved: "Marked resolved.",
  reopened: "Reopened. A person needs to take this again.",
};

const errorCopy: Record<string, string> = {
  send: "The reply could not be sent. It is still saved here.",
  email: "The reply is in the website chat. The email to the visitor could not be sent.",
  empty: "Write a reply first.",
  missing: "That conversation is not waiting for this.",
};

function speaker(message: ThreadMessage, channel: "email" | "widget") {
  if (message.role === "customer") return "Customer";
  if (message.role === "human") return "Team";
  if (message.delivery === "draft") return "Draft";
  if (message.delivery === "handoff") return "Agent, not sent";
  return channel === "widget" ? "Agent, shown in chat" : "Agent, sent";
}

function Sources({ citations }: { citations: EmailCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <p className="text-sm leading-6 text-muted">
      Sources:{" "}
      {citations.map((citation, index) => (
        <span key={`${citation.chunkId}-${citation.title}`}>
          {index > 0 ? ", " : null}
          {citation.chunkId ? (
            <Link
              href={`/dashboard/knowledge-base/passages/${citation.chunkId}`}
              className="text-accent underline-offset-2 hover:underline"
            >
              {citation.title}
            </Link>
          ) : (
            citation.title
          )}
        </span>
      ))}
    </p>
  );
}

export default async function ConversationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string | string[];
    sent?: string | string[];
    resolved?: string | string[];
    reopened?: string | string[];
  }>;
}) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const conversation = await getConversation(workspace.id, id);
  if (!conversation) notFound();

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
  const canReply = conversation.status === "handoff" || conversation.status === "resolved";
  const draft = conversation.messages.find((message) => message.delivery === "draft");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <p className="text-sm text-muted">
          <Link href="/dashboard/conversations" className="hover:underline">
            Conversations
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{conversation.subject}</h1>
      </div>

      {notice ? <p className="text-sm text-muted">{notice}</p> : null}
      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      <dl className="grid gap-4 rounded-lg border border-line bg-card p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Channel</dt>
          <dd className="mt-1 font-medium">{channelLabel[conversation.channel]}</dd>
        </div>
        <div>
          <dt className="text-muted">Customer</dt>
          <dd className="mt-1 font-medium break-all">{contactLabel(conversation.customerEmail)}</dd>
        </div>
        <div>
          <dt className="text-muted">Status</dt>
          <dd className="mt-1 font-medium">{statusLabel[conversation.status]}</dd>
        </div>
        <div>
          <dt className="text-muted">Updated</dt>
          <dd className="mt-1 font-medium">{formatStamp(conversation.updatedAt)}</dd>
        </div>
      </dl>

      <ol className="space-y-4">
        {conversation.messages.map((message) => (
          <li key={message.id} className="space-y-2 rounded-lg border border-line bg-card p-5">
            <p className="text-xs font-medium text-muted">
              {speaker(message, conversation.channel)}
              {" · "}
              {formatStamp(message.createdAt)}
            </p>
            <p className="text-sm leading-6 whitespace-pre-wrap break-words">{message.body}</p>
            {message.role === "assistant" ? <Sources citations={message.citations} /> : null}
            {message.role === "assistant" && message.confidence ? (
              <p className="text-xs text-muted">
                Internal: {message.confidence === "confident" ? "Confident" : "AI unsure"}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {draft ? (
        <form action={sendDraft}>
          <input type="hidden" name="messageId" value={draft.id} />
          <SubmitButton label="Send reply" pendingLabel="Sending…" />
        </form>
      ) : null}

      {canReply ? (
        <form action={replyToConversation} className="space-y-3 rounded-lg border border-line bg-card p-5">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input type="hidden" name="returnTo" value="conversation" />
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Reply as your team</span>
            <textarea
              name="body"
              required
              rows={4}
              maxLength={5000}
              placeholder="Write the reply the customer should see"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <p className="text-sm leading-6 text-muted">
            {conversation.channel === "email"
              ? "This goes out on the same email thread."
              : conversation.customerEmail.trim()
                ? "This shows in the website chat, and we email the visitor too."
                : "This shows in the website chat. The visitor did not leave an email."}
          </p>
          <SubmitButton label="Send reply" pendingLabel="Sending…" />
        </form>
      ) : null}

      {conversation.status === "handoff" ? (
        <form action={resolveConversation}>
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input type="hidden" name="returnTo" value="conversation" />
          <SubmitButton label="Mark resolved" pendingLabel="Saving…" />
        </form>
      ) : null}

      {conversation.status === "resolved" ? (
        <form action={reopenConversation}>
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input type="hidden" name="returnTo" value="conversation" />
          <SubmitButton label="Reopen" pendingLabel="Saving…" />
        </form>
      ) : null}
    </div>
  );
}
