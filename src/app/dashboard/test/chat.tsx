"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import type { Answer, AnswerTurn } from "@/lib/answer-types";

import { askAgent } from "./actions";

type Exchange = {
  id: number;
  question: string;
  answer: Answer;
};

export function AgentChat({ devMode }: { devMode: boolean }) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = question.trim();
    if (!next || pending) return;

    const turns: AnswerTurn[] = exchanges.flatMap((exchange) => [
      { role: "user" as const, content: exchange.question },
      { role: "assistant" as const, content: exchange.answer.answer },
    ]);

    setPending(true);
    setError(null);
    const result = await askAgent(next, turns);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQuestion("");
    setExchanges((current) => [
      ...current,
      { id: current.length + 1, question: next, answer: result.answer },
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4" aria-live="polite">
        {exchanges.length === 0 ? (
          <p className="text-sm leading-6 text-muted">No questions yet.</p>
        ) : (
          exchanges.map((exchange) => {
            const confident = exchange.answer.confidence === "confident";
            const devAnswer = devMode || exchange.answer.provider === "dev";
            return (
              <article
                key={exchange.id}
                className="space-y-3 rounded-lg border border-line bg-card px-5 py-4"
              >
                <p className="text-sm font-medium">{exchange.question}</p>
                <p className="text-sm leading-6">{exchange.answer.answer}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      confident
                        ? "bg-accent text-accent-ink"
                        : "border border-line text-ink"
                    }`}
                  >
                    {confident ? "Confident" : "Unsure"}
                  </p>
                  {devAnswer ? (
                    <p className="text-xs font-medium text-muted">Dev provider. Not an LLM.</p>
                  ) : null}
                </div>
                <p className="text-sm leading-6 text-muted">{exchange.answer.reason}</p>
                {exchange.answer.citations.length > 0 ? (
                  <ul className="space-y-1">
                    {exchange.answer.citations.map((citation) => (
                      <li key={citation.chunkId}>
                        <Link
                          href={`/dashboard/knowledge-base/passages/${citation.chunkId}`}
                          className="text-sm text-accent underline-offset-2 hover:underline"
                        >
                          {citation.title} · Passage {citation.position + 1}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No citations.</p>
                )}
              </article>
            );
          })
        )}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="question">
          Question
        </label>
        <input
          id="question"
          name="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question a customer would ask"
          className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending || question.trim().length === 0}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Asking…" : "Ask"}
        </button>
      </form>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
