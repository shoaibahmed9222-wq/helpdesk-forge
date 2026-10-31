"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "quiet";
}) {
  const { pending } = useFormStatus();
  const className =
    variant === "primary"
      ? "rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-60"
      : "text-sm text-red-800 hover:underline disabled:opacity-60";

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}
