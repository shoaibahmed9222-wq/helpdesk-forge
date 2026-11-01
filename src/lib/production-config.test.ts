import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProductionReady,
  deploymentStatus,
  embeddingDimensionError,
  productionIssues,
  resolveEmbeddings,
} from "./production-config.ts";

const ready = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://helpdesk:helpdesk@localhost:5432/helpdesk",
  AUTH_SECRET: "auth-secret-value",
  APP_SECRET: "app-secret-value",
  AUTH_URL: "https://support.example.com",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  EMAIL_FROM: "Helpdesk Forge <noreply@example.com>",
  EMBEDDING_PROVIDER: "compatible",
  EMBEDDING_BASE_URL: "https://embed.example.com/v1",
  EMBEDDING_API_KEY: "embed-secret-value",
  EMBEDDING_MODEL: "embed-384",
  LLM_API_KEY: "llm-secret-value",
};

test("development does not require production env", () => {
  assert.deepEqual(productionIssues({ NODE_ENV: "development" }), []);
});

test("production refuses to start when AUTH_SECRET and APP_SECRET are missing", () => {
  const env = { ...ready, AUTH_SECRET: "", APP_SECRET: "   " };
  const issues = productionIssues(env);
  assert.ok(issues.some((issue) => issue.code === "auth_secret"));
  assert.ok(issues.some((issue) => issue.code === "app_secret"));
  assert.throws(() => assertProductionReady(env), /AUTH_SECRET is missing/);
  assert.throws(() => assertProductionReady(env), /APP_SECRET is missing/);
});

test("production build does not exit on the same checks", () => {
  assert.doesNotThrow(() =>
    assertProductionReady({
      ...ready,
      AUTH_SECRET: "",
      APP_SECRET: "",
      NEXT_PHASE: "phase-production-build",
    }),
  );
});

test("production requires hosted embeddings instead of the local model", () => {
  const issues = productionIssues({ ...ready, EMBEDDING_PROVIDER: "local" });
  assert.equal(issues.length, 1);
  assert.match(issues[0]!.message, /cold start/);
});

test("hosted embeddings accept an OpenAI-compatible endpoint", () => {
  const resolved = resolveEmbeddings(ready);
  assert.ok(!("error" in resolved));
  if ("error" in resolved) return;
  assert.equal(resolved.mode, "hosted");
  if (resolved.mode !== "hosted") return;
  assert.equal(resolved.baseUrl, "https://embed.example.com/v1");
  assert.equal(resolved.model, "embed-384");
  assert.equal(resolved.sendDimensions, false);
});

test("openai embeddings default the model and request 384 dimensions", () => {
  const resolved = resolveEmbeddings({
    EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
  });
  assert.ok(!("error" in resolved));
  if ("error" in resolved || resolved.mode !== "hosted") return;
  assert.equal(resolved.baseUrl, "https://api.openai.com/v1");
  assert.equal(resolved.model, "text-embedding-3-small");
  assert.equal(resolved.apiKey, "sk-test");
  assert.equal(resolved.sendDimensions, true);
});

test("a different vector width tells the operator to re-embed", () => {
  const message = embeddingDimensionError(1536, 384);
  assert.match(message, /1536/);
  assert.match(message, /re-embed every passage/);
});

test("health status names configuration and does not echo secrets", () => {
  const status = deploymentStatus(ready);
  const encoded = JSON.stringify(status);
  assert.equal(status.auth, "configured");
  assert.equal(status.appSecret, "configured");
  assert.equal(status.smtp, "configured");
  assert.equal(status.embeddings, "hosted");
  assert.equal(status.llm, "configured");
  assert.equal(encoded.includes("auth-secret-value"), false);
  assert.equal(encoded.includes("app-secret-value"), false);
  assert.equal(encoded.includes("embed-secret-value"), false);
  assert.equal(encoded.includes("llm-secret-value"), false);
  assert.equal(encoded.includes("helpdesk:helpdesk"), false);
});

test("missing SMTP is reported in production", () => {
  const issues = productionIssues({ ...ready, SMTP_HOST: "", EMAIL_FROM: "" });
  assert.ok(issues.some((issue) => issue.code === "smtp"));
  assert.ok(issues.some((issue) => issue.code === "email_from"));
});
