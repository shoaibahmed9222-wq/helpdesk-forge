import "server-only";

import { and, asc, count, desc, eq, exists, ilike, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import { conversations, messages, workspaces } from "@/db/schema";
import {
  inboundDomain,
  parseStoredCitations,
  workspaceInboundAddress,
  type EmailCitation,
} from "@/lib/email-channel";
import { normalizeMessageId } from "@/lib/inbound-email";
import { composeReply, formatFrom, replySubject, sendReplyEmail } from "@/lib/outbound-email";

export const PAGE_SIZE = 10;

export const statusLabel: Record<ConversationStatus, string> = {
  open: "In progress",
  answered: "Answered by the agent",
  draft: "Draft",
  handoff: "Needs a person",
  resolved: "Resolved",
};

export const channelLabel = {
  email: "Email",
  widget: "Website chat",
} as const;

export function contactLabel(email: string) {
  const trimmed = email.trim();
  return trimmed || "No email left";
}

export function formatStamp(date: Date) {
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPLY_MAX = 5000;

export type ConversationStatus = "open" | "answered" | "draft" | "handoff" | "resolved";
export type ConversationChannel = "email" | "widget";

export type ConversationFilters = {
  channel?: ConversationChannel;
  status?: ConversationStatus;
  query?: string;
  page?: number;
};

export type ConversationSummary = {
  id: string;
  channel: ConversationChannel;
  subject: string;
  customerEmail: string;
  status: ConversationStatus;
  updatedAt: Date;
};

export type ThreadMessage = {
  id: string;
  role: "customer" | "assistant" | "human";
  body: string;
  delivery: "received" | "sent" | "draft" | "handoff";
  confidence: "confident" | "unsure" | null;
  citations: EmailCitation[];
  emailMessageId: string | null;
  createdAt: Date;
};

export type ConversationDetail = ConversationSummary & {
  createdAt: Date;
  messages: ThreadMessage[];
};

export type HandoffCard = ConversationSummary & {
  question: string;
  agentReply: string;
  citations: EmailCitation[];
  humanReplies: { id: string; body: string; createdAt: Date }[];
};

const STATUSES = new Set<ConversationStatus>(["open", "answered", "draft", "handoff", "resolved"]);
const CHANNELS = new Set<ConversationChannel>(["email", "widget"]);

export function parseStatus(value: string | undefined): ConversationStatus | undefined {
  if (!value || !STATUSES.has(value as ConversationStatus)) return undefined;
  return value as ConversationStatus;
}

export function parseChannel(value: string | undefined): ConversationChannel | undefined {
  if (!value || !CHANNELS.has(value as ConversationChannel)) return undefined;
  return value as ConversationChannel;
}

function likePattern(raw: string) {
  return `%${raw.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim()}%`;
}

function whereFilters(workspaceId: string, filters: ConversationFilters) {
  const query = filters.query?.trim().slice(0, 200) ?? "";
  const pattern = query ? likePattern(query) : "";
  return and(
    eq(conversations.workspaceId, workspaceId),
    filters.channel ? eq(conversations.channel, filters.channel) : undefined,
    filters.status ? eq(conversations.status, filters.status) : undefined,
    pattern
      ? or(
          ilike(conversations.customerEmail, pattern),
          exists(
            db
              .select({ id: messages.id })
              .from(messages)
              .where(
                and(
                  eq(messages.conversationId, conversations.id),
                  eq(messages.workspaceId, workspaceId),
                  eq(messages.role, "customer"),
                  ilike(messages.body, pattern),
                ),
              ),
          ),
        )
      : undefined,
  );
}

export async function listConversations(workspaceId: string, filters: ConversationFilters) {
  const where = whereFilters(workspaceId, filters);
  const [totalRow] = await db.select({ value: count() }).from(conversations).where(where);
  const total = Number(totalRow?.value ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number.isInteger(filters.page) && filters.page && filters.page > 0 ? filters.page : 1;
  const page = Math.min(requested, pageCount);
  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      subject: conversations.subject,
      customerEmail: conversations.customerEmail,
      status: conversations.status,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.updatedAt), desc(conversations.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return { rows, total, page, pageCount };
}

export async function getConversation(workspaceId: string, conversationId: string) {
  const [row] = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      subject: conversations.subject,
      customerEmail: conversations.customerEmail,
      status: conversations.status,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.workspaceId, workspaceId)))
    .limit(1);
  if (!row) return null;

  const messageRows = await db
    .select({
      id: messages.id,
      role: messages.role,
      body: messages.body,
      delivery: messages.delivery,
      confidence: messages.confidence,
      citations: messages.citations,
      emailMessageId: messages.emailMessageId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(eq(messages.conversationId, row.id), eq(messages.workspaceId, workspaceId)))
    .orderBy(asc(messages.createdAt));

  const detail: ConversationDetail = {
    ...row,
    messages: messageRows.map((message) => ({
      id: message.id,
      role: message.role,
      body: message.body,
      delivery: message.delivery,
      confidence: message.confidence,
      citations: parseStoredCitations(message.citations),
      emailMessageId: message.emailMessageId,
      createdAt: message.createdAt,
    })),
  };
  return detail;
}

export async function countOpenHandoffs(workspaceId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(conversations)
    .where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.status, "handoff")));
  return Number(row?.value ?? 0);
}

