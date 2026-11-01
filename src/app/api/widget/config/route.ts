import { publicWidgetConfig } from "@/lib/widget";
import { gateWidget, widgetJson, widgetPreflight } from "@/lib/widget-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return widgetPreflight(request);
}

export async function GET(request: Request) {
  const gate = await gateWidget(request);
  if (gate instanceof Response) return gate;
  return widgetJson(publicWidgetConfig(gate.workspace), 200, request);
}
