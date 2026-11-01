import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { conversations, messages, workspaces } from "@/db/schema";
import { answerQuestion } from "@/lib/answer";
import { AnswerError, UNSURE_ANSWER, type AnswerTurn } from "@/lib/answer-types";

export const WIDGET_DEFAULT_TITLE = "Chat with us";
export const WIDGET_DEFAULT_GREETING =
  "Hi. Ask a question and we will answer from our docs.";
export const WIDGET_DEFAULT_ACCENT = "#0e5c56";
export const WIDGET_MAX_CHARS = 2000;

const SESSION =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-fA-F]{6}$/;
const HOSTNAME =
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class WidgetError extends Error {
  constructor(readonly code: "session" | "message" | "email" | "missing") {
    super(code);
  }
}

export type WidgetWorkspace = {
  id: string;
  name: string;
  publicKey: string;
  title: string | null;
  greeting: string | null;
  accent: string | null;
  allowedDomains: string | null;
};

export type WidgetAppearance = {
  title: string;
  greeting: string;
  accent: string;
};

export function widgetAppearance(row: {
  name?: string;
  title: string | null;
  greeting: string | null;
  accent: string | null;
}): WidgetAppearance {
  return {
    title: row.title?.trim() || row.name?.trim() || WIDGET_DEFAULT_TITLE,
    greeting: row.greeting?.trim() || WIDGET_DEFAULT_GREETING,
    accent: row.accent && HEX.test(row.accent) ? row.accent : WIDGET_DEFAULT_ACCENT,
  };
}

export function allowedDomainList(value: string | null) {
  if (!value) return [];
  const hosts: string[] = [];
  for (const part of value.split(/[\s,]+/)) {
    const host = part.trim().toLowerCase().replace(/\.$/, "");
    if (!host || hosts.includes(host)) continue;
    hosts.push(host);
  }
  return hosts;
}

export function parseAllowedDomains(raw: string) {
  const hosts: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    let host = part.trim().toLowerCase();
    if (!host) continue;
    if (host.includes("://")) {
      let url: URL;
      try {
        url = new URL(host);
      } catch {
        return null;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      host = url.hostname.toLowerCase();
    }
    host = host.replace(/\.$/, "");
    if (!HOSTNAME.test(host) || hosts.includes(host)) {
      if (!HOSTNAME.test(host)) return null;
      continue;
    }
    hosts.push(host);
    if (hosts.length > 20) return null;
  }
  return hosts;
}

export async function widgetWorkspace(publicKey: string) {
  if (!publicKey || publicKey.length > 80) return null;
  const [row] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      publicKey: workspaces.publicKey,
      title: workspaces.widgetTitle,
      greeting: workspaces.widgetGreeting,
      accent: workspaces.widgetAccent,
      allowedDomains: workspaces.widgetAllowedDomains,
    })
    .from(workspaces)
    .where(eq(workspaces.publicKey, publicKey))
    .limit(1);
  return row ?? null;
}

export async function getWidgetSettings(workspaceId: string) {
  const row = await widgetById(workspaceId);
  if (!row) throw new Error("Workspace not found.");
  return {
    publicKey: row.publicKey,
    ...widgetAppearance(row),
    allowedDomains: row.allowedDomains ?? "",
  };
}

export async function saveWidgetSettings(
  workspaceId: string,
  input: { title: string; greeting: string; accent: string; domains: string[] },
) {
  await db
    .update(workspaces)
    .set({
      widgetTitle: input.title,
      widgetGreeting: input.greeting,
      widgetAccent: input.accent,
      widgetAllowedDomains: input.domains.length > 0 ? input.domains.join("\n") : null,
    })
    .where(eq(workspaces.id, workspaceId));
}

export function publicWidgetConfig(row: WidgetWorkspace) {
  return widgetAppearance(row);
}

export async function widgetTranscript(workspaceId: string, sessionId: string) {
  assertSession(sessionId);
  const conversation = await findConversation(workspaceId, sessionId);
  if (!conversation) return { messages: [], emailProvided: false };

  const rows = await db
    .select({
      role: messages.role,
      body: messages.body,
      delivery: messages.delivery,
      citations: messages.citations,
    })
    .from(messages)
    .where(
      and(eq(messages.conversationId, conversation.id), eq(messages.workspaceId, workspaceId)),
    )
    .orderBy(asc(messages.createdAt));

  return {
    emailProvided: conversation.customerEmail.length > 0,
    messages: rows.map((row) => ({
      role: row.role,
      body: row.body,
      handoff: row.delivery === "handoff",
      citations: row.role === "assistant" ? citationTitles(row.citations) : [],
    })),
  };
}

