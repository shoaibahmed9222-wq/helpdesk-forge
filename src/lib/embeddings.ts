import "server-only";

import os from "node:os";
import path from "node:path";

import { EMBEDDING_DIMENSIONS } from "@/db/embedding";
import {
  embeddingDimensionError,
  resolveEmbeddings,
} from "@/lib/production-config";

const LOCAL_MODEL = "Xenova/all-MiniLM-L6-v2";
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

function assertDimensions(vectors: number[][]) {
  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(embeddingDimensionError(vector.length, EMBEDDING_DIMENSIONS));
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
  // Production startup already refuses this. The guard stops a cold start from downloading weights.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Production does not use the local embedding model. Set EMBEDDING_PROVIDER to openai or compatible.",
    );
  }
  return enqueue(async () => {
    const extractor = await localExtractor();
    const output = await extractor(texts, {
      pooling: "mean",
      normalize: true,
    });
    return assertDimensions(output.tolist());
  });
}

async function embedHosted(texts: string[]) {
  const resolved = resolveEmbeddings();
  if ("error" in resolved || resolved.mode !== "hosted") {
    throw new Error("error" in resolved ? resolved.error : "Hosted embeddings are not configured.");
  }

  const payload: { model: string; input: string[]; dimensions?: number } = {
    model: resolved.model,
    input: texts,
  };
  if (resolved.sendDimensions) payload.dimensions = EMBEDDING_DIMENSIONS;

  const response = await fetch(`${resolved.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolved.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Embeddings request failed (${response.status}).`);
  }

  const body = (await response.json()) as {
    data?: { index?: number; embedding?: number[] }[];
  };
  const vectors = [...(body.data ?? [])]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((row) => row.embedding ?? []);
  if (vectors.length !== texts.length) {
    throw new Error("The embeddings endpoint returned a different number of vectors.");
  }
  return assertDimensions(vectors);
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  const resolved = resolveEmbeddings();
  if ("error" in resolved) throw new Error(resolved.error);
  const embed = resolved.mode === "hosted" ? embedHosted : embedLocal;
  const vectors: number[][] = [];
  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    vectors.push(...(await embed(texts.slice(index, index + BATCH_SIZE))));
  }
  return vectors;
}