export async function listHandoffs(workspaceId: string): Promise<HandoffCard[]> {
  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      subject: conversations.subject,
      customerEmail: conversations.customerEmail,
      status: conversations.status,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        inArray(conversations.status, ["handoff", "resolved"]),
      ),
    );

  if (rows.length === 0) return [];
  const messageRows = await db
    .select({
      conversationId: messages.conversationId,
      id: messages.id,
      role: messages.role,
      body: messages.body,
      citations: messages.citations,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.workspaceId, workspaceId),
        inArray(
          messages.conversationId,
          rows.map((row) => row.id),
        ),
      ),
    )
    .orderBy(asc(messages.createdAt));

  const byConversation = new Map<string, typeof messageRows>();
  for (const message of messageRows) {
    const list = byConversation.get(message.conversationId) ?? [];
    list.push(message);
    byConversation.set(message.conversationId, list);
  }

  const cards = rows.map((row) => {
    const thread = byConversation.get(row.id) ?? [];
    const question = [...thread].reverse().find((message) => message.role === "customer");
    const agent = [...thread].reverse().find((message) => message.role === "assistant");
    return {
      ...row,
      question: question?.body ?? "No message text.",
      agentReply: agent?.body ?? "The agent did not leave a reply.",
      citations: parseStoredCitations(agent?.citations ?? null),
      humanReplies: thread
        .filter((message) => message.role === "human")
        .map((message) => ({ id: message.id, body: message.body, createdAt: message.createdAt })),
    };
  });

  cards.sort((a, b) => {
    const rank = (status: ConversationStatus) => (status === "handoff" ? 0 : 1);
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  return cards;
}

export type ReplyResult = "sent" | "email_failed" | "missing" | "failed" | "empty";

export async function replyToHandoff(
  workspaceId: string,
  conversationId: string,
  rawBody: string,
): Promise<ReplyResult> {
  const body = rawBody.trim();
  if (!body || body.length > REPLY_MAX) return "empty";

  const [conversation] = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      subject: conversations.subject,
      customerEmail: conversations.customerEmail,
      status: conversations.status,
      name: workspaces.name,
      slug: workspaces.slug,
    })
    .from(conversations)
    .innerJoin(workspaces, eq(conversations.workspaceId, workspaces.id))
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, workspaceId),
        eq(workspaces.id, workspaceId),
      ),
    )
    .limit(1);
  if (!conversation) return "missing";
  if (conversation.status !== "handoff" && conversation.status !== "resolved") return "missing";

  const history = await db
    .select({
      role: messages.role,
      emailMessageId: messages.emailMessageId,
      referencesHeader: messages.referencesHeader,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(eq(messages.conversationId, conversation.id), eq(messages.workspaceId, workspaceId)))
    .orderBy(asc(messages.createdAt));

  const anchored = history.filter((message) => message.emailMessageId);
  const anchor =
    [...anchored].reverse().find((message) => message.role === "customer") ?? anchored.at(-1) ?? null;

  if (conversation.channel === "email") {
    if (!anchor?.emailMessageId) return "failed";
    const sent = await sendHumanEmail({
      name: conversation.name,
      slug: conversation.slug,
      to: conversation.customerEmail,
      subject: conversation.subject,
      body,
      inReplyTo: anchor.emailMessageId,
      references: threadReferences(anchor.referencesHeader, anchor.emailMessageId),
    });
    if (!sent) return "failed";
    await storeHumanMessage({
      workspaceId,
      conversationId: conversation.id,
      body,
      emailMessageId: sent.messageId,
      inReplyTo: anchor.emailMessageId,
      references: sent.references,
    });
    return "sent";
  }

  const messageId = await storeHumanMessage({
    workspaceId,
    conversationId: conversation.id,
    body,
    emailMessageId: null,
    inReplyTo: null,
    references: [],
  });
  const visitor = conversation.customerEmail.trim().toLowerCase();
  if (!visitor || !EMAIL.test(visitor)) return "sent";

  const sent = await sendHumanEmail({
    name: conversation.name,
    slug: conversation.slug,
    to: visitor,
    subject: conversation.subject,
    body,
    inReplyTo: null,
    references: [],
  });
  if (!sent) return "email_failed";
  await db
    .update(messages)
    .set({ emailMessageId: sent.messageId })
    .where(and(eq(messages.id, messageId), eq(messages.workspaceId, workspaceId)));
  return "sent";
}

