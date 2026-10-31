"use server";

import { answerQuestion } from "@/lib/answer";
import { AnswerError, type Answer, type AnswerTurn } from "@/lib/answer-types";
import { requireWorkspace } from "@/lib/workspace";

const errorCopy = {
  question: "Enter a question.",
  unconfigured: "No model key is configured for this workspace.",
  provider: "The model provider could not answer. Check the key, model, and base URL.",
} as const;

export async function askAgent(
  question: string,
  turns: AnswerTurn[],
): Promise<{ ok: true; answer: Answer } | { ok: false; error: string }> {
  const { workspace } = await requireWorkspace();
  try {
    const answer = await answerQuestion({
      workspaceId: workspace.id,
      question,
      turns,
    });
    return { ok: true, answer };
  } catch (error) {
    if (error instanceof AnswerError) {
      return { ok: false, error: errorCopy[error.code] };
    }
    console.error(error);
    return { ok: false, error: "The agent could not answer." };
  }
}
