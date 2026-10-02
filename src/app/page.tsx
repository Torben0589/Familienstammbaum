import { redirect } from "next/navigation";
import { isFirstRun, getSessionOrNull } from "@/lib/auth";

// Force dynamic rendering, da Auth-Status zur Laufzeit geprüft wird.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (await isFirstRun()) {
    redirect("/setup");
  }
  const session = await getSessionOrNull();
  if (!session) {
    redirect("/login");
  }
  redirect("/dashboard");
}