export async function setHandoffState(
  workspaceId: string,
  conversationId: string,
  next: "resolved" | "handoff",
) {
  const expected = next === "resolved" ? "handoff" : "resolved";
  const updated = await db
    .update(conversations)
    .set({ status: next, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.status, expected),
      ),
    )
    .returning({ id: conversations.id });
  return updated.length > 0 ? "ok" : "missing";
}

function threadReferences(referencesHeader: string | null, parentId: string) {
  const ids = (referencesHeader ?? "")
    .split(/\s+/)
    .map((part) => normalizeMessageId(part))
    .filter((id): id is string => Boolean(id));
  if (!ids.includes(parentId)) ids.push(parentId);
  return ids;
}

function newMessageId() {
  return `<${crypto.randomUUID()}@${inboundDomain() || "localhost"}>`;
}

async function sendHumanEmail(input: {
  name: string;
  slug: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo: string | null;
  references: string[];
}) {
  const address = workspaceInboundAddress(input.slug);
  if (!address || !input.to) return null;
  const messageId = newMessageId();
  try {
    await sendReplyEmail({
      from: formatFrom(input.name, address),
      to: input.to,
      subject: replySubject(input.subject),
      text: composeReply(input.body, []),
      messageId,
      inReplyTo: input.inReplyTo,
      references: input.references,
    });
  } catch {
    return null;
  }
  return { messageId, references: input.references };
}

async function storeHumanMessage(input: {
  workspaceId: string;
  conversationId: string;
  body: string;
  emailMessageId: string | null;
  inReplyTo: string | null;
  references: string[];
}) {
  const [row] = await db
    .insert(messages)
    .values({
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      role: "human",
      body: input.body,
      emailMessageId: input.emailMessageId,
      inReplyTo: input.inReplyTo,
      referencesHeader: input.references.length > 0 ? input.references.join(" ") : null,
      delivery: "sent",
    })
    .returning({ id: messages.id });
  if (!row) throw new Error("message");
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(
      and(eq(conversations.id, input.conversationId), eq(conversations.workspaceId, input.workspaceId)),
    );
  return row.id;
}
