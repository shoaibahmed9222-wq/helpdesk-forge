export type PublicCitation = {
  title: string;
  position: number;
};

export type PublicAnswer = {
  answer: string;
  citations: PublicCitation[];
  handoff: boolean;
};

type AnswerLike = {
  answer: string;
  confidence: "confident" | "unsure";
  citations: { title: string; position: number }[];
};

// Customer-facing shape. Reason, confidence, provider, and passage ids stay on the server.
export function toPublicAnswer(answer: AnswerLike): PublicAnswer {
  return {
    answer: answer.answer,
    citations: answer.citations.map((citation) => ({
      title: citation.title,
      position: citation.position,
    })),
    handoff: answer.confidence !== "confident",
  };
}
