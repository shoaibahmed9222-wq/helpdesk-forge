import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { conversations, messages, workspaces } from "@/db/schema";
import { answerQuestion } from "@/lib/answer";
import type { Answer, AnswerTurn } from "@/lib/answer-types";
import {
  normalizeMessageId,
  parseAddress,
  parsePostmarkInbound,
  type InboundMail,
} from "@/lib/inbound-email";
import {
  composeReply,
  formatFrom,
  replySubject,
  sendReplyEmail,
} from "@/lib/outbound-email";

export type EmailCitation = { chunkId: string; title: string };

type WorkspaceHit = {
  id: string;
  name: string;
  slug: string;
  emailReplyMode: "auto" | "draft";
};

type SavedInbound = {
  kind: "saved";
  conversationId: string;
  messageRowId: string;
  created: boolean;
  turns: AnswerTurn[];
};

export function inboundDomain() {
  return (process.env.INBOUND_DOMAIN ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

export function workspaceInboundAddress(slug: string) {
  const domain = inboundDomain();
  if (!domain || !slug) return null;
  return `${slug}@${domain}`;
}

export async function getReplyMode(workspaceId: string) {
  const [row] = await db
    .select({ emailReplyMode: workspaces.emailReplyMode })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row?.emailReplyMode === "auto" ? "auto" : "draft";
}

export async function setReplyMode(workspaceId: string, mode: "auto" | "draft") {
  await db
    .update(workspaces)
    .set({ emailReplyMode: mode })
    .where(eq(workspaces.id, workspaceId));
}

export function sameSecret(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function webhookAuthorized(header: string | null) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret || !header) return false;

  const bearer = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (bearer?.[1]) return sameSecret(bearer[1], secret);

  const basic = /^Basic\s+(\S+)\s*$/i.exec(header);
  if (!basic?.[1]) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(basic[1], "base64").toString("utf8");
  } catch {
    return false;
  }
  const colon = decoded.indexOf(":");
  if (colon < 0) return false;
  return sameSecret(decoded.slice(colon + 1), secret);
}

export async function acceptInbound(raw: unknown) {
  if (!inboundDomain()) return { status: 503, body: { error: "unconfigured" } };

  const mail = parsePostmarkInbound(raw);
  if (!mail) return { status: 400, body: { error: "invalid_body" } };

  const workspace = await workspaceForRecipients(mail.recipients);
  if (!workspace) return { status: 404, body: { error: "unknown_recipient" } };

  const loop = await loopReason(mail);
  if (loop) return { status: 200, body: { ok: true, ignored: loop } };

  const target = mail.replyTo ?? mail.fromEmail;
  if (!parseAddress(target)) return { status: 400, body: { error: "invalid_body" } };

  const saved = await claimInbound(workspace.id, mail, target);
  if (saved.kind === "duplicate") return { status: 200, body: { ok: true, duplicate: true } };
  if (saved.kind === "own") return { status: 200, body: { ok: true, ignored: "own_message" } };

  let answer;
  try {
    answer = await answerQuestion({
      workspaceId: workspace.id,
      question: mail.text,
      turns: saved.turns,
    });
  } catch (error) {
    await rollbackInbound(saved);
    throw error;
  }

  const action = await finishInbound(workspace, mail, target, saved.conversationId, answer);
  return { status: 200, body: { ok: true, action } };
}

export async function sendStoredDraft(workspaceId: string, messageId: string) {
  const [row] = await db
    .select({
      id: messages.id,
      body: messages.body,
      citations: messages.citations,
      inReplyTo: messages.inReplyTo,
      referencesHeader: messages.referencesHeader,
      conversationId: conversations.id,
      subject: conversations.subject,
      customerEmail: conversations.customerEmail,
      name: workspaces.name,
      slug: workspaces.slug,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(workspaces, eq(messages.workspaceId, workspaces.id))
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.workspaceId, workspaceId),
        eq(conversations.workspaceId, workspaceId),
        eq(messages.role, "assistant"),
        eq(messages.delivery, "draft"),
      ),
    )
    .limit(1);
  if (!row?.inReplyTo) return { status: "missing" as const };

  const citations = parseStoredCitations(row.citations);
  const references = splitIds(row.referencesHeader);
  const outboundId = newMessageId();
  const claimed = await db
    .update(messages)
    .set({ delivery: "sent", emailMessageId: outboundId })
    .where(and(eq(messages.id, row.id), eq(messages.workspaceId, workspaceId), eq(messages.delivery, "draft")))
    .returning({ id: messages.id });
  if (claimed.length === 0) return { status: "missing" as const };

  try {
    await deliver({
      name: row.name,
      slug: row.slug,
      to: row.customerEmail,
      subject: row.subject,
      answer: row.body,
      titles: citations.map((citation) => citation.title),
      messageId: outboundId,
      inReplyTo: row.inReplyTo,
      references,
    });
  } catch {
    await db
      .update(messages)
      .set({ delivery: "draft", emailMessageId: null })
      .where(eq(messages.id, row.id));
    return { status: "failed" as const, conversationId: row.conversationId };
  }

  await db
    .update(conversations)
    .set({ status: "answered", updatedAt: new Date() })
    .where(
      and(eq(conversations.id, row.conversationId), eq(conversations.workspaceId, workspaceId)),
    );
  return { status: "sent" as const, conversationId: row.conversationId };
}

