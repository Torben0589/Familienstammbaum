"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Start" },
  { href: "/tree", label: "Baum" },
  { href: "/people", label: "Personen" },
  { href: "/settings", label: "Mehr" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="relative z-50 md:hidden border-b border-ink-900/10 bg-white px-2 py-2"
    >
      <div className="grid grid-cols-4 gap-2">
        {links.map((link) => {
          const active =
            pathname === link.href || pathname?.startsWith(`${link.href}/`);

          // Bewusst normales <a> statt next/link: erzwingt einen vollständigen
          // Seitenaufruf und umgeht den Client-Router (Diagnose + Workaround).
          return (
            <a
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] touch-manipulation items-center justify-center rounded-xl px-2 text-base font-semibold transition-colors ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300"
              }`}
            >
              {link.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
