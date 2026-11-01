# Roadmap

1. **Skeleton** — Local Postgres with pgvector, Auth.js sign-in, workspaces, an empty dashboard, and a health check. Done.
2. **Docs ingestion and embeddings** — Add a knowledge base and store embeddings. Done.
3. **RAG chat API** — Answers with citations, behind a small LLM-provider adapter (bring your own key). Done.
4. **Email channel: helpdesk-agnostic integration** — Each workspace gets a unique inbound email address. Any helpdesk (Zendesk, Freshdesk, Gorgias, Help Scout, Gmail or Outlook shared inboxes) forwards tickets to that address. The AI answers from the workspace's knowledge base and replies on the same email thread with proper In-Reply-To/References headers, so the reply threads back into the helpdesk. Each workspace chooses its reply mode. 'Auto-reply when confident' sends automatically. 'Draft only' saves the answer for a human to review and send. Low-confidence emails always go to human handoff in both modes.
5. **Embeddable widget** — Chat widget for the business's site.
6. **Human handoff inbox** — A person picks up conversations the agent will not answer.
7. **Conversations and basic analytics** — History and simple counts.

Later:

- Shopify and Slack channels
- Stripe billing
- Marketing landing page + pricing page
- Team seats
