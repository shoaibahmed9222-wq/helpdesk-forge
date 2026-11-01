import { answerQuestion } from "@/lib/answer";
import { AnswerError, type AnswerTurn } from "@/lib/answer-types";
import { workspaceIdForPublicKey } from "@/lib/llm-config";
import { toPublicAnswer } from "@/lib/public-answer";

function bearer(request: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

function turnsFrom(value: unknown): AnswerTurn[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) return null;
  const turns: AnswerTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const role = "role" in item ? item.role : null;
    const content = "content" in item ? item.content : null;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return null;
    }
    turns.push({ role, content });
  }
  return turns;
}

// The public key selects a workspace. It cannot read docs, change settings, or reveal the model key.
export async function POST(request: Request) {
  const key = bearer(request);
  if (!key) return Response.json({ error: "unauthorized" }, { status: 401 });

  const workspaceId = await workspaceIdForPublicKey(key);
  if (!workspaceId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const question = "question" in body && typeof body.question === "string" ? body.question : "";
  const turns = turnsFrom("turns" in body ? body.turns : undefined);
  if (!turns) return Response.json({ error: "invalid_turns" }, { status: 400 });

  try {
    const answer = await answerQuestion({ workspaceId, question, turns });
    return Response.json(toPublicAnswer(answer));
  } catch (error) {
    if (error instanceof AnswerError) {
      const status = error.code === "question" ? 400 : error.code === "unconfigured" ? 503 : 502;
      return Response.json({ error: error.code }, { status });
    }
    console.error(error);
    return Response.json({ error: "provider" }, { status: 502 });
  }
}
