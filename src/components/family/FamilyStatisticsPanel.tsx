"use client";
import { useMemo } from "react";
import { buildFamilyStatistics } from "@/lib/familyTools";
import type { FamilyGraph, TreeNode } from "@/types";

export function FamilyStatisticsPanel({ graph, nodes }: { graph: FamilyGraph; nodes: TreeNode[] }) {
  const statistics = useMemo(
    () => buildFamilyStatistics(graph, new Map(nodes.map((n) => [n.person.id, n.generation]))),
    [graph, nodes]
  );
  const cards = [
    ["Personen", statistics.people], ["Lebend", statistics.living], ["Verstorben", statistics.deceased],
    ["Partnerschaften", statistics.couples], ["Generationen", statistics.generations],
    ["Durchschnittsalter", statistics.averageAge === undefined ? "–" : `${statistics.averageAge} Jahre`]
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-white/60 border border-ink-900/5 p-3"><div className="text-xs text-ink-500">{label}</div><div className="text-lg font-semibold text-ink-900 mt-1">{value}</div></div>)}
      {statistics.youngest && <div className="col-span-2 lg:col-span-3 text-sm text-ink-600">Jüngste lebende Person: <strong>{statistics.youngest.person.firstName} {statistics.youngest.person.lastName}</strong> ({statistics.youngest.age}) · Älteste: <strong>{statistics.oldest?.person.firstName} {statistics.oldest?.person.lastName}</strong> ({statistics.oldest?.age})</div>}
    </div>
  );
}
