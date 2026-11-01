import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaces } from "@/db/schema";
import {
  declinesToCustomer,
  HANDOFF_MESSAGE_MAX,
  handoffMessageText,
} from "@/lib/handoff-copy";

export async function getHandoffMessage(workspaceId: string) {
  const [row] = await db
    .select({ handoffMessage: workspaces.handoffMessage })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return handoffMessageText(row?.handoffMessage);
}

export async function setHandoffMessage(workspaceId: string, raw: string) {
  const trimmed = raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (trimmed.length > HANDOFF_MESSAGE_MAX) return "long" as const;
  if (trimmed && declinesToCustomer(trimmed)) return "unsafe" as const;
  await db
    .update(workspaces)
    .set({ handoffMessage: trimmed || null })
    .where(eq(workspaces.id, workspaceId));
  return "ok" as const;
}
