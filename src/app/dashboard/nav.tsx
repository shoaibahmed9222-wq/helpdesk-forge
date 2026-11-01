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

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm whitespace-nowrap ${
              active
                ? "bg-sidebar-active text-accent-ink"
                : "text-sidebar-muted hover:bg-sidebar-active hover:text-accent-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
