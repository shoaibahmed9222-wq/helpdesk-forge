// Pure environment checks. No secrets are copied into the messages or the health payload.

export type Env = Record<string, string | undefined>;

export type ConfigIssue = {
  code:
    | "database"
    | "auth_secret"
    | "app_secret"
    | "auth_url"
    | "smtp"
    | "email_from"
    | "embeddings";
  message: string;
};

export type EmbeddingConfig =
  | { mode: "local" }
  | {
      mode: "hosted";
      baseUrl: string;
      apiKey: string;
      model: string;
      sendDimensions: boolean;
    };

export const EMBEDDING_DIMENSION_HELP =
  "This app stores 384-dimensional vectors in chunk.embedding. Use a model that returns 384 dimensions, or OpenAI text-embedding-3-small with the dimensions parameter set to 384. To store a different width, change EMBEDDING_DIMENSIONS in src/db/embedding.ts, add a migration that alters chunk.embedding, and re-embed every passage. Old vectors cannot be mixed with a new width.";

function production(env: Env) {
  return env.NODE_ENV === "production";
}

function validFrom(value: string) {
  if (!value || /[\r\n]/.test(value)) return false;
  const address = value.includes("<")
    ? value.slice(value.indexOf("<") + 1, value.lastIndexOf(">")).trim()
    : value.trim();
  return /^[^\s@]+@[^\s@]+$/.test(address);
}

export function emailFromAddress(env: Env = process.env) {
  return env.EMAIL_FROM?.trim() ?? "";
}

export function resolveEmbeddings(env: Env = process.env): EmbeddingConfig | { error: string } {
  const provider = (env.EMBEDDING_PROVIDER ?? "local").trim().toLowerCase() || "local";
  if (provider === "local") return { mode: "local" };
  if (provider !== "openai" && provider !== "compatible") {
    return {
      error: `Unknown EMBEDDING_PROVIDER "${provider}". Use local, openai, or compatible.`,
    };
  }

  const baseUrl = (
    env.EMBEDDING_BASE_URL?.trim() ||
    (provider === "openai" ? "https://api.openai.com/v1" : "")
  ).replace(/\/$/, "");
  const apiKey = env.EMBEDDING_API_KEY?.trim() || env.OPENAI_API_KEY?.trim() || "";
  const model =
    env.EMBEDDING_MODEL?.trim() || (provider === "openai" ? "text-embedding-3-small" : "");
  if (!baseUrl || !apiKey || !model) {
    return {
      error:
        "Hosted embeddings need EMBEDDING_BASE_URL, EMBEDDING_API_KEY (or OPENAI_API_KEY), and EMBEDDING_MODEL. EMBEDDING_PROVIDER=openai defaults the base URL to https://api.openai.com/v1 and the model to text-embedding-3-small.",
    };
  }

  const openaiHost = baseUrl.includes("api.openai.com");
  return {
    mode: "hosted",
    baseUrl,
    apiKey,
    model,
    sendDimensions: openaiHost || env.EMBEDDING_SEND_DIMENSIONS?.trim() === "true",
  };
}

export function embeddingDimensionError(length: number, expected: number) {
  return `Embedding endpoint returned ${length} dimensions; expected ${expected}. ${EMBEDDING_DIMENSION_HELP}`;
}

export function productionIssues(env: Env = process.env): ConfigIssue[] {
  if (!production(env)) return [];
  const issues: ConfigIssue[] = [];

  if (!env.DATABASE_URL?.trim()) {
    issues.push({
      code: "database",
      message:
        "DATABASE_URL is missing. Set the managed Postgres connection string. The database must have pgvector.",
    });
  }
  if (!env.AUTH_SECRET?.trim()) {
    issues.push({
      code: "auth_secret",
      message:
        "AUTH_SECRET is missing. Production will not start without it. Generate one with: openssl rand -base64 32",
    });
  }
  if (!env.APP_SECRET?.trim()) {
    issues.push({
      code: "app_secret",
      message:
        "APP_SECRET is missing. Production will not start without it. It encrypts workspace model keys and does not fall back to AUTH_SECRET in production. Generate one with: openssl rand -base64 32",
    });
  }
  if (!env.AUTH_URL?.trim()) {
    issues.push({
      code: "auth_url",
      message:
        "AUTH_URL is missing. Set it to the public URL of this app so sign-in links use the right host.",
    });
  }

  const host = env.SMTP_HOST?.trim() ?? "";
  const portRaw = env.SMTP_PORT?.trim() ?? "";
  const port = portRaw === "" ? 587 : Number(portRaw);
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
    issues.push({
      code: "smtp",
      message:
        "SMTP is not configured. Production sign-in and replies need SMTP_HOST and a valid SMTP_PORT. Mailpit uses 127.0.0.1 and 1025.",
    });
  }
  if (!validFrom(emailFromAddress(env))) {
    issues.push({
      code: "email_from",
      message:
        "EMAIL_FROM is missing or invalid. Set the From address for sign-in mail, such as Helpdesk Forge <noreply@yourdomain.com>.",
    });
  }

  const embeddings = resolveEmbeddings(env);
  if ("error" in embeddings) {
    issues.push({ code: "embeddings", message: embeddings.error });
  } else if (embeddings.mode === "local") {
    issues.push({
      code: "embeddings",
      message:
        "Production does not use the local embedding model. It would download weights on every cold start. Set EMBEDDING_PROVIDER=compatible or openai, plus EMBEDDING_BASE_URL, EMBEDDING_API_KEY, and EMBEDDING_MODEL. The endpoint must return 384-dimensional vectors.",
    });
  }

  return issues;
}

export function assertProductionReady(env: Env = process.env) {
  if (env.NEXT_PHASE === "phase-production-build") return;
  const issues = productionIssues(env);
  if (issues.length === 0) return;
  throw new Error(
    `Refusing to start in production:\n${issues.map((issue) => `- ${issue.message}`).join("\n")}`,
  );
}

export function deploymentStatus(env: Env = process.env) {
  const embeddings = resolveEmbeddings(env);
  const host = env.SMTP_HOST?.trim() ?? "";
  const portRaw = env.SMTP_PORT?.trim() ?? "";
  const port = portRaw === "" ? 587 : Number(portRaw);
  const smtpOk =
    Boolean(host) && Number.isInteger(port) && port > 0 && port <= 65535 && validFrom(emailFromAddress(env));
  let embeddingState: "local" | "hosted" | "missing" = "missing";
  if (!("error" in embeddings)) embeddingState = embeddings.mode;

  return {
    auth: env.AUTH_SECRET?.trim() ? "configured" : "missing",
    appSecret: env.APP_SECRET?.trim() ? "configured" : "missing",
    smtp: smtpOk ? "configured" : "missing",
    embeddings: embeddingState,
    llm: env.LLM_API_KEY?.trim() || env.OPENAI_API_KEY?.trim() ? "configured" : "missing",
  };
}
