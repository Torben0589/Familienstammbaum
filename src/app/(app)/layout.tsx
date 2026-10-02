import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth";
import { Providers } from "@/components/layout/Providers";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
