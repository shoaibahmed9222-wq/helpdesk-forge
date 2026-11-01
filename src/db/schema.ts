import type { AdapterAccountType } from "@auth/core/adapters";
import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  vector,
} from "drizzle-orm/pg-core";

import { EMBEDDING_DIMENSIONS } from "./embedding";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);

export const workspaces = pgTable("workspace", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // Bearer token for POST /api/answer. It picks the workspace. It is not the model key.
  publicKey: text("public_key")
    .notNull()
    .unique()
    .$defaultFn(() => `pk_${crypto.randomUUID().replaceAll("-", "")}`),
  llmProvider: text("llm_provider").$type<"openai" | "compatible">(),
  llmModel: text("llm_model"),
  llmBaseUrl: text("llm_base_url"),
  // AES-256-GCM ciphertext. The plaintext key is never sent to the client.
  llmApiKey: text("llm_api_key"),
  // auto sends a confident reply. draft saves it for a person to send.
  // An unsure answer is never sent in either mode.
  emailReplyMode: text("email_reply_mode")
    .$type<"auto" | "draft">()
    .notNull()
    .default("draft"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "membership",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (membership) => [unique().on(membership.userId, membership.workspaceId)],
);

export const documents = pgTable(
  "document",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    filename: text("filename"),
    status: text("status")
      .$type<"processing" | "ready" | "failed">()
      .notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (document) => [index("document_workspace_id_idx").on(document.workspaceId)],
);

// A passage from a workspace document. Chat, email, and the widget cite this
// row by id, source document, and position. It has no channel-specific fields.
export const chunks = pgTable(
  "chunk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
  },
  (chunk) => [
    unique().on(chunk.documentId, chunk.position),
    index("chunk_workspace_id_idx").on(chunk.workspaceId),
    index("chunk_embedding_hnsw").using(
      "hnsw",
      chunk.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const conversations = pgTable(
  "conversation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    customerEmail: text("customer_email").notNull(),
    status: text("status")
      .$type<"open" | "answered" | "draft" | "handoff">()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (conversation) => [
    index("conversation_workspace_id_idx").on(conversation.workspaceId),
  ],
);

export const messages = pgTable(
  "message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").$type<"customer" | "assistant">().notNull(),
    body: text("body").notNull(),
    // RFC Message-ID, with brackets. Unique across mail we receive and mail we send.
    emailMessageId: text("email_message_id").unique(),
    inReplyTo: text("in_reply_to"),
    referencesHeader: text("references_header"),
    delivery: text("delivery")
      .$type<"received" | "sent" | "draft" | "handoff">()
      .notNull(),
    // JSON [{ chunkId, title }]. Titles are the only citation data that goes out by email.
    citations: text("citations"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (message) => [
    index("message_conversation_id_idx").on(message.conversationId),
    index("message_workspace_id_idx").on(message.workspaceId),
  ],
);
