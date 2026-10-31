import { requireWorkspace } from "@/lib/workspace";
import { listDocuments, searchKnowledge } from "@/lib/knowledge";

import {
  addPastedDocument,
  addUploadedDocument,
  removeDocument,
} from "./actions";
import { SubmitButton } from "./submit-button";

export const metadata = { title: "Knowledge base · Helpdesk Forge" };

const errorCopy: Record<string, string> = {
  file: "Upload a .md, .txt, or .pdf file.",
  size: "Files must be 8 MB or smaller.",
  read: "That file could not be read.",
  empty: "That document has no text.",
  title: "Give the pasted note a title (1–200 characters).",
  text: "Paste some text.",
  long: "That document is too long.",
  forbidden: "Only the workspace owner can change the knowledge base.",
};

const statusLabel = {
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatAdded(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; error?: string | string[] }>;
}) {
  const { workspace, role } = await requireWorkspace();
  const params = await searchParams;
  const query = first(params.q)?.trim() ?? "";
  const error = errorCopy[first(params.error) ?? ""] ?? null;
  const documents = await listDocuments(workspace.id);

  let passages: Awaited<ReturnType<typeof searchKnowledge>> = [];
  let searchError: string | null = null;
  if (query) {
    try {
      passages = await searchKnowledge(workspace.id, query);
    } catch {
      searchError = "Search could not run. Check the embedding configuration.";
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge base</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Add the docs this workspace should answer from. Each one is split
          into passages and stored for this workspace only.
        </p>
      </div>

      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      {role === "owner" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <form
            action={addUploadedDocument}
            className="space-y-4 rounded-lg border border-line bg-card p-5"
          >
            <div>
              <h2 className="text-sm font-medium">Upload a file</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Markdown, text, or PDF. Up to 8 MB.
              </p>
            </div>
            <input
              name="file"
              type="file"
              required
              accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-paper file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            <SubmitButton label="Add file" pendingLabel="Adding…" />
          </form>

          <form
            action={addPastedDocument}
            className="space-y-4 rounded-lg border border-line bg-card p-5"
          >
            <div>
              <h2 className="text-sm font-medium">Paste text</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                A title and the note you want searchable.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                maxLength={200}
                placeholder="Shipping FAQ"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="text" className="text-sm font-medium">
                Text
              </label>
              <textarea
                id="text"
                name="text"
                required
                rows={5}
                placeholder="We ship orders over $75 for free."
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <SubmitButton label="Add text" pendingLabel="Adding…" />
          </form>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm leading-6 text-muted">No documents yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-card">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-start justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{document.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {statusLabel[document.status]} ·{" "}
                    {formatAdded(document.createdAt)}
                    {document.filename ? ` · ${document.filename}` : " · Pasted text"}
                  </p>
                  {document.error ? (
                    <p className="mt-1 text-sm text-red-800">{document.error}</p>
                  ) : null}
                </div>
                {role === "owner" ? (
                  <form action={removeDocument}>
                    <input type="hidden" name="id" value={document.id} />
                    {query ? (
                      <input type="hidden" name="q" value={query} />
                    ) : null}
                    <SubmitButton
                      label="Delete"
                      pendingLabel="Deleting…"
                      variant="quiet"
                    />
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Test search</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Top passages for a question, from this workspace only.
          </p>
        </div>
        <form action="/dashboard/knowledge-base" className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="q">
            Question
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Ask a question this workspace should answer"
            className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            Search
          </button>
        </form>
        {searchError ? <p className="text-sm text-red-800">{searchError}</p> : null}
        {query && !searchError ? (
          passages.length === 0 ? (
            <p className="text-sm leading-6 text-muted">
              No matching passages in this workspace.
            </p>
          ) : (
            <ol className="space-y-3">
              {passages.map((passage) => (
                <li
                  key={passage.chunkId}
                  className="rounded-lg border border-line bg-card px-5 py-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{passage.title}</p>
                    <p className="text-sm text-muted">
                      Passage {passage.position + 1} · Similarity{" "}
                      {passage.similarity.toFixed(3)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6">{passage.content}</p>
                </li>
              ))}
            </ol>
          )
        ) : null}
      </section>
    </div>
  );
}
