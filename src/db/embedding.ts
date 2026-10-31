/**
 * Locked width of `chunk.embedding`. The local model and OpenAI both emit
 * this size. Changing it needs a new migration and a full re-embed.
 */
export const EMBEDDING_DIMENSIONS = 384 as const;
