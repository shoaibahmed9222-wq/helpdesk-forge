import { getReplyMode, workspaceInboundAddress } from "@/lib/email-channel";
import { llmStatus } from "@/lib/llm-config";
import { requireWorkspace } from "@/lib/workspace";

import { clearLlmSettings, saveEmailReplyMode, saveLlmSettings } from "./actions";
import { SubmitButton } from "../knowledge-base/submit-button";

export const metadata = { title: "Settings · Helpdesk Forge" };

const errorCopy: Record<string, string> = {
  forbidden: "Only the workspace owner can change model settings.",
  provider: "Choose OpenAI or an OpenAI-compatible provider.",
  model: "Enter a model name, such as gpt-4o-mini.",
  base: "Enter an https base URL. http is allowed only for localhost.",
  key: "Enter an API key. It is stored encrypted and is not shown again.",
  reply: "Choose auto-reply or draft only.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const sourceCopy = {
  workspace: "This workspace uses its own saved key.",
  hosted: "No key is saved. Answers use the hosted default from the server environment.",
  dev: "No key is saved. In development, the dev provider quotes a matching passage. It is not an LLM.",
  unconfigured: "No key is saved, and the server has no hosted default.",
} as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { workspace, role } = await requireWorkspace();
  const status = await llmStatus(workspace.id);
  const replyMode = await getReplyMode(workspace.id);
  const address = workspaceInboundAddress(workspace.slug);
  const error = errorCopy[first((await searchParams).error) ?? ""] ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          The model key stays on the server. The public key below only lets a
          channel ask this workspace a question.
        </p>
      </div>

      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {status.hasKey && !status.keyReadable ? (
        <p className="text-sm text-red-800">
          The saved key could not be read. Remove it and enter it again.
        </p>
      ) : null}

      <section className="space-y-4 rounded-lg border border-line bg-card p-5">
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Email</h2>
          <p className="text-sm leading-6 text-muted">
            Forward or CC your support inbox to this address. Replies stay on
            the same email thread.
          </p>
          {address ? (
            <p className="break-all rounded-md bg-paper px-3 py-2 font-mono text-sm">{address}</p>
          ) : (
            <p className="text-sm leading-6 text-muted">
              Your inbound address is not ready yet. The person who runs
              Helpdesk Forge still needs to finish email setup.
            </p>
          )}
        </div>
        {role === "owner" ? (
          <form action={saveEmailReplyMode} className="space-y-3">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Replies</legend>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="radio"
                  name="replyMode"
                  value="auto"
                  defaultChecked={replyMode === "auto"}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Auto-reply when confident</span>
                  <span className="block text-muted">
                    Send the reply when your docs cover the question.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="radio"
                  name="replyMode"
                  value="draft"
                  defaultChecked={replyMode === "draft"}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Draft only</span>
                  <span className="block text-muted">
                    Save the reply here for someone on your team to review and
                    send.
                  </span>
                </span>
              </label>
            </fieldset>
            <p className="text-sm leading-6 text-muted">
              If your docs do not cover the question, nothing is emailed. It
              shows up under Handoffs for a person to handle.
            </p>
            <SubmitButton label="Save reply mode" pendingLabel="Saving…" />
          </form>
        ) : (
          <p className="text-sm leading-6 text-muted">
            {replyMode === "auto"
              ? "Auto-reply when confident is on. Only the workspace owner can change it."
              : "Draft only is on. Only the workspace owner can change it."}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-card p-5">
        <h2 className="text-sm font-medium">Answer API</h2>
        <p className="text-sm leading-6 text-muted">
          Send <span className="font-medium text-ink">POST /api/answer</span> with{" "}
          <span className="font-medium text-ink">Authorization: Bearer</span> and
          this public key. The key selects this workspace. It cannot list
          documents, change settings, or read the model key. Anyone who has it
          can ask questions, which spends the model key, so treat it as a
          capability for the widget rather than an admin secret.
        </p>
        <p className="break-all rounded-md bg-paper px-3 py-2 font-mono text-sm">
          {status.publicKey}
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Model</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{sourceCopy[status.source]}</p>
        </div>

        {role === "owner" ? (
          <form action={saveLlmSettings} className="space-y-4 rounded-lg border border-line bg-card p-5">
            <div className="space-y-2">
              <label htmlFor="provider" className="text-sm font-medium">
                Provider
              </label>
              <select
                id="provider"
                name="provider"
                defaultValue={status.source === "workspace" ? (status.provider ?? "openai") : "openai"}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="openai">OpenAI</option>
                <option value="compatible">OpenAI-compatible</option>
              </select>
              <p className="text-sm leading-6 text-muted">
                OpenAI-compatible covers Groq, Together, OpenRouter, and a local
                server. Set the base URL those hosts document for chat
                completions.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="model" className="text-sm font-medium">
                Model
              </label>
              <input
                id="model"
                name="model"
                type="text"
                required
                maxLength={80}
                defaultValue={status.source === "workspace" ? (status.model ?? "") : ""}
                placeholder="gpt-4o-mini"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="baseUrl" className="text-sm font-medium">
                Base URL
              </label>
              <input
                id="baseUrl"
                name="baseUrl"
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                defaultValue={status.source === "workspace" ? (status.baseUrl ?? "") : ""}
                placeholder="https://api.groq.com/openai/v1"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <p className="text-sm leading-6 text-muted">
                Required for an OpenAI-compatible provider. Leave blank for OpenAI.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="apiKey" className="text-sm font-medium">
                API key
              </label>
              <input
                id="apiKey"
                name="apiKey"
                type="password"
                autoComplete="off"
                placeholder={status.hasKey ? "A key is saved" : "Paste a key"}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <p className="text-sm leading-6 text-muted">
                {status.hasKey
                  ? "A key is saved. Leave this blank to keep it, or enter a new one to replace it. The saved key is not sent back to the browser."
                  : "Enter a key to use your own model. It is encrypted before it is stored. Leave the form unsaved to keep the hosted default."}
              </p>
            </div>
            <SubmitButton label="Save" pendingLabel="Saving…" />
          </form>
        ) : (
          <p className="text-sm leading-6 text-muted">
            Only the workspace owner can change the model.
          </p>
        )}

        {role === "owner" && status.hasKey ? (
          <form action={clearLlmSettings}>
            <SubmitButton label="Remove saved key" pendingLabel="Removing…" variant="quiet" />
          </form>
        ) : null}
      </section>
    </div>
  );
}
