"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendStoredDraft } from "@/lib/email-channel";
import { requireWorkspace } from "@/lib/workspace";

export async function sendDraft(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const messageId = String(formData.get("messageId") ?? "");
  const result = await sendStoredDraft(workspace.id, messageId);
  revalidatePath("/dashboard", "layout");
  if (result.status === "missing") redirect("/dashboard/conversations?error=draft");
  const conversationId = result.conversationId;
  if (result.status === "failed") redirect(`/dashboard/conversations/${conversationId}?error=send`);
  redirect(`/dashboard/conversations/${conversationId}?sent=1`);
}
