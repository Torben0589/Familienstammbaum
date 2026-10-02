"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Übersicht", icon: "🏠" },
  { href: "/tree", label: "Stammbaum", icon: "🌳" },
  { href: "/people", label: "Personen", icon: "👥" },
  { href: "/settings", label: "Einstellungen", icon: "⚙️" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col gap-2 p-5">
      <div className="px-3 py-4 mb-2">
        <div className="text-xl font-semibold text-ink-900">🌼 Familienstammbaum</div>
        <div className="text-xs text-ink-500 mt-1">Unsere Familiengeschichte</div>
      </div>
      {links.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn("sidebar-link", active && "sidebar-link-active")}
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </aside>
  );
}
