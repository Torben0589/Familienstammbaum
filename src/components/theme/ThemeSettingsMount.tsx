"use client";

import { usePathname } from "next/navigation";
import { ThemeSelector } from "./ThemeSelector";

export function ThemeSettingsMount() {
  const pathname = usePathname();
  if (pathname !== "/settings") return null;

  return (
    <div className="px-4 md:px-8 pb-4">
      <ThemeSelector />
    </div>
  );
}
