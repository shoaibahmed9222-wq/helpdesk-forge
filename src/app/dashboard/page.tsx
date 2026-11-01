import Link from "next/link";

import { getReplyMode, workspaceInboundAddress } from "@/lib/email-channel";
import { requireWorkspace } from "@/lib/workspace";

export default async function DashboardPage() {
  const { workspace } = await requireWorkspace();
  const address = workspaceInboundAddress(workspace.slug);
  const replyMode = await getReplyMode(workspace.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your AI support agent</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Forward or CC your support inbox to this address. Replies stay on the
          same email thread.
        </p>
      </div>
      <section className="space-y-3 rounded-lg border border-line bg-card p-5">
        <h2 className="text-sm font-medium">Inbound address</h2>
        {address ? (
          <p className="break-all rounded-md bg-paper px-3 py-2 font-mono text-sm">{address}</p>
        ) : (
          <p className="text-sm leading-6 text-muted">
            Your inbound address is not ready yet. The person who runs Helpdesk
            Forge still needs to finish email setup.
          </p>
        )}
        <p className="text-sm leading-6 text-muted">
          {replyMode === "auto"
            ? "Auto-reply when confident is on."
            : "Draft only is on. A person sends each reply."}{" "}
          Questions your docs do not cover wait under{" "}
          <Link href="/dashboard/handoffs" className="text-accent underline-offset-2 hover:underline">
            Handoffs
          </Link>
          . Change this in{" "}
          <Link href="/dashboard/settings" className="text-accent underline-offset-2 hover:underline">
            Settings
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
