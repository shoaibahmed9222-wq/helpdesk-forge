export const DEFAULT_HANDOFF_MESSAGE =
  "Good question! I'm passing this to our team so they can get you the right answer. They'll reply here soon.";

export const WIDGET_EMAIL_INVITE = "Leave your email and we'll get back to you.";

export const HANDOFF_MESSAGE_MAX = 500;

// Customer-facing answers that decline, or that talk about docs, a knowledge
// base, or not knowing, are handed off instead of shown.
const DECLINES = [
  /i don't know/,
  /i do not know/,
  /don't have (that|this|any|enough|the) information/,
  /do not have (that|this|any|enough|the) information/,
  /no information (on|about|available|in)/,
  /based on (the |our )?(docs|documentation|knowledge base|provided)/,
  /according to (the |our )?(docs|documentation|knowledge base)/,
  /(the |our )?(docs|documentation|knowledge base|passages|context) (don't|do not|doesn't|does not)/,
  /(docs|documentation|knowledge base) (don't|do not|doesn't|does not) (mention|cover|include|contain|say|have)/,
  /not (mentioned|covered|included|found) in (the |our )?(docs|documentation|knowledge base|passages)/,
  /(can't|cannot|unable to) (answer|find|help with|determine)/,
  /i'm not (sure|able)/,
  /i am not (sure|able)/,
  /don't mention/,
  /doesn't mention/,
  /does not mention/,
  /do not mention/,
];

export function declinesToCustomer(answer: string) {
  const text = answer.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  return DECLINES.some((pattern) => pattern.test(text));
}

export function handoffMessageText(stored: string | null | undefined) {
  const trimmed = stored?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
  return trimmed || DEFAULT_HANDOFF_MESSAGE;
}
