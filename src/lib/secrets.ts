import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const app = process.env.APP_SECRET?.trim() ?? "";
  const auth = process.env.AUTH_SECRET?.trim() ?? "";
  const production = process.env.NODE_ENV === "production";
  const secret = production ? app : app || auth;
  if (!secret) {
    throw new Error(
      production
        ? "APP_SECRET is required in production to encrypt API keys."
        : "APP_SECRET or AUTH_SECRET is required to encrypt API keys.",
    );
  }
  return createHash("sha256").update(`helpdesk-forge-llm-key:${secret}`).digest();
}

export function encryptApiKey(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptApiKey(payload: string) {
  const [version, ivB64, tagB64, ciphertextB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error("Saved API key could not be read.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
