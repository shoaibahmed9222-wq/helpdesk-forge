import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { chunks, documents } from "@/db/schema";
import { chunkText } from "@/lib/chunk-text";
import { embedTexts } from "@/lib/embeddings";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_PASTE_CHARS = 100_000;

const MAX_CHUNKS = 250;
const SEARCH_LIMIT = 5;

export class KnowledgeError extends Error {
  constructor(readonly code: "title" | "empty" | "long") {
    super(code);
  }
}

export type KnowledgePassage = {
  chunkId: string;
  documentId: string;
  title: string;
  position: number;
  content: string;
  similarity: number;
};

export async function listDocuments(workspaceId: string) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      filename: documents.filename,
      status: documents.status,
      error: documents.error,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId))
    .orderBy(desc(documents.createdAt));
}

export async function ingestText(input: {
  workspaceId: string;
  title: string;
  filename: string | null;
  text: string;
}) {
  const title = input.title.trim().slice(0, 200);
  const text = input.text.replaceAll("\0", "").trim();
  if (!title) throw new KnowledgeError("title");

  const parts = chunkText(text);
  if (parts.length === 0) throw new KnowledgeError("empty");
  if (parts.length > MAX_CHUNKS) throw new KnowledgeError("long");

  const [document] = await db
    .insert(documents)
    .values({
      workspaceId: input.workspaceId,
      title,
      filename: input.filename,
      status: "processing",
    })
    .returning();
  if (!document) throw new Error("Document was not created.");

  try {
    const vectors = await embedTexts(parts);
    if (vectors.length !== parts.length) {
      throw new Error("Embedding count did not match the passages.");
    }
    await db.transaction(async (tx) => {
      await tx.insert(chunks).values(
        parts.map((content, position) => ({
          workspaceId: input.workspaceId,
          documentId: document.id,
          position,
          content,
          embedding: vectors[position]!,
        })),
      );
      await tx
        .update(documents)
        .set({ status: "ready", error: null })
        .where(eq(documents.id, document.id));
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not ingest this document.";
    await db
      .update(documents)
      .set({
        status: "failed",
        error: message.replaceAll(/\s+/g, " ").slice(0, 240),
      })
      .where(eq(documents.id, document.id));
  }

  return document.id;
}

export async function deleteDocument(workspaceId: string, documentId: string) {
  await db
    .delete(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.workspaceId, workspaceId)),
    );
}

export async function getPassage(workspaceId: string, chunkId: string) {
  const [row] = await db
    .select({
      chunkId: chunks.id,
      documentId: chunks.documentId,
      title: documents.title,
      position: chunks.position,
      content: chunks.content,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(
      and(
        eq(chunks.id, chunkId),
        eq(chunks.workspaceId, workspaceId),
        eq(documents.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function searchKnowledge(workspaceId: string, query: string) {
  const trimmed = query.trim().slice(0, 2000);
  if (!trimmed) return [];

  const [embedding] = await embedTexts([trimmed]);
  if (!embedding) return [];

  const distance = sql`${chunks.embedding} <=> ${JSON.stringify(embedding)}::vector`;
  const rows = await db
    .select({
      chunkId: chunks.id,
      documentId: chunks.documentId,
      title: documents.title,
      position: chunks.position,
      content: chunks.content,
      similarity: sql<number>`1 - (${distance})`,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(
      and(
        eq(chunks.workspaceId, workspaceId),
        eq(documents.workspaceId, workspaceId),
        eq(documents.status, "ready"),
      ),
    )
    .orderBy(distance)
    .limit(SEARCH_LIMIT);

  return rows.map((row) => ({
    ...row,
    similarity: Number(row.similarity),
  })) satisfies KnowledgePassage[];
}
