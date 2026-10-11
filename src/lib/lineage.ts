import type { FamilyGraph, PersonDTO } from "@/types";
import { findRelationship } from "@/lib/familyTools";

export type LineageDirection = "both" | "ancestors" | "descendants";

export interface LineageFocus {
  /** IDs aller Personen, die hervorgehoben bleiben. Alle anderen rücken in den Hintergrund. */
  ids: string[];
  summary: string;
  detail?: string;
}

function collect(startId: string, next: Map<string, string[]>): Set<string> {
  const found = new Set<string>();
  const stack = [startId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const id of next.get(current) ?? []) {
      if (id === startId || found.has(id)) continue;
      found.add(id);
      stack.push(id);
    }
  }
  return found;
}

/** Direkte Blutslinie: alle Vorfahren und/oder alle Nachkommen einer Person (ohne Geschwister, Onkel, Cousins). */
export function bloodlineFocus(
  graph: FamilyGraph,
  personId: string,
  direction: LineageDirection,
  includePartners: boolean
): LineageFocus {
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const link of graph.links) {
    parentsOf.set(link.childId, [...(parentsOf.get(link.childId) ?? []), link.parentId]);
    childrenOf.set(link.parentId, [...(childrenOf.get(link.parentId) ?? []), link.childId]);
  }

  const ancestors = direction === "descendants" ? new Set<string>() : collect(personId, parentsOf);
  const descendants = direction === "ancestors" ? new Set<string>() : collect(personId, childrenOf);
  const ids = new Set<string>([personId, ...ancestors, ...descendants]);

  let partnerCount = 0;
  if (includePartners) {
    for (const couple of graph.couples) {
      const a = couple.parent1Id;
      const b = couple.parent2Id;
      if (ids.has(a) && !ids.has(b)) { ids.add(b); partnerCount++; }
      else if (ids.has(b) && !ids.has(a)) { ids.add(a); partnerCount++; }
    }
  }

  const parts: string[] = [];
  if (direction !== "descendants") parts.push(`${ancestors.size} Vorfahren`);
  if (direction !== "ancestors") parts.push(`${descendants.size} Nachkommen`);
  if (includePartners) parts.push(`${partnerCount} Partner`);

  return {
    ids: [...ids],
    summary: `${ids.size} von ${graph.people.length} Personen hervorgehoben`,
    detail: parts.join(" · ")
  };
}

/** Verwandtschaft zweier Personen: nur die Personen des Beziehungspfads bleiben hervorgehoben. */
export function relationshipFocus(graph: FamilyGraph, from: PersonDTO, to: PersonDTO): LineageFocus {
  const result = findRelationship(graph, from.id, to.id);
  if (!result) {
    return {
      ids: [from.id, to.id],
      summary: "Kein gespeicherter Beziehungsweg gefunden",
      detail: "Nur die beiden gewählten Personen bleiben hervorgehoben."
    };
  }
  return {
    ids: result.path.map((p) => p.id),
    summary: `${to.firstName} ist ${result.label} von ${from.firstName}`,
    detail: `Pfad: ${result.path.map((p) => `${p.firstName} ${p.lastName}`).join(" → ")}`
  };
}
