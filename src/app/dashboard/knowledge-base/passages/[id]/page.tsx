import Link from "next/link";
import { notFound } from "next/navigation";

import { getPassage } from "@/lib/knowledge";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Passage · Helpdesk Forge" };

export default async function PassagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const passage = await getPassage(workspace.id, id);
  if (!passage) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted">
          <Link href="/dashboard/knowledge-base" className="hover:underline">
            Knowledge base
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{passage.title}</h1>
        <p className="mt-1 text-sm text-muted">Passage {passage.position + 1}</p>
      </div>
      <p className="rounded-lg border border-line bg-card px-5 py-4 text-sm leading-6">
        {passage.content}
      </p>
    </div>
  );
}
