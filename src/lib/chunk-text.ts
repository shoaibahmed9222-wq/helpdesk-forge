const TARGET_CHARS = 500;
const OVERLAP_CHARS = 80;

export function chunkText(text: string) {
  const normalized = text
    .replaceAll("\0", "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + TARGET_CHARS, normalized.length);
    if (end < normalized.length) {
      const space = normalized.lastIndexOf(" ", end);
      const newline = normalized.lastIndexOf("\n", end);
      const breakAt = Math.max(space, newline);
      if (breakAt > start + TARGET_CHARS / 2) end = breakAt;
    }

    const piece = normalized.slice(start, end).replaceAll(/\s+/g, " ").trim();
    if (piece) chunks.push(piece);
    if (end >= normalized.length) break;

    let next = end - OVERLAP_CHARS;
    if (next <= start) {
      next = end;
    } else {
      const space = normalized.lastIndexOf(" ", next);
      if (space > start) next = space + 1;
    }
    start = next;
  }

  return chunks;
}
