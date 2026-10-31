"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { memberships, workspaces } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getMembership, slugify } from "@/lib/workspace";

export async function createWorkspace(formData: FormData) {
  const user = await requireUser();
  const existing = await getMembership(user.id);
  if (existing) {
    redirect("/dashboard");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    redirect("/onboarding?error=name");
  }

  const base = slugify(name);
  const [taken] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, base))
    .limit(1);
  const slug = taken ? `${base}-${crypto.randomUUID().slice(0, 8)}` : base;

  await db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name, slug })
      .returning();
    if (!workspace) {
      throw new Error("Workspace was not created.");
    }
    await tx.insert(memberships).values({
      userId: user.id,
      workspaceId: workspace.id,
      role: "owner",
    });
  });

  redirect("/dashboard");
}
