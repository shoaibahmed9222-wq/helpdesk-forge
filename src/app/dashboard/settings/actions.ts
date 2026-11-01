"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { setReplyMode } from "@/lib/email-channel";
import { clearWorkspaceLlm, saveWorkspaceLlm } from "@/lib/llm-config";
import { requireWorkspace } from "@/lib/workspace";

const MODEL = /^[A-Za-z0-9_.:/@+-]{1,80}$/;

function normalizeBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password) return null;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function requireOwner() {
  const context = await requireWorkspace();
  if (context.role !== "owner") {
    redirect("/dashboard/settings?error=forbidden");
  }
  return context;
}

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/test");
}

export async function saveEmailReplyMode(formData: FormData) {
  const { workspace } = await requireOwner();
  const mode = String(formData.get("replyMode") ?? "");
  if (mode !== "auto" && mode !== "draft") {
    redirect("/dashboard/settings?error=reply");
  }
  await setReplyMode(workspace.id, mode);
  refresh();
  redirect("/dashboard/settings");
}

export async function saveLlmSettings(formData: FormData) {
  const { workspace } = await requireOwner();
  const provider = String(formData.get("provider") ?? "");
  const model = String(formData.get("model") ?? "").trim();
  const baseRaw = String(formData.get("baseUrl") ?? "").trim();
  const apiKeyRaw = String(formData.get("apiKey") ?? "").trim();

  if (provider !== "openai" && provider !== "compatible") {
    redirect("/dashboard/settings?error=provider");
  }
  if (!MODEL.test(model)) {
    redirect("/dashboard/settings?error=model");
  }

  let baseUrl: string | null = null;
  if (provider === "compatible") {
    baseUrl = baseRaw ? normalizeBaseUrl(baseRaw) : null;
    if (!baseUrl) redirect("/dashboard/settings?error=base");
  }

  const apiKey = apiKeyRaw.length > 0 ? apiKeyRaw : null;
  if (apiKey && (apiKey.length < 8 || apiKey.length > 400 || /\s/.test(apiKey))) {
    redirect("/dashboard/settings?error=key");
  }

  const saved = await saveWorkspaceLlm(workspace.id, {
    provider,
    model,
    baseUrl,
    apiKey,
  });
  if (!saved) redirect("/dashboard/settings?error=key");

  refresh();
  redirect("/dashboard/settings");
}

export async function clearLlmSettings() {
  const { workspace } = await requireOwner();
  await clearWorkspaceLlm(workspace.id);
  refresh();
  redirect("/dashboard/settings");
}
