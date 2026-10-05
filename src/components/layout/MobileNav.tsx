"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Start", icon: "🏠" },
  { href: "/tree", label: "Baum", icon: "🌳" },
  { href: "/people", label: "Personen", icon: "👥" },
  { href: "/settings", label: "Mehr", icon: "⚙️" }
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-ink-900/10 flex items-stretch">
      {links.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium",
              active ? "text-ink-900" : "text-ink-500"
            )}
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
