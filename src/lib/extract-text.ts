import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

const TEXT_EXTENSIONS = new Set(["md", "txt"]);

export function fileExtension(filename: string) {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function isAllowedExtension(extension: string) {
  return extension === "pdf" || TEXT_EXTENSIONS.has(extension);
}

export async function extractDocumentText(
  extension: string,
  bytes: Uint8Array,
) {
  if (extension === "pdf") {
    const header = new TextDecoder().decode(bytes.subarray(0, 5));
    if (!header.startsWith("%PDF-")) {
      throw new Error("That file is not a PDF.");
    }
    const pdf = await getDocumentProxy(bytes);
    try {
      const { text } = await extractText(pdf, { mergePages: false });
      return text
        .map((page) => page.trim())
        .filter(Boolean)
        .join("\n\n");
    } finally {
      await pdf.cleanup();
    }
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
