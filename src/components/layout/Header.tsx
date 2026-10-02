"use client";

import { signOut, useSession } from "next-auth/react";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="md:hidden text-lg font-semibold text-ink-900">🌼 Familienstammbaum</div>
      <div className="ml-auto flex items-center gap-4">
        <span className="text-sm text-ink-700 hidden sm:inline">
          Angemeldet als <strong>{session?.user?.name ?? "..."}</strong>
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="glow-button-secondary !py-2 !px-4 text-sm"
        >
          Abmelden
        </button>
      </div>
    </header>
  );
}
