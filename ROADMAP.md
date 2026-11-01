# Roadmap

1. **Skeleton** — Local Postgres with pgvector, Auth.js sign-in, workspaces, an empty dashboard, and a health check. Done.
2. **Docs ingestion and embeddings** — Add a knowledge base and store embeddings. Done.
3. **RAG chat API** — Answers with citations, behind a small LLM-provider adapter (bring your own key). Done in [#3](https://github.com/shoaibahmed9222-wq/helpdesk-forge/pull/3).
4. **Email channel: helpdesk-agnostic integration** — Each workspace gets a unique inbound email address. Any helpdesk (Zendesk, Freshdesk, Gorgias, Help Scout, Gmail or Outlook shared inboxes) forwards tickets to that address. The AI answers from the workspace's knowledge base and replies on the same email thread with proper In-Reply-To/References headers, so the reply threads back into the helpdesk. Each workspace chooses its reply mode. 'Auto-reply when confident' sends automatically. 'Draft only' saves the answer for a human to review and send. Low-confidence emails always go to human handoff in both modes. Done in [#4](https://github.com/shoaibahmed9222-wq/helpdesk-forge/pull/4).
5. **Embeddable widget** — Chat widget for the business's site. A business pastes one script tag. Visitors get a chat bubble that answers from that business's docs, shows citations, and hands off when the docs do not cover the question. Done in [#5](https://github.com/shoaibahmed9222-wq/helpdesk-forge/pull/5).
6. **Human handoff inbox** — A person picks up conversations the agent will not answer, replies on the email thread or in the website chat, and can resolve or reopen them. Customers see a handoff message instead of a refusal. Done in [#6](https://github.com/shoaibahmed9222-wq/helpdesk-forge/pull/6).
7. **Conversations and basic analytics** — History across email and website chat, plus counts for the workspace. Done in [#6](https://github.com/shoaibahmed9222-wq/helpdesk-forge/pull/6).

The v1 target (slices 1–7) is implemented in [#6](https://github.com/shoaibahmed9222-wq/helpdesk-forge/pull/6).

8. **Launch-ready** — Production sign-in mail goes out over the SMTP adapter, embeddings can target any OpenAI-compatible endpoint, the widget rate limit is stored in Postgres, the public ask API returns only the customer-facing answer, CI runs on every pull request, and the README lists the production environment. Local embeddings stay the development default and are refused in production so a cold start does not download model weights. Done in [#7](https://github.com/shoaibahmed9222-wq/helpdesk-forge/pull/7).

Later items are not part of v1:

- Shopify and Slack channels
- Stripe billing
- Marketing landing page + pricing page
- Team seats
