import assert from "node:assert/strict";
import test from "node:test";

import { rateBucketKey, rateLimitMax, rateWindowStart, RATE_WINDOW_MS } from "./rate-limit.ts";

test("rate windows align to one minute", () => {
  const now = 1_700_000_123_456;
  const start = rateWindowStart(now);
  assert.equal(start % RATE_WINDOW_MS, 0);
  assert.ok(start <= now);
  assert.ok(now - start < RATE_WINDOW_MS);
  assert.equal(rateWindowStart(start), start);
  assert.equal(rateWindowStart(start + RATE_WINDOW_MS), start + RATE_WINDOW_MS);
});

test("a bucket is one public key and one IP", () => {
  assert.equal(rateBucketKey("pk_abc", "203.0.113.5"), "pk_abc\n203.0.113.5");
});

test("the default limit is 20 and out-of-range values fall back", () => {
  assert.equal(rateLimitMax(undefined), 20);
  assert.equal(rateLimitMax("8"), 8);
  assert.equal(rateLimitMax("0"), 20);
  assert.equal(rateLimitMax("1001"), 20);
  assert.equal(rateLimitMax("nope"), 20);
});
