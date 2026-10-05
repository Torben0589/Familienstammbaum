"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Start" },
  { href: "/tree", label: "Baum" },
  { href: "/people", label: "Personen" },
  { href: "/settings", label: "Mehr" }
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 min-h-[72px] bg-white/90 backdrop-blur-xl border-t border-ink-900/10 flex items-stretch">
      {links.map((link) => {
        const active =
          pathname === link.href ||
          pathname?.startsWith(link.href + "/");

        return (
          <Link
            key={link.href}
            href={link.href}
            className)}
    </nav>
  );
}
