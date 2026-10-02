import type { FamilyGraph, PersonDTO, TreeNode } from "@/types";
import { yearOf } from "@/lib/utils";

// Dieses Modul berechnet ein einfaches, lesbares Baum-Layout (Generation + Spalte)
// aus den rohen Personen-/Paar-/Eltern-Kind-Daten. Es ist bewusst simpel gehalten:
// Mehrfachehen werden über eine "primäre" Partnerschaft (meist die mit den meisten
// gemeinsamen Kindern) für die Positionierung verwendet; weitere Partner werden
// direkt daneben platziert.

interface FamilyUnit {
  key: string; // "couple:<id>" oder "single:<personId>"
  personIds: string[];
  childIds: string[];
  parentFamilyKey?: string;
  generation: number;
  column: number;
  subtreeWidth: number;
}

export function computeTreeLayout(graph: FamilyGraph, rootId?: string): {
  nodes: TreeNode[];
  columnUnit: number;
} {
  const personById = new Map(graph.people.map((p) => [p.id, p]));

  const parentsByChild = new Map<string, { parentId: string; coupleId: string | null }[]>();
  const childrenByParent = new Map<string, Set<string>>();
  for (const link of graph.links) {
    if (!parentsByChild.has(link.childId)) parentsByChild.set(link.childId, []);
    parentsByChild.get(link.childId)!.push({ parentId: link.parentId, coupleId: link.coupleId ?? null });

    if (!childrenByParent.has(link.parentId)) childrenByParent.set(link.parentId, new Set());
    childrenByParent.get(link.parentId)!.add(link.childId);
  }

  const couplesByPerson = new Map<string, string[]>();
  for (const c of graph.couples) {
    if (!couplesByPerson.has(c.parent1Id)) couplesByPerson.set(c.parent1Id, []);
    couplesByPerson.get(c.parent1Id)!.push(c.id);
    if (!couplesByPerson.has(c.parent2Id)) couplesByPerson.set(c.parent2Id, []);
    couplesByPerson.get(c.parent2Id)!.push(c.id);
  }
  const coupleById = new Map(graph.couples.map((c) => [c.id, c]));
  const childrenByCouple = new Map<string, string[]>();
  for (const link of graph.links) {
    if (!link.coupleId) continue;
    if (!childrenByCouple.has(link.coupleId)) childrenByCouple.set(link.coupleId, []);
    childrenByCouple.get(link.coupleId)!.push(link.childId);
  }

  // Für jede Person die "primäre" Partnerschaft bestimmen (meiste gemeinsame Kinder).
  const primaryCoupleOfPerson = new Map<string, string>();
  for (const [personId, coupleIds] of couplesByPerson) {
    let best: string | null = null;
    let bestCount = -1;
    for (const cid of coupleIds) {
      const count = childrenByCouple.get(cid)?.length ?? 0;
      if (count > bestCount) {
        best = cid;
        bestCount = count;
      }
    }
    if (best) primaryCoupleOfPerson.set(personId, best);
  }

  // ---- Generationen via BFS über alle Kanten (Eltern = -1, Partner = 0, Kinder = +1) ----
  const generation = new Map<string, number>();
  const visited = new Set<string>();

  function bfsFrom(startId: string, startGen: number) {
    const queue: [string, number][] = [[startId, startGen]];
    while (queue.length) {
      const [id, gen] = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      generation.set(id, gen);

      for (const p of parentsByChild.get(id) ?? []) {
        if (!visited.has(p.parentId)) queue.push([p.parentId, gen - 1]);
      }
      for (const childId of childrenByParent.get(id) ?? []) {
        if (!visited.has(childId)) queue.push([childId, gen + 1]);
      }
      for (const cid of couplesByPerson.get(id) ?? []) {
        const couple = coupleById.get(cid);
        if (!couple) continue;
        const partnerId = couple.parent1Id === id ? couple.parent2Id : couple.parent1Id;
        if (!visited.has(partnerId)) queue.push([partnerId, gen]);
      }
    }
  }

  // Wurzel bestimmen: übergebene Person, sonst die Person mit den ältesten bekannten
  // Vorfahren (keine Eltern bekannt) und dem frühesten Geburtsjahr.
  let chosenRoot = rootId && personById.has(rootId) ? rootId : undefined;
  if (!chosenRoot) {
    const withoutParents = graph.people.filter((p) => !parentsByChild.has(p.id));
    const pool = withoutParents.length ? withoutParents : graph.people;
    pool.sort((a, b) => (yearOf(a.birthDate) ?? 9999) - (yearOf(b.birthDate) ?? 9999));
    chosenRoot = pool[0]?.id;
  }
  if (chosenRoot) bfsFrom(chosenRoot, 0);

  // Restliche, nicht verbundene Personen (z. B. separate Familienzweige) ebenfalls einordnen.
  for (const p of graph.people) {
    if (!visited.has(p.id)) bfsFrom(p.id, 0);
  }

  // ---- Spalten zuweisen: Familieneinheiten bilden, Kinder zentriert unter Eltern anordnen ----
  let cursor = 0;
  const columnOf = new Map<string, number>();
  const placedUnits = new Set<string>();

  function sortedChildren(ids: string[]): string[] {
    return [...ids].sort((a, b) => (yearOf(personById.get(a)?.birthDate) ?? 9999) - (yearOf(personById.get(b)?.birthDate) ?? 9999));
  }

  function layoutPerson(personId: string): number {
    if (columnOf.has(personId)) return columnOf.get(personId)!;

    const primaryCoupleId = primaryCoupleOfPerson.get(personId);
    const unitKey = primaryCoupleId ? `couple:${primaryCoupleId}` : `single:${personId}`;

    if (placedUnits.has(unitKey)) {
      return columnOf.get(personId) ?? cursor;
    }
    placedUnits.add(unitKey);

    let partnerId: string | undefined;
    let childIds: string[] = [];
    if (primaryCoupleId) {
      const couple = coupleById.get(primaryCoupleId)!;
      partnerId = couple.parent1Id === personId ? couple.parent2Id : couple.parent1Id;
      childIds = sortedChildren(childrenByCouple.get(primaryCoupleId) ?? []);
    } else {
      childIds = sortedChildren([...(childrenByParent.get(personId) ?? [])]);
    }

    let myCol: number;
    if (childIds.length > 0) {
      const childCols = childIds.map((cid) => layoutPerson(cid));
      myCol = childCols.reduce((a, b) => a + b, 0) / childCols.length;
    } else {
      myCol = cursor;
      cursor += 1;
    }

    columnOf.set(personId, myCol);
    if (partnerId && !columnOf.has(partnerId)) {
      columnOf.set(partnerId, myCol + 0.6);
    }
    return myCol;
  }

  // Erst nach Generation (aufsteigend) und Geburtsjahr sortieren, damit ältere
  // Generationen und ältere Geschwister zuerst platziert werden.
  const orderedPeople = [...graph.people].sort((a, b) => {
    const ga = generation.get(a.id) ?? 0;
    const gb = generation.get(b.id) ?? 0;
    if (ga !== gb) return ga - gb;
    return (yearOf(a.birthDate) ?? 9999) - (yearOf(b.birthDate) ?? 9999);
  });

  for (const p of orderedPeople) {
    if (!columnOf.has(p.id)) layoutPerson(p.id);
  }

  const nodes: TreeNode[] = graph.people.map((p) => {
    const partnerIds = (couplesByPerson.get(p.id) ?? [])
      .map((cid) => {
        const c = coupleById.get(cid)!;
        return c.parent1Id === p.id ? c.parent2Id : c.parent1Id;
      })
      .filter((id) => id !== p.id);

    const parentEntries = parentsByChild.get(p.id) ?? [];
    const parentCoupleLink = parentEntries[0];

    return {
      person: p,
      generation: generation.get(p.id) ?? 0,
      column: columnOf.get(p.id) ?? 0,
      partnerIds,
      childIds: [...(childrenByParent.get(p.id) ?? [])],
      parentIds: parentEntries.map((e) => e.parentId),
      parentCoupleId: parentCoupleLink?.coupleId ?? null
    };
  });

  return { nodes, columnUnit: 1 };
}

export function minMaxGeneration(nodes: TreeNode[]): [number, number] {
  if (!nodes.length) return [0, 0];
  let min = Infinity;
  let max = -Infinity;
  for (const n of nodes) {
    if (n.generation < min) min = n.generation;
    if (n.generation > max) max = n.generation;
  }
  return [min, max];
}
