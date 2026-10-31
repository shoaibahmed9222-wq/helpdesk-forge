# Helpdesk Forge

Helpdesk Forge is an AI customer-support agent for your business. Train it on the docs and FAQs you already have, then embed a chat widget on your site. It answers customers from that knowledge base, shows citations, and hands the conversation to a person when it is unsure.

The product core is open source under the MIT license. A hosted tier is paid, for businesses that want the agent running without operating the stack.

Sign in, add the docs the agent should use, and ask it a question. What comes next is in [ROADMAP.md](ROADMAP.md).

## Local setup

You need Docker and Node.js 20.9 or newer.

```bash
cp .env.example .env
openssl rand -base64 32   # paste the result into AUTH_SECRET in .env
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter an email address. In development, no email is sent: the sign-in link is printed in the terminal running `npm run dev`. Open that link, name your workspace, and you land on the dashboard.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. The compose file serves `postgres://helpdesk:helpdesk@localhost:5432/helpdesk`. |
| `AUTH_SECRET` | Auth.js secret. Generate one with `openssl rand -base64 32`. |
| `AUTH_URL` | Public URL of the app. Use `http://localhost:3000` locally. |
| `EMBEDDING_PROVIDER` | `local` (default) or `openai`. Both produce 384-dimensional vectors. See below. |
| `OPENAI_API_KEY` | Used when `EMBEDDING_PROVIDER=openai`. Also the hosted answer-model key when `LLM_API_KEY` is unset. |
| `APP_SECRET` | Encrypts workspace model keys. When unset, `AUTH_SECRET` is used. |
| `LLM_API_KEY` | Hosted answer-model key, used when a workspace has not saved its own. Falls back to `OPENAI_API_KEY`. |
| `LLM_MODEL` | Hosted model. Defaults to `gpt-4o-mini`. |
| `LLM_BASE_URL` | Optional OpenAI-compatible base URL for the hosted key, such as `https://api.groq.com/openai/v1`. |

## Knowledge base

Workspace owners add `.md`, `.txt`, or `.pdf` files, or paste text, on **Knowledge base**. Ingestion splits each document into passages, embeds them, and stores the vectors in Postgres. A passage belongs to the workspace and points at its source document and position. The answer engine cites those same rows.

**Test search** on that page returns the top passages for a question, with the document title and similarity. It does not call an LLM.

## Answers

`answerQuestion` in `src/lib/answer.ts` is the channel-agnostic entry point. The dashboard and `POST /api/answer` both call it. A later widget or email channel should call it too. It does not store the conversation.

It retrieves that workspace's passages, asks the model to answer only from those passages, and returns the answer, citations, and a `confident` or `unsure` signal with a reason. A citation is the document title plus the passage id and its position (`chunk.position`, starting at 0).

Passages below a cosine similarity of 0.4 are ignored. If nothing relevant remains, or the model says the passages do not cover the question, the answer is exactly `I don't know. The docs don't cover that.` A guessed policy is not returned.

### Ask API

```http
POST /api/answer
Authorization: Bearer <workspace public key>
Content-Type: application/json

{"question":"How long is the warranty?","turns":[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello"}]}
```

`turns` is optional and capped at 8 messages. The public key is shown on **Settings**. It selects the workspace and nothing else: it cannot list documents, change settings, or read the model key. Anyone with the key can ask questions, which spends the model budget. **Test your agent** uses the signed-in session instead of this key, and calls the same function.

### Model key

On **Settings**, an owner sets the provider, model, and API key.

| Provider | Where it sends the prompt |
| --- | --- |
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| OpenAI-compatible | `<base URL>/chat/completions`, for Groq, Together, OpenRouter, or a local server such as `http://localhost:11434/v1` |

The key is encrypted with AES-256-GCM before it is written to `workspace.llm_api_key`. The encryption key is a SHA-256 of `APP_SECRET`, or of `AUTH_SECRET` when `APP_SECRET` is unset. The plaintext is never included in a page. If the workspace has no key, answers use the hosted default from the environment variables above.

In development, when there is no workspace key and no hosted key, a dev provider quotes a passage only when most of the question's words appear in it. Otherwise it returns unsure. It is labelled in the dashboard and in the answer reason. It is not an LLM. Production returns an error instead of using it.

**Test your agent** shows the answer, the confident or unsure flag, the reason, and citations. A citation opens the source passage.

## Embeddings

The vector width is fixed at 384 in `src/db/embedding.ts`. The `chunk.embedding` column is `vector(384)`.

| `EMBEDDING_PROVIDER` | Model | Notes |
| --- | --- | --- |
| `local` (default) | `Xenova/all-MiniLM-L6-v2` (quantized, 384 dimensions) via Transformers.js | No API key. The first embed downloads about 23 MB into the system temp directory. Use this for local dev and CI. |
| `openai` | `text-embedding-3-small` with `dimensions` set to 384 | Needs `OPENAI_API_KEY`. Billed per input token. |

On Vercel, set `openai`. The local model needs the ONNX runtime and a weight file that a short-lived serverless function has to download again on a cold start. `text-embedding-3-small` is about $0.02 per million input tokens; requesting 384 dimensions does not change that price. Switching provider does not require a migration, because both sides use 384 dimensions. Changing the dimension does.

## Health

`GET /api/health` returns `{ "ok": true, "db": "ok" }` when Postgres is reachable and the `vector` extension is installed.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run db:migrate` — apply Drizzle migrations
- `npm run lint` — ESLint
- `npm run typecheck` — generate route types, then `tsc --noEmit`
