import "server-only";

import { AnswerError } from "@/lib/answer-types";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const STOP = new Set([
  "a", "an", "the", "is", "are", "was", "were", "do", "does", "did", "you",
  "your", "we", "our", "of", "to", "for", "and", "or", "in", "on", "at", "how",
  "what", "when", "where", "why", "who", "can", "i", "me", "my", "it", "this",
  "that", "with", "from", "be", "not", "no", "yes",
]);

const PASSAGE_HEAD = "<<<PASSAGES>>>\n";
const QUESTION_HEAD = "\n<<<QUESTION>>>\n";
const DEV_MIN_OVERLAP = 0.75;

type DevPassage = {
  n: number;
  text: string;
};

function tokens(text: string) {
  const parts = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return parts.filter((token) => (token.length > 2 || /^\d+$/.test(token)) && !STOP.has(token));
}

function overlap(question: string, passage: string) {
  const wanted = tokens(question);
  if (wanted.length === 0) return 0;
  const have = new Set(tokens(passage));
  const hits = wanted.filter((token) => have.has(token)).length;
  return hits / wanted.length;
}

function devUnsure(reason: string) {
  return JSON.stringify({
    answer: "",
    confidence: "unsure",
    reason,
    citations: [],
  });
}

// Quotes the closest passage. It does not generate text, so it cannot invent a policy.
function devComplete(messages: LlmMessage[]) {
  const content = messages.findLast((message) => message.role === "user")?.content ?? "";
  const start = content.indexOf(PASSAGE_HEAD);
  const split = content.indexOf(QUESTION_HEAD);
  if (start < 0 || split < start) {
    return devUnsure("Dev provider: the question could not be read. This is not an LLM.");
  }

  let passages: DevPassage[] = [];
  try {
    const parsed = JSON.parse(content.slice(start + PASSAGE_HEAD.length, split)) as DevPassage[];
    if (Array.isArray(parsed)) passages = parsed;
  } catch {
    passages = [];
  }
  const question = content.slice(split + QUESTION_HEAD.length);
  let best: { n: number; text: string; score: number } | null = null;
  for (const passage of passages) {
    if (typeof passage?.text !== "string" || typeof passage.n !== "number") continue;
    const score = overlap(question, passage.text);
    if (!best || score > best.score) best = { n: passage.n, text: passage.text, score };
  }
  if (!best || best.score < DEV_MIN_OVERLAP) {
    return devUnsure(
      "Dev provider: no passage covers this question. This is not an LLM.",
    );
  }

  const sentences = best.text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let sentence = best.text;
  let sentenceScore = -1;
  for (const item of sentences) {
    const score = overlap(question, item);
    if (score > sentenceScore) {
      sentenceScore = score;
      sentence = item;
    }
  }

  return JSON.stringify({
    answer: sentenceScore >= DEV_MIN_OVERLAP ? sentence : best.text,
    confidence: "confident",
    reason: "Dev provider: quoted the closest passage. This is not an LLM.",
    citations: [best.n],
  });
}

export async function completeChat(input: {
  provider: "openai" | "compatible" | "dev";
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  messages: LlmMessage[];
}) {
  if (input.provider === "dev") {
    if (process.env.NODE_ENV === "production") {
      throw new AnswerError("unconfigured");
    }
    return devComplete(input.messages);
  }

  if (!input.apiKey || !input.model || !input.baseUrl) {
    throw new AnswerError("unconfigured");
  }

  const baseUrl = input.baseUrl.replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        messages: input.messages,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new AnswerError("provider");
  }

  if (!response.ok) {
    throw new AnswerError("provider");
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AnswerError("provider");
  }
  return content;
}

export function passagePrompt(
  question: string,
  passages: { n: number; title: string; position: number; text: string }[],
) {
  return `${PASSAGE_HEAD}${JSON.stringify(passages)}${QUESTION_HEAD}${question}`;
}
