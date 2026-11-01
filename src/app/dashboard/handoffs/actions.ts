"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { replyToHandoff, setHandoffState } from "@/lib/inbox";
import { requireWorkspace } from "@/lib/workspace";

function destination(formData: FormData, conversationId: string) {
  if (String(formData.get("returnTo") ?? "") === "conversation" && conversationId) {
    return `/dashboard/conversations/${conversationId}`;
  }
  return "/dashboard/handoffs";
}

function refresh() {
  revalidatePath("/dashboard", "layout");
}

export async function replyToConversation(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const conversationId = String(formData.get("conversationId") ?? "");
  const dest = destination(formData, conversationId);
  const result = await replyToHandoff(workspace.id, conversationId, String(formData.get("body") ?? ""));
  refresh();
  if (result === "sent") redirect(`${dest}?sent=1`);
  if (result === "email_failed") redirect(`${dest}?error=email`);
  if (result === "empty") redirect(`${dest}?error=empty`);
  if (result === "failed") redirect(`${dest}?error=send`);
  redirect(`${dest}?error=missing`);
}

export async function resolveConversation(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const conversationId = String(formData.get("conversationId") ?? "");
  const dest = destination(formData, conversationId);
  const result = await setHandoffState(workspace.id, conversationId, "resolved");
  refresh();
  if (result === "missing") redirect(`${dest}?error=missing`);
  redirect(`${dest}?resolved=1`);
}

export async function reopenConversation(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const conversationId = String(formData.get("conversationId") ?? "");
  const dest = destination(formData, conversationId);
  const result = await setHandoffState(workspace.id, conversationId, "handoff");
  refresh();
  if (result === "missing") redirect(`${dest}?error=missing`);
  redirect(`${dest}?reopened=1`);
}
