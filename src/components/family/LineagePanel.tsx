"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PersonPicker } from "@/components/people/PersonPicker";
import { bloodlineFocus, relationshipFocus, type LineageDirection, type LineageFocus } from "@/lib/lineage";
import type { FamilyGraph, PersonDTO } from "@/types";

type Mode = "bloodline" | "relationship";

const DIRECTIONS: { value: LineageDirection; label: string }[] = [
  { value: "both", label: "Vorfahren + Nachkommen" },
  { value: "ancestors", label: "Nur Vorfahren" },
  { value: "descendants", label: "Nur Nachkommen" }
];

export function LineagePanel({
  graph,
  onChange
}: {
  graph: FamilyGraph;
  onChange: (focus: LineageFocus | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("bloodline");
  const [first, setFirst] = useState<PersonDTO | null>(null);
  const [second, setSecond] = useState<PersonDTO | null>(null);
  const [direction, setDirection] = useState<LineageDirection>("both");
  const [includePartners, setIncludePartners] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const focus = useMemo<LineageFocus | null>(() => {
    if (mode === "bloodline") {
      return first ? bloodlineFocus(graph, first.id, direction, includePartners) : null;
    }
    return first && second ? relationshipFocus(graph, first, second) : null;
  }, [graph, mode, first, second, direction, includePartners]);

  useEffect(() => {
    onChangeRef.current(focus);
  }, [focus]);

  // Beim Schließen des Panels wird die Abdunklung wieder aufgehoben.
  useEffect(() => () => onChangeRef.current(null), []);

  function reset() {
    setFirst(null);
    setSecond(null);
    setResetKey((k) => k + 1);
  }

  function changeMode(next: Mode) {
    setMode(next);
    reset();
  }

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
      active ? "bg-amber-400/90 text-ink-900" : "bg-white/60 text-ink-600 hover:bg-white"
    }`;

  return (
    <div className="space-y-3 relative z-50">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabClass(mode === "bloodline")} onClick={() => changeMode("bloodline")}>
          Blutlinie einer Person
        </button>
        <button type="button" className={tabClass(mode === "relationship")} onClick={() => changeMode("relationship")}>
          Verwandtschaft zweier Personen
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 relative z-50">
        <PersonPicker
          key={`first-${resetKey}`}
          placeholder={mode === "bloodline" ? "Person suchen…" : "Erste Person suchen…"}
          excludeIds={second ? [second.id] : []}
          onSelect={setFirst}
        />
        {mode === "relationship" && (
          <PersonPicker
            key={`second-${resetKey}`}
            placeholder="Zweite Person suchen…"
            excludeIds={first ? [first.id] : []}
            onSelect={setSecond}
          />
        )}
      </div>

      {mode === "bloodline" && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
          <select
            className="rounded-xl border border-ink-900/10 bg-white/80 px-3 py-1.5"
            value={direction}
            onChange={(e) => setDirection(e.target.value as LineageDirection)}
          >
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includePartners}
              onChange={(e) => setIncludePartners(e.target.checked)}
            />
            Partner mit anzeigen
          </label>
        </div>
      )}

      {focus ? (
        <div className="rounded-2xl bg-white/60 border border-ink-900/5 p-4 relative z-0">
          <div className="text-sm text-ink-500">
            {mode === "bloodline" && first ? `Blutlinie von ${first.firstName} ${first.lastName}` : "Ergebnis"}
          </div>
          <div className="text-lg font-semibold text-ink-900 mt-1">{focus.summary}</div>
          {focus.detail && <div className="text-sm text-ink-500 mt-2">{focus.detail}</div>}
          <button
            type="button"
            className="glow-button-secondary !py-1.5 !px-3 text-sm mt-3"
            onClick={reset}
          >
            Hervorhebung aufheben
          </button>
        </div>
      ) : (
        <div className="text-sm text-ink-500">
          {mode === "bloodline"
            ? "Wähle eine Person. Alle Personen außerhalb ihrer direkten Linie werden im Stammbaum abgeblendet."
            : "Wähle zwei Personen. Alle nicht beteiligten Personen werden im Stammbaum abgeblendet."}
        </div>
      )}
    </div>
  );
}
