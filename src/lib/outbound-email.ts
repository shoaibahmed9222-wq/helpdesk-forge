import "server-only";

import nodemailer from "nodemailer";

export function composeReply(answer: string, titles: string[]) {
  const body = answer.trim();
  const unique = [...new Set(titles.map((title) => title.trim()).filter(Boolean))];
  if (unique.length === 0) return body;
  return `${body}\n\n---\nSources: ${unique.join(", ")}`;
}

export function replySubject(subject: string) {
  const clean = subject.replace(/[\r\n]+/g, " ").trim() || "(no subject)";
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

export function formatFrom(name: string, address: string) {
  const safe = name.replace(/[\r\n<>"]/g, "").trim().slice(0, 80) || "Support";
  return `"${safe}" <${address}>`;
}

function createTransport() {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const port = Number(process.env.SMTP_PORT || "587");
  if (!host || !Number.isInteger(port) || port <= 0) {
    throw new Error("smtp_unconfigured");
  }

  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
}

export async function sendOutboundEmail(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  messageId?: string;
  inReplyTo?: string | null;
  references?: string[];
}) {
  const transporter = createTransport();
  try {
    await transporter.sendMail({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      messageId: input.messageId,
      inReplyTo: input.inReplyTo || undefined,
      references:
        input.references && input.references.length > 0 ? input.references.join(" ") : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "smtp_unconfigured") throw error;
    throw new Error("smtp_failed");
  }
}

export async function sendReplyEmail(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string[];
}) {
  await sendOutboundEmail(input);
}
