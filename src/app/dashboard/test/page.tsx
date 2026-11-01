import { llmStatus } from "@/lib/llm-config";
import { requireWorkspace } from "@/lib/workspace";

import { AgentChat } from "./chat";

export const metadata = { title: "Test your agent · Helpdesk Forge" };

export default async function TestAgentPage() {
  const { workspace } = await requireWorkspace();
  const status = await llmStatus(workspace.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Test your agent</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Ask a question a customer would ask. The answer uses this workspace&apos;s
          passages only, and each citation opens the source passage.
        </p>
      </div>
      {status.source === "dev" ? (
        <p className="rounded-lg border border-line bg-card px-5 py-4 text-sm leading-6">
          Dev provider. No API key is set, so a matching passage is quoted
          instead of calling an LLM. Set a key in Settings, or set{" "}
          <span className="font-medium">OPENAI_API_KEY</span>, to use a real model.
        </p>
      ) : null}
      {status.source === "unconfigured" ? (
        <p className="text-sm leading-6 text-red-800">
          No model key is configured. Add one in Settings.
        </p>
      ) : null}
      {status.source === "workspace" ? (
        <p className="text-sm leading-6 text-muted">
          Using the key saved for this workspace
          {status.model ? ` (${status.model})` : ""}.
        </p>
      ) : null}
      {status.source === "hosted" ? (
        <p className="text-sm leading-6 text-muted">
          Using the hosted default{status.model ? ` (${status.model})` : ""}.
        </p>
      ) : null}
      <AgentChat devMode={status.source === "dev"} />
    </div>
  );
}
