import "server-only";

import os from "node:os";
import path from "node:path";

import { EMBEDDING_DIMENSIONS } from "@/db/embedding";

const LOCAL_MODEL = "Xenova/all-MiniLM-L6-v2";
const OPENAI_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 32;

type FeatureExtractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: true },
) => Promise<{ tolist: () => number[][] }>;

type EmbedState = {
  pipeline: Promise<FeatureExtractor> | null;
  queue: Promise<unknown>;
};

const embedState: EmbedState = ((globalThis as unknown as { helpdeskEmbed?: EmbedState })
  .helpdeskEmbed ??= { pipeline: null, queue: Promise.resolve() });

// One shared ONNX session. Concurrent calls return vectors aimed the wrong way.
function enqueue<T>(task: () => Promise<T>) {
  const result = embedState.queue.then(task, task);
  embedState.queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function embeddingProvider() {
  const value =
    (process.env.EMBEDDING_PROVIDER ?? "local").trim().toLowerCase() || "local";
  if (value !== "local" && value !== "openai") {
    throw new Error(
      `Unknown EMBEDDING_PROVIDER "${value}". Use local or openai.`,
    );
  }
  return value;
}

function assertDimensions(vectors: number[][]) {
  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS}-dimensional embeddings, got ${vector.length}.`,
      );
    }
  }
  return vectors;
}

async function localExtractor() {
  if (!embedState.pipeline) {
    embedState.pipeline = (async () => {
      const { env, pipeline } = await import("@huggingface/transformers");
      env.cacheDir = path.join(os.tmpdir(), "helpdesk-forge-embeddings");
      const extractor = await pipeline("feature-extraction", LOCAL_MODEL, {
        dtype: "q8",
        session_options: {
          intraOpNumThreads: 1,
          interOpNumThreads: 1,
        },
      });
      return extractor as FeatureExtractor;
    })().catch((error: unknown) => {
      embedState.pipeline = null;
      throw error;
    });
  }
  return embedState.pipeline;
}

async function embedLocal(texts: string[]) {
  return enqueue(async () => {
    const extractor = await localExtractor();
    const output = await extractor(texts, {
      pooling: "mean",
      normalize: true,
    });
    return assertDimensions(output.tolist());
  });
}

async function embedOpenAI(texts: string[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai.",
    );
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI embeddings failed (${response.status}).`);
  }

  const body = (await response.json()) as {
    data: { index: number; embedding: number[] }[];
  };
  const vectors = body.data
    .sort((a, b) => a.index - b.index)
    .map((row) => row.embedding);
  if (vectors.length !== texts.length) {
    throw new Error("OpenAI returned a different number of embeddings.");
  }
  return assertDimensions(vectors);
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  const embed = embeddingProvider() === "openai" ? embedOpenAI : embedLocal;
  const vectors: number[][] = [];
  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    vectors.push(...(await embed(texts.slice(index, index + BATCH_SIZE))));
  }
  return vectors;
}
