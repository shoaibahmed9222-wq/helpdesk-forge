import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getMembership } from "@/lib/workspace";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const membership = await getMembership(session.user.id);
  if (!membership) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
