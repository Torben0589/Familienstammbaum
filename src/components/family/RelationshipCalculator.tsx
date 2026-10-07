"use client";
import { useMemo, useState } from "react";
import { PersonPicker } from "@/components/people/PersonPicker";
import { findRelationship } from "@/lib/familyTools";
import type { FamilyGraph, PersonDTO } from "@/types";

export function RelationshipCalculator({ graph }: { graph: FamilyGraph }) {
  const [from, setFrom] = useState<PersonDTO | null>(null);
  const [to, setTo] = useState<PersonDTO | null>(null);
  const result = useMemo(() => from && to ? findRelationship(graph, from.id, to.id) : null, [graph, from, to]);
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <PersonPicker placeholder="Erste Person suchen…" excludeIds={to ? [to.id] : []} onSelect={setFrom} />
        <PersonPicker placeholder="Zweite Person suchen…" excludeIds={from ? [from.id] : []} onSelect={setTo} />
      </div>
      {from && to && (result ? <div className="rounded-2xl bg-white/60 border border-ink-900/5 p-4"><div className="text-sm text-ink-500">Beziehung von {from.firstName} zu {to.firstName}</div><div className="text-xl font-semibold text-ink-900 mt-1">{result.label}</div><div className="text-sm text-ink-500 mt-2">Pfad: {result.path.map((p) => `${p.firstName} ${p.lastName}`).join(" → ")}</div></div> : <div className="text-sm text-ink-500">Zwischen diesen Personen wurde kein gespeicherter Beziehungsweg gefunden.</div>)}
    </div>
  );
}
