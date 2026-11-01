export type AnswerTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AnswerCitation = {
  chunkId: string;
  documentId: string;
  title: string;
  position: number;
};

export type AnswerProvider = "openai" | "compatible" | "dev";

export type Answer = {
  answer: string;
  confidence: "confident" | "unsure";
  reason: string;
  citations: AnswerCitation[];
  provider: AnswerProvider | null;
};

export class AnswerError extends Error {
  constructor(readonly code: "question" | "unconfigured" | "provider") {
    super(code);
  }
}
