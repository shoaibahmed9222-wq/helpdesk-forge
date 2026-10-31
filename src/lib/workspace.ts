import "server-only";

import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { memberships, workspaces } from "@/db/schema";
import { requireUser } from "@/lib/session";

export async function getMembership(userId: string) {
  const [membership] = await db
    .select({
      role: memberships.role,
      workspace: workspaces,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt))
    .limit(1);

  return membership ?? null;
}

export async function requireWorkspace() {
  const user = await requireUser();
  const membership = await getMembership(user.id);
  if (!membership) {
    redirect("/onboarding");
  }
  return { user, ...membership };
}

export function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "workspace";
}
