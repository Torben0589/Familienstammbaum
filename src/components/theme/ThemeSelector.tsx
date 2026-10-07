"use client";

import { useAppTheme, type AppTheme } from "./ThemeProvider";

const themes: Array<{
  id: AppTheme;
  title: string;
  description: string;
  preview: string;
}> = [
  {
    id: "modern",
    title: "Modern",
    description: "Das bisherige klare, aufgeräumte Design.",
    preview: "Klare Flächen, moderne Farben und hohe Lesbarkeit",
  },
  {
    id: "historic",
    title: "Historisch",
    description: "Anmutung einer Familienchronik von etwa 1900 bis 1930.",
    preview: "Pergament, Sepia, Tinte und klassische Serifenschrift",
  },
];

export function ThemeSelector() {
  const { theme, setTheme } = useAppTheme();

  return (
    <section className="theme-settings-card" aria-labelledby="theme-heading">
      <div className="theme-settings-copy">
        <p className="theme-settings-kicker">Darstellung</p>
        <h2 id="theme-heading">Design des Familienstammbaums</h2>
        <p>Das moderne Design bleibt vollständig erhalten. Die Auswahl wird auf diesem Gerät gespeichert.</p>
      </div>

      <div className="theme-choice-grid" role="radiogroup" aria-label="Design auswählen">
        {themes.map((item) => {
          const active = theme === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`theme-choice ${active ? "theme-choice-active" : ""}`}
              onClick={() => setTheme(item.id)}
            >
              <span className={`theme-preview theme-preview-${item.id}`} aria-hidden="true">
                <span className="theme-preview-card">Tiemann</span>
                <span className="theme-preview-line" />
                <span className="theme-preview-card">Familie</span>
              </span>
              <span className="theme-choice-text">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
                <small>{item.preview}</small>
              </span>
              <span className="theme-choice-check" aria-hidden="true">{active ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
