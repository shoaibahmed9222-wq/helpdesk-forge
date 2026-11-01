import Link from "next/link";

import { formatDuration, parseRange, workspaceAnalytics } from "@/lib/analytics";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Analytics · Helpdesk Forge" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatSince(date: Date) {
  return (
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { workspace } = await requireWorkspace();
  const days = parseRange(first((await searchParams).range));
  const report = await workspaceAnalytics(workspace.id, days);
  const max = Math.max(1, ...report.series.map((day) => day.email + day.widget));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          This workspace since {formatSince(report.since)}. Counts are conversations
          started in that window.
        </p>
      </div>

      <div className="flex gap-2 text-sm">
        <Link
          href="/dashboard/analytics?range=7"
          aria-current={days === 7 ? "page" : undefined}
          className={`rounded-md px-3 py-2 ${days === 7 ? "bg-accent text-accent-ink" : "border border-line bg-card"}`}
        >
          Last 7 days
        </Link>
        <Link
          href="/dashboard/analytics?range=30"
          aria-current={days === 30 ? "page" : undefined}
          className={`rounded-md px-3 py-2 ${days === 30 ? "bg-accent text-accent-ink" : "border border-line bg-card"}`}
        >
          Last 30 days
        </Link>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-card p-5">
          <dt className="text-sm text-muted">Conversations</dt>
          <dd className="mt-2 text-3xl font-semibold tracking-tight" data-metric="total">
            {report.total}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <dt className="text-sm text-muted">By channel</dt>
          <dd className="mt-2 text-sm leading-6">
            <span data-metric="email">{report.email}</span> email
            <span className="text-muted"> · </span>
            <span data-metric="widget">{report.widget}</span> website chat
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <dt className="text-sm text-muted">Answered by the agent</dt>
          <dd className="mt-2 text-sm leading-6">
            <span className="text-3xl font-semibold tracking-tight" data-metric="ai-resolved">
              {report.aiResolved}
            </span>{" "}
            of {report.total}
          </dd>
          <p className="mt-2 text-sm leading-6 text-muted">
            The agent answered, and the conversation was not handed to a person.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <dt className="text-sm text-muted">Handed to a person</dt>
          <dd className="mt-2 text-sm leading-6">
            <span className="text-3xl font-semibold tracking-tight" data-metric="handoffs">
              {report.handoffs}
            </span>{" "}
            of {report.total}
          </dd>
          <p className="mt-2 text-sm leading-6 text-muted">
            Includes conversations a person already resolved.
            {report.drafts > 0 ? ` ${report.drafts} still have a draft waiting.` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5 sm:col-span-2">
          <dt className="text-sm text-muted">Median time to first reply from a person</dt>
          <dd className="mt-2 text-3xl font-semibold tracking-tight" data-metric="median">
            {report.medianReplyMs === null ? "No replies yet" : formatDuration(report.medianReplyMs)}
          </dd>
          <p className="mt-2 text-sm leading-6 text-muted">
            {report.humanReplies === 0
              ? "No one on the team has replied in this period."
              : `From the handoff to the first team reply, across ${report.humanReplies} ${report.humanReplies === 1 ? "conversation" : "conversations"}.`}
          </p>
        </div>
      </dl>

      <section className="space-y-4 rounded-lg border border-line bg-card p-5">
        <h2 className="text-sm font-medium">Conversations started each day</h2>
        <ul className="space-y-2">
          {report.series.map((day) => {
            const total = day.email + day.widget;
            const emailWidth = (day.email / max) * 100;
            const widgetWidth = (day.widget / max) * 100;
            return (
              <li key={day.key} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="text-muted">{day.label}</span>
                <span className="flex h-3 overflow-hidden rounded-full bg-paper" aria-hidden="true">
                  <span className="h-full bg-accent" style={{ width: `${emailWidth}%` }} />
                  <span className="h-full bg-ink/25" style={{ width: `${widgetWidth}%` }} />
                </span>
                <span className="text-muted">
                  {total} · {day.email} email, {day.widget} chat
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">Dark green is email. Gray is website chat.</p>
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-card p-5">
        <h2 className="text-sm font-medium">Questions a person had to take</h2>
        {report.unanswered.length === 0 ? (
          <p className="text-sm leading-6 text-muted">No handoffs in this period.</p>
        ) : (
          <ol className="space-y-2 text-sm leading-6">
            {report.unanswered.map((item) => (
              <li key={item.text} className="flex justify-between gap-4">
                <span>{item.text}</span>
                <span className="font-medium">{item.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-card p-5">
        <h2 className="text-sm font-medium">Docs the agent cited most</h2>
        {report.cited.length === 0 ? (
          <p className="text-sm leading-6 text-muted">No citations in this period.</p>
        ) : (
          <ol className="space-y-2 text-sm leading-6">
            {report.cited.map((item) => (
              <li key={item.text} className="flex justify-between gap-4">
                <span>{item.text}</span>
                <span className="font-medium">{item.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
