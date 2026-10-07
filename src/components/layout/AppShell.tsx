import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeSettingsMount } from "@/components/theme/ThemeSettingsMount";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <MobileNav />
          <ThemeSettingsMount />
          <main className="flex-1 px-4 md:px-8 pb-24 md:pb-10 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
