"use client";

import { useEffect } from "react";

export function PreviewWidget({ publicKey }: { publicKey: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/widget.js";
    script.async = true;
    script.dataset.key = publicKey;
    document.body.appendChild(script);
    return () => {
      script.remove();
      document.getElementById("helpdesk-forge-widget")?.remove();
    };
  }, [publicKey]);

  return null;
}