function newMessageId() {
  return `<${crypto.randomUUID()}@${inboundDomain() || "localhost"}>`;
}

function joinIds(ids: string[]) {
  return ids.length > 0 ? ids.join(" ") : null;
}

function splitIds(value: string | null) {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((part) => normalizeMessageId(part))
    .filter((id): id is string => Boolean(id));
}

export function parseStoredCitations(value: string | null): EmailCitation[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const title = "title" in item && typeof item.title === "string" ? item.title.trim() : "";
      const chunkId =
        "chunkId" in item && typeof item.chunkId === "string" ? item.chunkId : "";
      if (!title) return [];
      return [{ chunkId, title }];
    });
  } catch {
    return [];
  }
}

function threadReferences(references: string[], parentId: string) {
  const ids = [...references];
  if (!ids.includes(parentId)) ids.push(parentId);
  return ids;
}

async function workspaceForRecipients(recipients: string[]) {
  const domain = inboundDomain();
  const locals: string[] = [];
  const seen = new Set<string>();
  for (const recipient of recipients) {
    const parsed = parseAddress(recipient);
    if (!parsed || parsed.domain !== domain) continue;
    const local = parsed.local.split("+")[0] ?? "";
    if (!local || seen.has(local) || local.length > 48) continue;
    seen.add(local);
    locals.push(local);
  }
  if (locals.length === 0) return null;

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      emailReplyMode: workspaces.emailReplyMode,
    })
    .from(workspaces)
    .where(inArray(workspaces.slug, locals));

  for (const local of locals) {
    const row = rows.find((item) => item.slug === local);
    if (row) return row;
  }
  return null;
}

async function loopReason(mail: InboundMail) {
  const auto = (mail.autoSubmitted ?? "").toLowerCase().trim().split(/[\s;(]/)[0] ?? "";
  if (auto && auto !== "no") return "auto_reply";

  const precedence = (mail.precedence ?? "").toLowerCase();
  if (/\b(bulk|auto_reply|auto-reply)\b/.test(precedence)) return "auto_reply";

  const from = parseAddress(mail.fromEmail);
  const domain = inboundDomain();
  if (!from || from.domain !== domain) return null;
  const local = from.local.split("+")[0] ?? "";
  const [owned] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, local))
    .limit(1);
  return owned ? "own_address" : null;
}

async function claimInbound(
  workspaceId: string,
  mail: InboundMail,
  target: string,
): Promise<SavedInbound | { kind: "duplicate" } | { kind: "own" }> {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ delivery: messages.delivery })
        .from(messages)
        .where(eq(messages.emailMessageId, mail.messageId))
        .limit(1);
      if (existing?.delivery === "sent") return { kind: "own" as const };
      if (existing) return { kind: "duplicate" as const };

      const candidates = [mail.inReplyTo, ...mail.references].filter(
        (id): id is string => Boolean(id),
      );
      let conversationId: string | null = null;
      if (candidates.length > 0) {
        const [hit] = await tx
          .select({ conversationId: messages.conversationId })
          .from(messages)
          .where(
            and(
              eq(messages.workspaceId, workspaceId),
              inArray(messages.emailMessageId, candidates),
            ),
          )
          .limit(1);
        conversationId = hit?.conversationId ?? null;
      }

      let created = false;
      if (!conversationId) {
        const [createdRow] = await tx
          .insert(conversations)
          .values({
            workspaceId,
            subject: mail.subject.replace(/[\r\n]+/g, " ").trim() || "(no subject)",
            customerEmail: target,
            status: "open",
          })
          .returning({ id: conversations.id });
        if (!createdRow) throw new Error("conversation");
        conversationId = createdRow.id;
        created = true;
      } else {
        await tx
          .update(conversations)
          .set({ customerEmail: target, updatedAt: new Date() })
          .where(
            and(eq(conversations.id, conversationId), eq(conversations.workspaceId, workspaceId)),
          );
      }

      const [row] = await tx
        .insert(messages)
        .values({
          conversationId,
          workspaceId,
          role: "customer",
          body: mail.text,
          emailMessageId: mail.messageId,
          inReplyTo: mail.inReplyTo,
          referencesHeader: joinIds(mail.references),
          delivery: "received",
        })
        .returning({ id: messages.id });
      if (!row) throw new Error("message");

      const history = await tx
        .select({
          id: messages.id,
          role: messages.role,
          body: messages.body,
          delivery: messages.delivery,
        })
        .from(messages)
        .where(
          and(eq(messages.conversationId, conversationId), eq(messages.workspaceId, workspaceId)),
        )
        .orderBy(asc(messages.createdAt));

      const turns: AnswerTurn[] = [];
      for (const item of history) {
        if (item.id === row.id) continue;
        if (item.role === "customer" && item.delivery === "received") {
          turns.push({ role: "user", content: item.body });
        } else if (item.role === "human" || (item.role === "assistant" && item.delivery === "sent")) {
          turns.push({ role: "assistant", content: item.body });
        }
      }

      return {
        kind: "saved" as const,
        conversationId,
        messageRowId: row.id,
        created,
        turns,
      };
    });
  } catch (error) {
    if (isUnique(error)) return { kind: "duplicate" };
    throw error;
  }
}

