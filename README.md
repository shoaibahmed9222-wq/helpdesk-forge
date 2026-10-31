# Helpdesk Forge

Helpdesk Forge is an AI customer-support agent for your business. Train it on the docs and FAQs you already have, then embed a chat widget on your site. It answers customers from that knowledge base, shows citations, and hands the conversation to a person when it is unsure.

The product core is open source under the MIT license. A hosted tier is paid, for businesses that want the agent running without operating the stack.

This repository is the first slice: sign-in, a workspace, and an empty dashboard. What comes next is in [ROADMAP.md](ROADMAP.md).

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
| `OPENAI_API_KEY` | Required only when `EMBEDDING_PROVIDER=openai`. |

## Knowledge base

Workspace owners add `.md`, `.txt`, or `.pdf` files, or paste text, on **Knowledge base**. Ingestion splits each document into passages, embeds them, and stores the vectors in Postgres. A passage belongs to the workspace and points at its source document and position. Chat, email, and the widget will cite those same rows.

**Test search** on that page returns the top passages for a question, with the document title and similarity. It does not call an LLM.

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
