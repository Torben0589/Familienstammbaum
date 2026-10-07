"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import styles from "./historic-theme.module.css";

export type AppTheme = "modern" | "historic";

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

const STORAGE_KEY = "familienstammbaum-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("modern");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const initial: AppTheme = saved === "historic" ? "historic" : "modern";
    setThemeState(initial);
    document.documentElement.dataset.theme = initial;
    setReady(true);
  }, []);

  function setTheme(nextTheme: AppTheme) {
    setThemeState(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <div className={`${styles.themeRoot} ${ready ? styles.ready : ""}`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme muss innerhalb des ThemeProvider verwendet werden.");
  }
  return context;
}
