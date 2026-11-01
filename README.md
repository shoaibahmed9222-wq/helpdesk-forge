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

Open [http://localhost:3000](http://localhost:3000). Enter an email address. In development, no email is sent: the sign-in link is printed in the terminal running `npm run dev`. Open that link, name your workspace, and you land on the dashboard. A production build emails the link through SMTP instead. See [Production](#production).

`docker compose up -d` also starts [Mailpit](https://mailpit.axllent.org/) on SMTP port 1025. Its inbox is at [http://localhost:8025](http://localhost:8025). Replies from the app land there. Nothing is delivered to a real mailbox.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. The compose file serves `postgres://helpdesk:helpdesk@localhost:5432/helpdesk`. |
| `AUTH_SECRET` | Auth.js secret. Generate one with `openssl rand -base64 32`. |
| `AUTH_URL` | Public URL of the app. Use `http://localhost:3000` locally. |
| `EMBEDDING_PROVIDER` | `local` (default, development only), `openai`, or `compatible`. Vectors are 384-dimensional. See below. |
| `EMBEDDING_BASE_URL` | OpenAI-compatible embeddings base URL, without a trailing path. `openai` defaults to `https://api.openai.com/v1`. |
| `EMBEDDING_API_KEY` | Secret. Bearer token for the embeddings endpoint. Falls back to `OPENAI_API_KEY`. |
| `EMBEDDING_MODEL` | Embeddings model name. `openai` defaults to `text-embedding-3-small`. |
| `EMBEDDING_SEND_DIMENSIONS` | Optional. Set to `true` to send `dimensions: 384` to a non-OpenAI endpoint that supports it. OpenAI hosts do this automatically. |
| `OPENAI_API_KEY` | Secret. Embeddings fallback when `EMBEDDING_API_KEY` is unset. Also the hosted answer-model key when `LLM_API_KEY` is unset. |
| `APP_SECRET` | Secret. Encrypts workspace model keys. Required in production. In development, `AUTH_SECRET` is used when this is unset. |
| `LLM_API_KEY` | Hosted answer-model key, used when a workspace has not saved its own. Falls back to `OPENAI_API_KEY`. |
| `LLM_MODEL` | Hosted model. Defaults to `gpt-4o-mini`. |
| `LLM_BASE_URL` | Optional OpenAI-compatible base URL for the hosted key, such as `https://api.groq.com/openai/v1`. |
| `INBOUND_DOMAIN` | Domain of each workspace's inbound address: `<workspace-slug>@INBOUND_DOMAIN`. |
| `INBOUND_WEBHOOK_SECRET` | Shared secret for `POST /api/email/inbound`. Send it as `Authorization: Bearer <secret>`, or as the password in HTTP Basic auth. |
| `SMTP_HOST` | SMTP host for sign-in links and replies. Mailpit uses `127.0.0.1`. Required in production. |
| `SMTP_PORT` | SMTP port. Mailpit uses `1025`. Defaults to `587` when unset. |
| `SMTP_USER` | Optional SMTP username. Leave empty for Mailpit. |
| `SMTP_PASS` | Secret when set. Optional SMTP password. Leave empty for Mailpit. |
| `EMAIL_FROM` | From address for sign-in mail, such as `Helpdesk Forge <noreply@yourdomain.com>`. Required in production. |
| `WIDGET_RATE_LIMIT` | Optional. Website chat requests allowed per public key and IP each minute. Defaults to 20. Stored in Postgres. |

## Production

Deploy to Vercel (or any Node host) and a managed Postgres that has pgvector. Set the variables below, run the migration against that database, then start the app. There is no dev provider, no console sign-in link, and no local embedding download in production.

`npm run db:migrate` applies every Drizzle migration, including `CREATE EXTENSION vector`. Run it with the production `DATABASE_URL` before the app takes traffic. It is safe to run again: applied migrations are recorded in `drizzle.__drizzle_migrations`. On Vercel, run it as a release step. The build does not migrate.

```bash
DATABASE_URL="postgres://user:password@host:5432/helpdesk" npm run db:migrate
```

Production refuses to start when a required value is missing. The process prints `Refusing to start in production:` and exits. `GET /api/health` reports database, pgvector, and config status without secret values.

| Variable | Required | Secret | What it is for |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | yes | Postgres connection string. The server must have pgvector. |
| `AUTH_SECRET` | yes | yes | Auth.js session secret. `openssl rand -base64 32`. |
| `APP_SECRET` | yes | yes | Encrypts workspace model keys. Separate from `AUTH_SECRET`. `openssl rand -base64 32`. |
| `AUTH_URL` | yes | no | Public URL of this app, such as `https://support.example.com`. Sign-in links use it. |
| `EMAIL_FROM` | yes | no | From address on sign-in mail. |
| `SMTP_HOST` | yes | no | SMTP server for sign-in mail and customer replies. |
| `SMTP_PORT` | yes | no | SMTP port. `587` for STARTTLS, `465` for implicit TLS. |
| `SMTP_USER` | if the provider requires it | no | SMTP username. |
| `SMTP_PASS` | if the provider requires it | yes | SMTP password. |
| `EMBEDDING_PROVIDER` | yes | no | `openai` or `compatible`. `local` is rejected. |
| `EMBEDDING_BASE_URL` | yes for `compatible` | no | Embeddings base URL. `openai` defaults to `https://api.openai.com/v1`. |
| `EMBEDDING_API_KEY` | yes | yes | Embeddings bearer token. `openai` can use `OPENAI_API_KEY` instead. |
| `EMBEDDING_MODEL` | yes for `compatible` | no | Model name. `openai` defaults to `text-embedding-3-small`. |
| `LLM_API_KEY` | yes, unless every workspace saves its own key | yes | Hosted answer model. Not read by the health check as a value, only as configured or missing. |
| `LLM_BASE_URL` | when the model is not OpenAI | no | OpenAI-compatible chat base URL, such as `https://api.groq.com/openai/v1`. |
| `LLM_MODEL` | yes | no | Answer model name. Defaults to `gpt-4o-mini`. |
| `INBOUND_DOMAIN` | yes, to receive email | no | Domain of `<workspace-slug>@INBOUND_DOMAIN`. |
| `INBOUND_WEBHOOK_SECRET` | yes, to receive email | yes | Authenticates `POST /api/email/inbound`. |
| `WIDGET_RATE_LIMIT` | no | no | Requests per public key and IP each minute. Default 20. |

## Knowledge base

Workspace owners add `.md`, `.txt`, or `.pdf` files, or paste text, on **Knowledge base**. Ingestion splits each document into passages, embeds them, and stores the vectors in Postgres. A passage belongs to the workspace and points at its source document and position. The answer engine cites those same rows.

**Test search** on that page returns the top passages for a question, with the document title and similarity. It does not call an LLM.

## Answers

`answerQuestion` in `src/lib/answer.ts` is the channel-agnostic entry point. The dashboard, `POST /api/answer`, the email channel, and the website chat all call it. Email and website chat store the thread in the same conversation tables. `answerQuestion` itself does not.

It retrieves that workspace's passages, asks the model to answer only from those passages, and returns the answer, citations, and a `confident` or `unsure` signal with a reason. A citation is the document title plus the passage id and its position (`chunk.position`, starting at 0).

Passages below a cosine similarity of 0.4 are ignored. If nothing relevant remains, or the model declines, or its answer says it does not know or mentions docs, documentation, or a knowledge base, the result is `unsure`. The customer then sees the workspace handoff message, not an internal refusal. A guessed policy is not returned. The default handoff message is “Good question! I'm passing this to our team so they can get you the right answer. They'll reply here soon.” An owner can change it on **Settings**. The dashboard still labels that reply **AI unsure**.

### Ask API

```http
POST /api/answer
Authorization: Bearer <workspace public key>
Content-Type: application/json

{"question":"How long is the warranty?","turns":[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello"}]}
```

`turns` is optional and capped at 8 messages. The public key is shown on **Settings**. It selects the workspace and nothing else: it cannot list documents, change settings, or read the model key. Anyone with the key can ask questions, which spends the model budget. **Test your agent** uses the signed-in session instead of this key, and calls the same function.

A public response has the answer, citations, and whether the question was handed to a person:

```json
{"answer":"The warranty lasts 2 years.","citations":[{"title":"Warranty","position":0}],"handoff":false}
```

`handoff` is true when the docs do not cover the question. `answer` is then the workspace handoff message, and `citations` is empty. The response does not include `confidence`, `reason`, `provider`, or passage ids. Those stay on **Test your agent** and **Conversations**.

### Model key

On **Settings**, an owner sets the provider, model, and API key.

| Provider | Where it sends the prompt |
| --- | --- |
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| OpenAI-compatible | `<base URL>/chat/completions`, for Groq, Together, OpenRouter, or a local server such as `http://localhost:11434/v1` |

The key is encrypted with AES-256-GCM before it is written to `workspace.llm_api_key`. The encryption key is a SHA-256 of `APP_SECRET`. In development only, `AUTH_SECRET` is used when `APP_SECRET` is unset. Production will not start without `APP_SECRET`. The plaintext is never included in a page. If the workspace has no key, answers use the hosted default from the environment variables above.

In development, when there is no workspace key and no hosted key, a dev provider quotes a passage only when most of the question's words appear in it. Otherwise it returns unsure. It is labelled in the dashboard and in the answer reason. It is not an LLM. Production returns an error instead of using it.

**Test your agent** shows the answer, the confident or AI unsure flag, the reason, and citations. A citation opens the source passage. The reason stays in the dashboard.

## Email

Each workspace has one inbound address, shown on the dashboard and on **Settings**: `<workspace-slug>@INBOUND_DOMAIN`. Forward or CC the support inbox to that address. The reply goes to the inbound message's Reply-To, or to From when Reply-To is empty, with `Re:` and `In-Reply-To` / `References` so it lands on the same ticket.

On **Settings**, the owner chooses:

- **Auto-reply when confident** — a covered question is sent immediately.
- **Draft only** — the reply is saved on **Conversations** until someone clicks **Send reply**.

If the agent cannot answer, nothing is sent in either mode. The thread is listed under **Handoffs**, and the saved reply is the handoff message. The email never includes the confidence flag or the internal reason. Doc titles are added in a short footer when a confident reply is sent. A person replies from **Handoffs** on the same thread.

The inbound webhook is `POST /api/email/inbound`. It accepts [Postmark's inbound JSON](https://postmarkapp.com/developer/webhooks/inbound-webhook). Authenticate with the shared secret:

```http
POST /api/email/inbound
Authorization: Bearer <INBOUND_WEBHOOK_SECRET>
```

Postmark can use HTTP Basic auth instead. The password is the same secret. The username can be anything. An unknown recipient is rejected. A repeated Message-ID is ignored. So are auto-replies and bounces (`Auto-Submitted` other than `no`, `Precedence: bulk` or `auto_reply`) and mail sent from one of our own inbound addresses.

Replies are sent over SMTP from the workspace address. Sign-in links in production use that same SMTP transport, with `EMAIL_FROM` as the sender. For local development, Mailpit is the SMTP server and sign-in links are printed in the console instead. A production deploy needs a domain you control and an inbound provider that POSTs this JSON. Point the domain's MX at that provider, set the webhook URL to this route, and set `INBOUND_DOMAIN` to that domain.

## Website chat

On **Website chat**, copy one line onto the business's site:

```html
<script src="https://your-app.example/widget.js" data-key="pk_..." async></script>
```

The script address is this app. `data-key` is the workspace public key from that page. It only lets a visitor ask a question. It cannot change settings, list documents, or read the model key.

The bubble is isolated from the host page with a shadow root. Visitors see the title, greeting, and color saved on **Website chat**. A returning visitor keeps the same chat: the browser stores an anonymous session id in `localStorage`, and the server stores the thread in the same `conversation` and `message` tables as email, with `channel` set to `widget`.

A covered question shows the answer and the source titles. An uncovered question shows the handoff message, then “Leave your email and we'll get back to you.” The email is optional. That thread is listed under **Handoffs**. While the chat is open it checks for new replies. A reply from a person is labeled **Team**. If the visitor left an email, that reply is emailed to them as well.

**Allowed sites** is empty by default, so any site can load the chat. The Website chat page shows a warning until a domain is saved. Add one domain per line to reject other origins. The app's own origin is always allowed, so the preview keeps working. Requests are limited per public key and IP address (20 per minute, or `WIDGET_RATE_LIMIT`). The counter is a row in Postgres, so two app instances share it. Messages longer than 2000 characters are rejected.

The widget calls:

```http
GET /api/widget/config?key=pk_...
GET /api/widget/chat?key=pk_...&session=<visitor-id>
POST /api/widget/chat?key=pk_...
POST /api/widget/handoff?key=pk_...
```

Those routes send CORS headers. A disallowed `Origin` gets `403` and no answer. The chat route calls `answerQuestion` for that workspace only.

## Conversations

**Conversations** lists email and website chat for this workspace, newest first. Filter by channel and by status: answered by the agent, needs a person, draft, or resolved. Search matches the customer’s email or the text they sent. The list is paged. Open a conversation for the full thread, citations, and an internal confident or AI unsure label. That label is not included in email or in the website chat.

## Handoffs

**Handoffs** lists conversations a person needs to take, open ones first, then resolved ones. Each card shows the customer’s email (or that they did not leave one), their question, and what the agent said. A person can reply, mark it resolved, or reopen it. The nav shows how many are still open.

An email reply goes out on the same thread. A website-chat reply appears in the widget, labeled Team, the next time the chat is open. If that visitor left an email, the same reply is emailed to them.

## Analytics

**Analytics** is for this workspace only, for the last 7 or 30 days. It shows how many conversations started, split by email and website chat, how many the agent answered without a handoff, how many were handed to a person, the median time from the handoff to the first team reply, the questions a person had to take (grouped by simplified text), and the docs cited most often. The chart is drawn in the page. No outside analytics service is used.

## Embeddings

The vector width is fixed at 384 in `src/db/embedding.ts`. The `chunk.embedding` column is `vector(384)`.

| `EMBEDDING_PROVIDER` | Model | Notes |
| --- | --- | --- |
| `local` (default) | `Xenova/all-MiniLM-L6-v2` (quantized, 384 dimensions) via Transformers.js | No API key. The first embed downloads about 23 MB into the system temp directory. Development and CI only. |
| `openai` | `text-embedding-3-small`, requesting `dimensions: 384` | Uses `EMBEDDING_API_KEY` or `OPENAI_API_KEY`. The base URL and model can be overridden. |
| `compatible` | `EMBEDDING_MODEL` at `EMBEDDING_BASE_URL/embeddings` | Any OpenAI-compatible embeddings API. Needs `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, and `EMBEDDING_MODEL`. |

Production does not run the local model. A Vercel function can write only to `/tmp`, and that directory is empty on every cold start, so the process would download the ONNX weights before the first embed. Bundling those weights into the function is fragile: the loader fetches them by URL, so the file tracer does not keep them, and the runtime plus the file is a large function. Production therefore refuses to start when the provider is `local` or unset. Point `EMBEDDING_PROVIDER` at a hosted endpoint instead. Development and CI keep the local model, and the weights stay in the temp directory after the first download.

`text-embedding-3-small` is about $0.02 per million input tokens; requesting 384 dimensions does not change that price. Switching among 384-dimensional models does not need a migration. If an endpoint returns another width, ingestion throws and writes nothing. To change the stored width, edit `EMBEDDING_DIMENSIONS`, add a migration that alters `chunk.embedding` to `vector(N)`, apply it, and re-embed every passage. Do not mix widths in the column.

Set `EMBEDDING_SEND_DIMENSIONS=true` when a non-OpenAI server can shorten its vectors and would otherwise return a different width. OpenAI hosts send `dimensions: 384` without that flag.

## Health

`GET /api/health` checks Postgres and the `vector` extension. It also reports whether auth secrets, SMTP, embeddings, and the hosted LLM key are configured. Values of secrets are not included.

```json
{"ok":true,"db":"ok","pgvector":"ok","auth":"configured","appSecret":"configured","smtp":"configured","embeddings":"hosted","llm":"configured"}
```

`ok` is true only when the database answers and pgvector is installed. A missing LLM key still returns 200 with `"llm":"missing"`, because the process can serve the dashboard while answers fail until a key is set. The HTTP status is 503 when the database or pgvector check fails.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run db:migrate` — apply Drizzle migrations (the deploy command)
- `npm test` — unit tests
- `npm run lint` — ESLint
- `npm run typecheck` — generate route types, then `tsc --noEmit`