export async function askWidget(input: {
  workspaceId: string;
  sessionId: string;
  message: string;
}) {
  assertSession(input.sessionId);
  const question = input.message.trim();
  if (!question || question.length > WIDGET_MAX_CHARS) throw new WidgetError("message");

  const conversation = await loadOrCreate(input.workspaceId, input.sessionId, question);
  const turns = await priorTurns(conversation.id, input.workspaceId);

  let answer;
  try {
    answer = await answerQuestion({
      workspaceId: input.workspaceId,
      question,
      turns,
    });
  } catch (error) {
    if (error instanceof AnswerError && error.code === "question") {
      throw new WidgetError("message");
    }
    throw error;
  }

  const handoff = answer.confidence !== "confident";
  const citations = answer.citations.map((citation) => ({
    chunkId: citation.chunkId,
    title: citation.title,
  }));
  const now = new Date();
  const body = handoff ? UNSURE_ANSWER : answer.answer;

  await db.transaction(async (tx) => {
    await tx.insert(messages).values({
      conversationId: conversation.id,
      workspaceId: input.workspaceId,
      role: "customer",
      body: question,
      delivery: "received",
      createdAt: now,
    });
    await tx.insert(messages).values({
      conversationId: conversation.id,
      workspaceId: input.workspaceId,
      role: "assistant",
      body,
      delivery: handoff ? "handoff" : "sent",
      citations: JSON.stringify(citations),
      createdAt: new Date(now.getTime() + 1),
    });
    await tx
      .update(conversations)
      .set({
        status: handoff || conversation.status === "handoff" ? "handoff" : "answered",
        updatedAt: new Date(now.getTime() + 1),
      })
      .where(
        and(
          eq(conversations.id, conversation.id),
          eq(conversations.workspaceId, input.workspaceId),
        ),
      );
  });

  return {
    answer: body,
    citations: [...new Set(citations.map((citation) => citation.title))],
    handoff,
  };
}

export async function saveWidgetHandoffEmail(input: {
  workspaceId: string;
  sessionId: string;
  email: string;
}) {
  assertSession(input.sessionId);
  const email = input.email.trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL.test(email)) throw new WidgetError("email");

  const [row] = await db
    .update(conversations)
    .set({ customerEmail: email, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.workspaceId, input.workspaceId),
        eq(conversations.visitorSessionId, input.sessionId),
        eq(conversations.channel, "widget"),
        eq(conversations.status, "handoff"),
      ),
    )
    .returning({ id: conversations.id });
  if (!row) throw new WidgetError("missing");
  return { ok: true as const };
}

async function widgetById(workspaceId: string) {
  const [row] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      publicKey: workspaces.publicKey,
      title: workspaces.widgetTitle,
      greeting: workspaces.widgetGreeting,
      accent: workspaces.widgetAccent,
      allowedDomains: workspaces.widgetAllowedDomains,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row ?? null;
}

function assertSession(sessionId: string) {
  if (!SESSION.test(sessionId)) throw new WidgetError("session");
}

async function findConversation(workspaceId: string, sessionId: string) {
  const [row] = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      customerEmail: conversations.customerEmail,
      subject: conversations.subject,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.visitorSessionId, sessionId),
        eq(conversations.channel, "widget"),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function loadOrCreate(workspaceId: string, sessionId: string, question: string) {
  const existing = await findConversation(workspaceId, sessionId);
  if (existing) return existing;

  const subject = question.replaceAll(/\s+/g, " ").trim().slice(0, 120) || "Website chat";
  try {
    const [created] = await db
      .insert(conversations)
      .values({
        workspaceId,
        channel: "widget",
        visitorSessionId: sessionId,
        subject,
        customerEmail: "",
        status: "open",
      })
      .returning({
        id: conversations.id,
        status: conversations.status,
        customerEmail: conversations.customerEmail,
        subject: conversations.subject,
      });
    if (!created) throw new Error("conversation");
    return created;
  } catch (error) {
    if (!isUnique(error)) throw error;
    const again = await findConversation(workspaceId, sessionId);
    if (!again) throw error;
    return again;
  }
}

async function priorTurns(conversationId: string, workspaceId: string) {
  const rows = await db
    .select({ role: messages.role, body: messages.body })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.workspaceId, workspaceId)))
    .orderBy(asc(messages.createdAt));
  const turns: AnswerTurn[] = [];
  for (const row of rows) {
    if (row.role === "customer") turns.push({ role: "user", content: row.body });
    else if (row.role === "assistant") turns.push({ role: "assistant", content: row.body });
  }
  return turns;
}

function citationTitles(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const titles: string[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object" || !("title" in item)) continue;
      if (typeof item.title !== "string") continue;
      const title = item.title.trim();
      if (title && !titles.includes(title)) titles.push(title);
    }
    return titles;
  } catch {
    return [];
  }
}

function isUnique(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUnique(error.cause);
}
