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

## Health

`GET /api/health` returns `{ "ok": true, "db": "ok" }` when Postgres is reachable and the `vector` extension is installed.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run db:migrate` — apply Drizzle migrations
- `npm run lint` — ESLint
- `npm run typecheck` — generate route types, then `tsc --noEmit`
