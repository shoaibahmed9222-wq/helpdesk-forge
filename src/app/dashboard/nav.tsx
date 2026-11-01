"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard/knowledge-base", label: "Knowledge base" },
  { href: "/dashboard/test", label: "Test your agent" },
  { href: "/dashboard/widget", label: "Website chat" },
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/handoffs", label: "Handoffs" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav({ handoffCount }: { handoffCount: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Workspace"
      data-open-handoffs={handoffCount}
      className="flex gap-1 overflow-x-auto md:flex-col"
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badge = item.href === "/dashboard/handoffs" && handoffCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap ${
              active
                ? "bg-sidebar-active text-accent-ink"
                : "text-sidebar-muted hover:bg-sidebar-active hover:text-accent-ink"
            }`}
          >
            <span>{item.label}</span>
            {badge ? (
              <span
                className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-ink"
                aria-label={`${handoffCount} open`}
              >
                {handoffCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
