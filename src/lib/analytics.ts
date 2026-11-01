import "server-only";

import { and, asc, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { parseStoredCitations } from "@/lib/email-channel";

export type AnalyticsRange = 7 | 30;

export type DayBucket = {
  key: string;
  label: string;
  email: number;
  widget: number;
};

export type AnalyticsReport = {
  days: AnalyticsRange;
  since: Date;
  total: number;
  email: number;
  widget: number;
  aiResolved: number;
  handoffs: number;
  drafts: number;
  medianReplyMs: number | null;
  humanReplies: number;
  unanswered: { text: string; count: number }[];
  cited: { text: string; count: number }[];
  series: DayBucket[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP = 5;

export function parseRange(value: string | undefined): AnalyticsRange {
  return value === "30" ? 30 : 7;
}

export function formatDuration(ms: number) {
  const secondsTotal = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(secondsTotal / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = secondsTotal % 60;
  if (hours > 0) return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  if (minutes > 0) return `${minutes} min ${seconds} sec`;
  return `${seconds} sec`;
}

export function normalizeQuestion(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function workspaceAnalytics(
  workspaceId: string,
  days: AnalyticsRange,
  now = new Date(),
): Promise<AnalyticsReport> {
  const since = new Date(now.getTime() - days * DAY_MS);
  const rows = await db
    .select({
      conversationId: conversations.id,
      channel: conversations.channel,
      status: conversations.status,
      createdAt: conversations.createdAt,
      role: messages.role,
      body: messages.body,
      delivery: messages.delivery,
      citations: messages.citations,
      messageAt: messages.createdAt,
    })
    .from(conversations)
    .leftJoin(
      messages,
      and(eq(messages.conversationId, conversations.id), eq(messages.workspaceId, workspaceId)),
    )
    .where(and(eq(conversations.workspaceId, workspaceId), gte(conversations.createdAt, since)))
    .orderBy(asc(messages.createdAt));

  type Thread = {
    id: string;
    channel: "email" | "widget";
    status: string;
    createdAt: Date;
    messages: {
      role: string | null;
      body: string | null;
      delivery: string | null;
      citations: string | null;
      messageAt: Date | null;
    }[];
  };

  const threads = new Map<string, Thread>();
  for (const row of rows) {
    let thread = threads.get(row.conversationId);
    if (!thread) {
      thread = {
        id: row.conversationId,
        channel: row.channel,
        status: row.status,
        createdAt: row.createdAt,
        messages: [],
      };
      threads.set(row.conversationId, thread);
    }
    if (row.role && row.messageAt) {
      thread.messages.push({
        role: row.role,
        body: row.body,
        delivery: row.delivery,
        citations: row.citations,
        messageAt: row.messageAt,
      });
    }
  }

  let email = 0;
  let widget = 0;
  let aiResolved = 0;
  let handoffs = 0;
  let drafts = 0;
  const samples: number[] = [];
  const questions = new Map<string, number>();
  const titles = new Map<string, number>();
  const byDay = new Map<string, { email: number; widget: number }>();

  for (const thread of threads.values()) {
    if (thread.channel === "widget") widget += 1;
    else email += 1;

    const day = thread.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { email: 0, widget: 0 };
    if (thread.channel === "widget") bucket.widget += 1;
    else bucket.email += 1;
    byDay.set(day, bucket);

    const hadHandoff = thread.messages.some((message) => message.delivery === "handoff");
    const handedOff = hadHandoff || thread.status === "handoff" || thread.status === "resolved";
    if (handedOff) handoffs += 1;
    else if (thread.status === "answered") aiResolved += 1;
    else if (thread.status === "draft") drafts += 1;

    const human = thread.messages.find((message) => message.role === "human" && message.messageAt);
    if (human?.messageAt) {
      const handoff = thread.messages.find(
        (message) => message.delivery === "handoff" && message.messageAt,
      );
      const start = handoff?.messageAt ?? thread.createdAt;
      const delta = human.messageAt.getTime() - start.getTime();
      if (delta >= 0) samples.push(delta);
    }

    if (handedOff) {
      const handoffAt = thread.messages.find((message) => message.delivery === "handoff")?.messageAt;
      const customers = thread.messages.filter(
        (message) => message.role === "customer" && message.body && message.messageAt,
      );
      const question =
        [...customers].reverse().find((message) => !handoffAt || message.messageAt! <= handoffAt) ??
        customers[0];
      const normalized = normalizeQuestion(question?.body ?? "");
      if (normalized) questions.set(normalized, (questions.get(normalized) ?? 0) + 1);
    }

    for (const message of thread.messages) {
      if (message.role !== "assistant") continue;
      const seen = new Set<string>();
      for (const citation of parseStoredCitations(message.citations)) {
        if (seen.has(citation.title)) continue;
        seen.add(citation.title);
        titles.set(citation.title, (titles.get(citation.title) ?? 0) + 1);
      }
    }
  }

  samples.sort((a, b) => a - b);
  const medianReplyMs =
    samples.length === 0
      ? null
      : samples.length % 2 === 1
        ? samples[(samples.length - 1) / 2]!
        : (samples[samples.length / 2 - 1]! + samples[samples.length / 2]!) / 2;

  const series = chartDays(since, now).map((key) => {
    const bucket = byDay.get(key) ?? { email: 0, widget: 0 };
    return {
      key,
      label: formatDay(key),
      email: bucket.email,
      widget: bucket.widget,
    };
  });

  return {
    days,
    since,
    total: threads.size,
    email,
    widget,
    aiResolved,
    handoffs,
    drafts,
    medianReplyMs,
    humanReplies: samples.length,
    unanswered: topCounts(questions),
    cited: topCounts(titles),
    series,
  };
}

function topCounts(counts: Map<string, number>) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP)
    .map(([text, count]) => ({ text, count }));
}

function chartDays(since: Date, now: Date) {
  const start = Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate());
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const keys: string[] = [];
  for (let time = start; time <= end; time += DAY_MS) {
    keys.push(new Date(time).toISOString().slice(0, 10));
  }
  return keys;
}

function formatDay(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
}
