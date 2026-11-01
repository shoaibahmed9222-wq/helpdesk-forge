// Postmark inbound webhook JSON:
// https://postmarkapp.com/developer/webhooks/inbound-webhook

export type InboundMail = {
  messageId: string;
  fromEmail: string;
  replyTo: string | null;
  recipients: string[];
  subject: string;
  text: string;
  inReplyTo: string | null;
  references: string[];
  autoSubmitted: string | null;
  precedence: string | null;
};

const TEXT_CAP = 20_000;

export function parseAddress(value: string) {
  const trimmed = value.trim();
  const angle = trimmed.match(/<([^<>\s]+)>/);
  const candidate = (angle?.[1] ?? trimmed).trim().toLowerCase();
  const match = /^([^@\s<>"]+)@([^@\s<>"]+)$/.exec(candidate);
  if (!match) return null;
  const local = match[1] ?? "";
  const domain = match[2] ?? "";
  if (!local || !domain || local.length > 64 || domain.length > 255) return null;
  return { local, domain, email: `${local}@${domain}` };
}

export function normalizeMessageId(value: string) {
  const trimmed = value.trim().replace(/^<|>$/g, "").trim();
  if (!trimmed || trimmed.length > 500 || /[\s<>]/.test(trimmed)) return null;
  return `<${trimmed}>`;
}

function text(value: unknown, cap = TEXT_CAP) {
  if (typeof value !== "string") return "";
  return value.replaceAll("\0", "").trim().slice(0, cap);
}

function header(headers: unknown, name: string) {
  if (!Array.isArray(headers)) return null;
  const found = headers.find((item) => {
    if (!item || typeof item !== "object" || !("Name" in item)) return false;
    return String(item.Name).toLowerCase() === name.toLowerCase();
  }) as { Value?: unknown } | undefined;
  const value = text(found?.Value, 2000);
  return value || null;
}

function addressesFromFull(value: unknown) {
  if (!Array.isArray(value)) return [];
  const found: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || !("Email" in item)) continue;
    const parsed = parseAddress(String(item.Email));
    if (parsed) found.push(parsed.email);
  }
  return found;
}

function addressesFromRaw(value: unknown) {
  const raw = text(value, 4000);
  if (!raw) return [];
  const found: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const parsed = parseAddress(part);
    if (parsed) found.push(parsed.email);
  }
  return found;
}

function htmlToText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TEXT_CAP);
}

function messageIds(value: string | null) {
  if (!value) return [];
  const ids: string[] = [];
  for (const part of value.split(/\s+/)) {
    const id = normalizeMessageId(part);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function parsePostmarkInbound(body: unknown): InboundMail | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const headers = record.Headers;

  const messageId =
    normalizeMessageId(header(headers, "Message-ID") ?? "") ??
    normalizeMessageId(text(record.MessageID, 500));
  const from =
    parseAddress(text(fromFullEmail(record.FromFull), 500)) ??
    parseAddress(text(record.From, 500));
  if (!messageId || !from) return null;

  const stripped = text(record.StrippedTextReply);
  const plain = text(record.TextBody);
  const html = text(record.HtmlBody);
  const content = stripped || plain || (html ? htmlToText(html) : "");
  if (!content) return null;

  const replyTo = parseAddress(text(record.ReplyTo, 500));
  const recipients = [
    ...addressesFromRaw(record.OriginalRecipient),
    ...addressesFromFull(record.ToFull),
    ...addressesFromRaw(record.To),
    ...addressesFromFull(record.CcFull),
    ...addressesFromRaw(record.Cc),
    ...addressesFromFull(record.BccFull),
    ...addressesFromRaw(record.Bcc),
  ];
  const seen = new Set<string>();
  const uniqueRecipients = recipients.filter((email) => {
    if (seen.has(email)) return false;
    seen.add(email);
    return true;
  });

  const references = messageIds(header(headers, "References"));
  const inReplyTo = messageIds(header(headers, "In-Reply-To"))[0] ?? null;

  return {
    messageId,
    fromEmail: from.email,
    replyTo: replyTo?.email ?? null,
    recipients: uniqueRecipients,
    subject: text(record.Subject, 300),
    text: content,
    inReplyTo,
    references,
    autoSubmitted: header(headers, "Auto-Submitted"),
    precedence: header(headers, "Precedence"),
  };
}

function fromFullEmail(value: unknown) {
  if (!value || typeof value !== "object" || !("Email" in value)) return "";
  return String(value.Email);
}
