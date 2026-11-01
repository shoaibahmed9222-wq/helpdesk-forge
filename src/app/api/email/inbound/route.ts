import { acceptInbound, webhookAuthorized } from "@/lib/email-channel";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!webhookAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const result = await acceptInbound(body);
    return Response.json(result.body, { status: result.status });
  } catch {
    console.error("inbound email failed");
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
