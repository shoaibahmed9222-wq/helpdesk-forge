import { getWidgetSettings } from "@/lib/widget";
import { requireWorkspace } from "@/lib/workspace";

import { PreviewWidget } from "./preview-widget";

export const metadata = { title: "Chat preview · Helpdesk Forge" };

export default async function WidgetPreviewPage() {
  const { workspace } = await requireWorkspace();
  const settings = await getWidgetSettings(workspace.id);

  return (
    <main className="min-h-dvh bg-[#f7f4ee] px-6 py-16 text-[#1c1915]">
      <p className="text-sm text-[#6d645c]">Your website</p>
      <h1 className="mt-3 max-w-md text-3xl font-semibold tracking-tight">Welcome</h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-[#6d645c]">
        Open the chat bubble to see the title, greeting, and color your visitors get.
      </p>
      <PreviewWidget publicKey={settings.publicKey} />
    </main>
  );
}
