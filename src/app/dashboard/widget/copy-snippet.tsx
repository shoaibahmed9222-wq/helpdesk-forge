"use client";

import { useState } from "react";

export function CopySnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(snippet);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