async function rollbackInbound(saved: SavedInbound) {
  await db.delete(messages).where(eq(messages.id, saved.messageRowId));
  if (saved.created) {
    await db.delete(conversations).where(eq(conversations.id, saved.conversationId));
  }
}

async function finishInbound(
  workspace: WorkspaceHit,
  mail: InboundMail,
  target: string,
  conversationId: string,
  answer: Answer,
) {
  const citations = answer.citations.map((citation) => ({
    chunkId: citation.chunkId,
    title: citation.title,
  }));
  const references = threadReferences(mail.references, mail.messageId);
  const titles = [...new Set(citations.map((citation) => citation.title))];

  if (answer.confidence !== "confident") {
    await storeAssistant({
      workspaceId: workspace.id,
      conversationId,
      body: answer.answer,
      delivery: "handoff",
      confidence: answer.confidence,
      citations,
      inReplyTo: mail.messageId,
      references,
      emailMessageId: null,
      status: "handoff",
    });
    return "handoff";
  }

  if (workspace.emailReplyMode !== "auto") {
    await storeAssistant({
      workspaceId: workspace.id,
      conversationId,
      body: answer.answer,
      delivery: "draft",
      confidence: answer.confidence,
      citations,
      inReplyTo: mail.messageId,
      references,
      emailMessageId: null,
      status: "draft",
    });
    return "draft";
  }

  const outboundId = newMessageId();
  try {
    await deliver({
      name: workspace.name,
      slug: workspace.slug,
      to: target,
      subject: mail.subject,
      answer: answer.answer,
      titles,
      messageId: outboundId,
      inReplyTo: mail.messageId,
      references,
    });
  } catch {
    console.error("outbound email failed");
    await storeAssistant({
      workspaceId: workspace.id,
      conversationId,
      body: answer.answer,
      delivery: "draft",
      confidence: answer.confidence,
      citations,
      inReplyTo: mail.messageId,
      references,
      emailMessageId: null,
      status: "draft",
    });
    return "draft";
  }

  await storeAssistant({
    workspaceId: workspace.id,
    conversationId,
    body: answer.answer,
    delivery: "sent",
    confidence: answer.confidence,
    citations,
    inReplyTo: mail.messageId,
    references,
    emailMessageId: outboundId,
    status: "answered",
  });
  return "sent";
}

async function deliver(input: {
  name: string;
  slug: string;
  to: string;
  subject: string;
  answer: string;
  titles: string[];
  messageId: string;
  inReplyTo: string;
  references: string[];
}) {
  const address = workspaceInboundAddress(input.slug);
  if (!address) throw new Error("smtp_unconfigured");
  await sendReplyEmail({
    from: formatFrom(input.name, address),
    to: input.to,
    subject: replySubject(input.subject),
    text: composeReply(input.answer, input.titles),
    messageId: input.messageId,
    inReplyTo: input.inReplyTo,
    references: input.references,
  });
}

async function storeAssistant(input: {
  workspaceId: string;
  conversationId: string;
  body: string;
  delivery: "sent" | "draft" | "handoff";
  confidence: "confident" | "unsure";
  citations: EmailCitation[];
  inReplyTo: string;
  references: string[];
  emailMessageId: string | null;
  status: "answered" | "draft" | "handoff";
}) {
  await db.insert(messages).values({
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    role: "assistant",
    body: input.body,
    emailMessageId: input.emailMessageId,
    inReplyTo: input.inReplyTo,
    referencesHeader: joinIds(input.references),
    delivery: input.delivery,
    confidence: input.confidence,
    citations: JSON.stringify(input.citations),
  });
  await db
    .update(conversations)
    .set({ status: input.status, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, input.conversationId),
        eq(conversations.workspaceId, input.workspaceId),
      ),
    );
}

function isUnique(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUnique(error.cause);
}
