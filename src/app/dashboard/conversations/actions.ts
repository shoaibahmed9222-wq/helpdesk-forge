"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendStoredDraft } from "@/lib/email-channel";
import { requireWorkspace } from "@/lib/workspace";

export async function sendDraft(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const messageId = String(formData.get("messageId") ?? "");
  const result = await sendStoredDraft(workspace.id, messageId);
  if (result === "missing") redirect("/dashboard/conversations?error=draft");
  if (result === "failed") redirect("/dashboard/conversations?error=send");
  revalidatePath("/dashboard/conversations");
  revalidatePath("/dashboard/handoffs");
  redirect("/dashboard/conversations?sent=1");
}
