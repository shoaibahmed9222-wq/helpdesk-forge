import assert from "node:assert/strict";
import test from "node:test";

import { toPublicAnswer } from "./public-answer.ts";

test("the public answer hides reason, confidence, and internal ids", () => {
  const citation = {
    title: "Warranty",
    position: 0,
    chunkId: "chunk-1",
    documentId: "doc-1",
  };
  const body = toPublicAnswer({
    answer: "The warranty lasts 2 years.",
    confidence: "confident",
    citations: [citation],
  });

  assert.deepEqual(body, {
    answer: "The warranty lasts 2 years.",
    citations: [{ title: "Warranty", position: 0 }],
    handoff: false,
  });
  const encoded = JSON.stringify(body);
  assert.equal(encoded.includes("reason"), false);
  assert.equal(encoded.includes("confidence"), false);
  assert.equal(encoded.includes("chunk-1"), false);
  assert.equal(encoded.includes("provider"), false);
});

test("an unsure answer is marked as handed off", () => {
  const body = toPublicAnswer({
    answer: "Good question! I'm passing this to our team.",
    confidence: "unsure",
    citations: [],
  });
  assert.equal(body.handoff, true);
  assert.deepEqual(body.citations, []);
});
