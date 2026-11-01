"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseAllowedDomains, saveWidgetSettings } from "@/lib/widget";
import { requireWorkspace } from "@/lib/workspace";

async function requireOwner() {
  const context = await requireWorkspace();
  if (context.role !== "owner") redirect("/dashboard/widget?error=forbidden");
  return context;
}

export async function saveWidget(formData: FormData) {
  const { workspace } = await requireOwner();
  const title = String(formData.get("title") ?? "").trim();
  const greeting = String(formData.get("greeting") ?? "").trim();
  const accent = String(formData.get("accent") ?? "").trim();
  const domains = parseAllowedDomains(String(formData.get("domains") ?? ""));

  if (title.length < 1 || title.length > 80) redirect("/dashboard/widget?error=title");
  if (greeting.length < 1 || greeting.length > 400) redirect("/dashboard/widget?error=greeting");
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) redirect("/dashboard/widget?error=accent");
  if (!domains) redirect("/dashboard/widget?error=domains");

  await saveWidgetSettings(workspace.id, { title, greeting, accent, domains });
  revalidatePath("/dashboard/widget");
  revalidatePath("/widget-preview");
  redirect("/dashboard/widget");
}
