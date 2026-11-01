import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { AnswerError } from "@/lib/answer-types";
import { decryptApiKey, encryptApiKey } from "@/lib/secrets";

const OPENAI_URL = "https://api.openai.com/v1";

export type LlmProviderName = "openai" | "compatible";

export type LlmSource = "workspace" | "hosted" | "dev" | "unconfigured";

export type LlmStatus = {
  source: LlmSource;
  provider: LlmProviderName | null;
  model: string | null;
  baseUrl: string | null;
  hasKey: boolean;
  keyReadable: boolean;
  publicKey: string;
};

export type ResolvedLlm =
  | {
      provider: "openai" | "compatible";
      apiKey: string;
      model: string;
      baseUrl: string;
      source: "workspace" | "hosted";
    }
  | { provider: "dev"; source: "dev" };

function hostedKey() {
  return process.env.LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
}

function hostedBase() {
  return {
    provider: (process.env.LLM_BASE_URL?.trim() ? "compatible" : "openai") as LlmProviderName,
    model: process.env.LLM_MODEL?.trim() || "gpt-4o-mini",
    baseUrl: process.env.LLM_BASE_URL?.trim().replace(/\/$/, "") || OPENAI_URL,
  };
}

export async function workspaceIdForPublicKey(publicKey: string) {
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.publicKey, publicKey))
    .limit(1);
  return row?.id ?? null;
}

export async function llmStatus(workspaceId: string): Promise<LlmStatus> {
  const [row] = await db
    .select({
      publicKey: workspaces.publicKey,
      provider: workspaces.llmProvider,
      model: workspaces.llmModel,
      baseUrl: workspaces.llmBaseUrl,
      llmApiKey: workspaces.llmApiKey,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row) throw new Error("Workspace not found.");

  let keyReadable = false;
  if (row.llmApiKey) {
    try {
      decryptApiKey(row.llmApiKey);
      keyReadable = true;
    } catch {
      keyReadable = false;
    }
  }

  const shared = {
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl,
    hasKey: Boolean(row.llmApiKey),
    keyReadable,
    publicKey: row.publicKey,
  };

  if (row.llmApiKey) {
    return { ...shared, source: "workspace" };
  }
  if (hostedKey()) {
    const hosted = hostedBase();
    return {
      source: "hosted",
      provider: hosted.provider,
      model: hosted.model,
      baseUrl: hosted.baseUrl,
      hasKey: false,
      keyReadable: false,
      publicKey: row.publicKey,
    };
  }
  if (process.env.NODE_ENV !== "production") {
    return { ...shared, source: "dev", provider: null, model: null, baseUrl: null };
  }
  return { ...shared, source: "unconfigured", provider: null, model: null, baseUrl: null };
}

export async function resolveLlm(workspaceId: string): Promise<ResolvedLlm> {
  const [row] = await db
    .select({
      provider: workspaces.llmProvider,
      model: workspaces.llmModel,
      baseUrl: workspaces.llmBaseUrl,
      llmApiKey: workspaces.llmApiKey,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row) throw new Error("Workspace not found.");

  if (row.llmApiKey) {
    let apiKey = "";
    try {
      apiKey = decryptApiKey(row.llmApiKey);
    } catch {
      throw new AnswerError("provider");
    }
    if ((row.provider !== "openai" && row.provider !== "compatible") || !row.model) {
      throw new AnswerError("provider");
    }
    const baseUrl = row.provider === "openai" ? OPENAI_URL : row.baseUrl?.replace(/\/$/, "");
    if (!baseUrl) throw new AnswerError("provider");
    return {
      provider: row.provider,
      apiKey,
      model: row.model,
      baseUrl,
      source: "workspace",
    };
  }

  const apiKey = hostedKey();
  if (apiKey) {
    const hosted = hostedBase();
    return { ...hosted, apiKey, source: "hosted" };
  }
  if (process.env.NODE_ENV !== "production") {
    return { provider: "dev", source: "dev" };
  }
  throw new AnswerError("unconfigured");
}

export async function saveWorkspaceLlm(
  workspaceId: string,
  input: {
    provider: LlmProviderName;
    model: string;
    baseUrl: string | null;
    apiKey: string | null;
  },
) {
  const [existing] = await db
    .select({ llmApiKey: workspaces.llmApiKey })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const llmApiKey = input.apiKey ? encryptApiKey(input.apiKey) : existing?.llmApiKey;
  if (!llmApiKey) return false;

  await db
    .update(workspaces)
    .set({
      llmProvider: input.provider,
      llmModel: input.model,
      llmBaseUrl: input.provider === "compatible" ? input.baseUrl : null,
      llmApiKey,
    })
    .where(eq(workspaces.id, workspaceId));
  return true;
}

export async function clearWorkspaceLlm(workspaceId: string) {
  await db
    .update(workspaces)
    .set({
      llmProvider: null,
      llmModel: null,
      llmBaseUrl: null,
      llmApiKey: null,
    })
    .where(eq(workspaces.id, workspaceId));
}
