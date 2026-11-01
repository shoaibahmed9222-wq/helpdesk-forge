import { saveWidgetHandoffEmail, WidgetError } from "@/lib/widget";
import { gateWidget, widgetJson, widgetPreflight } from "@/lib/widget-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return widgetPreflight(request);
}

export async function POST(request: Request) {
  const gate = await gateWidget(request);
  if (gate instanceof Response) return gate;

  const raw = await request.text();
  if (raw.length > 2000) return widgetJson({ error: "email" }, 400, request);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return widgetJson({ error: "invalid_json" }, 400, request);
  }
  if (!body || typeof body !== "object") return widgetJson({ error: "invalid_body" }, 400, request);

  const sessionId = "sessionId" in body && typeof body.sessionId === "string" ? body.sessionId : "";
  const email = "email" in body && typeof body.email === "string" ? body.email : "";

  try {
    return widgetJson(
      await saveWidgetHandoffEmail({ workspaceId: gate.workspace.id, sessionId, email }),
      200,
      request,
    );
  } catch (error) {
    if (error instanceof WidgetError) {
      const status = error.code === "missing" ? 404 : 400;
      return widgetJson({ error: error.code }, status, request);
    }
    console.error(error);
    return widgetJson({ error: "provider" }, 502, request);
  }
}
