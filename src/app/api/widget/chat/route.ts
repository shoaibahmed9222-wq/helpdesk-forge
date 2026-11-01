import { AnswerError } from "@/lib/answer-types";
import { askWidget, WidgetError, widgetTranscript } from "@/lib/widget";
import { gateWidget, widgetJson, widgetPreflight } from "@/lib/widget-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return widgetPreflight(request);
}

function sessionFrom(request: Request) {
  return new URL(request.url).searchParams.get("session")?.trim() ?? "";
}

function fail(error: unknown, request: Request) {
  if (error instanceof WidgetError) {
    const status = error.code === "missing" ? 404 : 400;
    return widgetJson({ error: error.code }, status, request);
  }
  if (error instanceof AnswerError) {
    const status = error.code === "question" ? 400 : error.code === "unconfigured" ? 503 : 502;
    return widgetJson({ error: error.code }, status, request);
  }
  console.error(error);
  return widgetJson({ error: "provider" }, 502, request);
}

export async function GET(request: Request) {
  const gate = await gateWidget(request);
  if (gate instanceof Response) return gate;
  const session = sessionFrom(request);
  if (!session) return widgetJson({ messages: [], emailProvided: false }, 200, request);
  try {
    return widgetJson(await widgetTranscript(gate.workspace.id, session), 200, request);
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: Request) {
  const gate = await gateWidget(request);
  if (gate instanceof Response) return gate;

  const raw = await request.text();
  if (raw.length > 8000) return widgetJson({ error: "message" }, 400, request);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return widgetJson({ error: "invalid_json" }, 400, request);
  }
  if (!body || typeof body !== "object") return widgetJson({ error: "invalid_body" }, 400, request);

  const sessionId = "sessionId" in body && typeof body.sessionId === "string" ? body.sessionId : "";
  const message = "message" in body && typeof body.message === "string" ? body.message : "";

  try {
    const result = await askWidget({
      workspaceId: gate.workspace.id,
      sessionId,
      message,
    });
    return widgetJson(result, 200, request);
  } catch (error) {
    return fail(error, request);
  }
}
