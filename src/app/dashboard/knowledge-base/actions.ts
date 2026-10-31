"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  extractDocumentText,
  fileExtension,
  isAllowedExtension,
} from "@/lib/extract-text";
import {
  deleteDocument,
  ingestText,
  KnowledgeError,
  MAX_PASTE_CHARS,
  MAX_UPLOAD_BYTES,
} from "@/lib/knowledge";
import { requireWorkspace } from "@/lib/workspace";

async function requireOwner() {
  const context = await requireWorkspace();
  if (context.role !== "owner") {
    redirect("/dashboard/knowledge-base?error=forbidden");
  }
  return context;
}

function basename(filename: string) {
  return (filename.split(/[/\\]/).pop() ?? "document").slice(0, 200);
}

function titleFromFilename(filename: string) {
  const stripped = basename(filename).replace(/\.(md|txt|pdf)$/i, "").trim();
  return stripped || "Document";
}

async function saveText(input: {
  workspaceId: string;
  title: string;
  filename: string | null;
  text: string;
}) {
  try {
    await ingestText(input);
  } catch (error) {
    if (error instanceof KnowledgeError) {
      redirect(`/dashboard/knowledge-base?error=${error.code}`);
    }
    throw error;
  }
  revalidatePath("/dashboard/knowledge-base");
}

export async function addUploadedDocument(formData: FormData) {
  const { workspace } = await requireOwner();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/dashboard/knowledge-base?error=file");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    redirect("/dashboard/knowledge-base?error=size");
  }

  const filename = basename(file.name || "document.txt");
  const extension = fileExtension(filename);
  if (!isAllowedExtension(extension)) {
    redirect("/dashboard/knowledge-base?error=file");
  }

  let text = "";
  try {
    text = await extractDocumentText(
      extension,
      new Uint8Array(await file.arrayBuffer()),
    );
  } catch {
    redirect("/dashboard/knowledge-base?error=read");
  }

  await saveText({
    workspaceId: workspace.id,
    title: titleFromFilename(filename),
    filename,
    text,
  });
}

export async function addPastedDocument(formData: FormData) {
  const { workspace } = await requireOwner();
  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "");
  if (title.length < 1 || title.length > 200) {
    redirect("/dashboard/knowledge-base?error=title");
  }
  if (text.trim().length === 0) {
    redirect("/dashboard/knowledge-base?error=text");
  }
  if (text.length > MAX_PASTE_CHARS) {
    redirect("/dashboard/knowledge-base?error=long");
  }

  await saveText({
    workspaceId: workspace.id,
    title,
    filename: null,
    text,
  });
}

export async function removeDocument(formData: FormData) {
  const { workspace } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const query = String(formData.get("q") ?? "").trim();
  if (id) {
    await deleteDocument(workspace.id, id);
  }
  revalidatePath("/dashboard/knowledge-base");
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  redirect(`/dashboard/knowledge-base${suffix}`);
}
