/**
 * Locked width of `chunk.embedding`. Local MiniLM and hosted endpoints must
 * emit this size. A different width needs a migration and a full re-embed.
 */
export const EMBEDDING_DIMENSIONS = 384 as const;
