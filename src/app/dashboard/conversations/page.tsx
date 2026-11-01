import Link from "next/link";

import { listEmailThreads, type EmailCitation } from "@/lib/email-channel";
import { requireWorkspace } from "@/lib/workspace";

import { sendDraft } from "./actions";
import { SubmitButton } from "../knowledge-base/submit-button";

export const metadata = { title: "Conversations · Helpdesk Forge" };

const errorCopy: Record<string, string> = {
  draft: "That draft is no longer waiting to be sent.",
  send: "The reply could not be sent. It is still saved here.",
};

const statusLabel = {
  open: "Open",
  answered: "Replied",
  draft: "Draft ready",
  handoff: "Needs a person",
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; sent?: string | string[] }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const error = errorCopy[first(params.error) ?? ""] ?? null;
  const sent = first(params.sent) === "1";
  const threads = await listEmailThreads(workspace.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Email threads for this workspace. A draft stays here until someone
          sends it.
        </p>
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {sent ? <p className="text-sm text-muted">Reply sent.</p> : null}
      {threads.length === 0 ? (
        <p className="text-sm leading-6 text-muted">No conversations yet.</p>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <article key={thread.id} className="space-y-4 rounded-lg border border-line bg-card p-5">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-medium">{thread.subject}</h2>
                  <p className="text-xs font-medium text-muted">{statusLabel[thread.status]}</p>
                </div>
                <p className="mt-1 text-sm text-muted">{thread.customerEmail}</p>
              </div>
              <div className="space-y-4">
                {thread.messages.map((message) => (
                  <div key={message.id} className="space-y-2">
                    <p className="text-xs font-medium text-muted">
                      {message.role === "customer"
                        ? "Customer"
                        : message.delivery === "draft"
                          ? "Draft"
                          : message.delivery === "handoff"
                            ? "Not sent"
                            : "Sent"}
                    </p>
                    <p className="text-sm leading-6 whitespace-pre-wrap break-words">{message.body}</p>
                    {message.role === "assistant" ? <Sources citations={message.citations} /> : null}
                    {message.delivery === "draft" ? (
                      <form action={sendDraft}>
                        <input type="hidden" name="messageId" value={message.id} />
                        <SubmitButton label="Send reply" pendingLabel="Sending…" />
                      </form>
                    ) : null}
                    {message.delivery === "handoff" ? (
                      <p className="text-sm text-muted">
                        Nothing was emailed. A person needs to take this.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
