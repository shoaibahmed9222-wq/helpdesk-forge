import { listEmailThreads } from "@/lib/email-channel";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Handoffs · Helpdesk Forge" };

export default async function HandoffsPage() {
  const { workspace } = await requireWorkspace();
  const threads = await listEmailThreads(workspace.id, "handoff");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Handoffs</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          These conversations were not answered. A person needs to reply.
          Nothing was emailed.
        </p>
      </div>
      {threads.length === 0 ? (
        <p className="text-sm leading-6 text-muted">No handoffs yet.</p>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => {
            const question = [...thread.messages].reverse().find((message) => message.role === "customer");
            return (
              <article key={thread.id} className="space-y-2 rounded-lg border border-line bg-card p-5">
                <h2 className="text-sm font-medium">{thread.subject}</h2>
                <p className="text-sm text-muted">
                  {thread.channel === "widget" ? "Website chat" : "Email"}
                  {" · "}
                  {thread.customerEmail || "No email left"}
                </p>
                <p className="text-sm leading-6 whitespace-pre-wrap break-words">
                  {question?.body ?? "No message text."}
                </p>
                <p className="text-sm text-muted">Nothing was emailed.</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
