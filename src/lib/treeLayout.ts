import type { FamilyGraph, PersonDTO, TreeNode } from "@/types";
import { yearOf } from "@/lib/utils";

// Dieses Modul berechnet das Baum-Layout (Generation + Spalte) aus den rohen
// Personen-/Paar-/Eltern-Kind-Daten.
//
// Ablauf:
//  1. Eltern eines Kindes bestimmen (gespeicherte Eltern + beide Partner der
//     gespeicherten Partnerschaft des Kindes).
//  2. Partner und gemeinsame Eltern eines Kindes bilden eine feste "Einheit"
//     (Gruppe). Eine Einheit steht immer in EINER Generation und ihre Mitglieder
//     stehen immer direkt nebeneinander. Niemand kann sich dazwischenschieben.
//  3. Generationen per Schichtung bestimmen: Kinder liegen immer unter ihren
//     Eltern. Einheiten ohne bekannte Eltern (z. B. Schwiegereltern) werden
//     direkt über ihre Kinder gesetzt und nicht ganz nach oben.
//  4. Reihenfolge je Generation per Tiefensuche (Geschwister/Familienzweige
//     bleiben zusammen).
//  5. Positionen per Mehrfach-Durchlauf: Kinder unter ihre Eltern, Eltern über
//     ihre Kinder. Je Generation wird dabei der Mindestabstand garantiert, es
//     kann also nie zwei überlappende Karten geben.
//
// Die Spalten sind Kommazahlen. Partner stehen enger zusammen als andere Karten.

/** Abstand zwischen zwei Partnern einer Einheit (in Spalten). */
const MEMBER_GAP = 0.8;
/** Zusätzlicher Mindestabstand zwischen zwei Einheiten (in Spalten). */
const UNIT_GAP = 1;
/** Anzahl der Optimierungsdurchläufe (jeweils abwärts + aufwärts). */
const SWEEPS = 8;

interface Unit {
  id: number;
  members: string[]; // von links nach rechts
  generation: number;
  x: number; // Spalte des ersten (linken) Mitglieds
}

export function computeTreeLayout(graph: FamilyGraph, rootId?: string): {
  nodes: TreeNode[];
  columnUnit: number;
} {
  const people = graph.people;
  if (people.length === 0) return { nodes: [], columnUnit: 1 };

  const personById = new Map<string, PersonDTO>(people.map((p) => [p.id, p]));
  const birthYear = (id: string): number => yearOf(personById.get(id)?.birthDate) ?? 9999;

  // ---------------------------------------------------------------------------
  // 1. Beziehungen einlesen
  // ---------------------------------------------------------------------------
  const couples = graph.couples.filter(
    (c) => personById.has(c.parent1Id) && personById.has(c.parent2Id) && c.parent1Id !== c.parent2Id
  );
  const coupleById = new Map(couples.map((c) => [c.id, c]));

  const couplesByPerson = new Map<string, string[]>();
  for (const c of couples) {
    for (const pid of [c.parent1Id, c.parent2Id]) {
      if (!couplesByPerson.has(pid)) couplesByPerson.set(pid, []);
      couplesByPerson.get(pid)!.push(c.id);
    }
  }

  // Gespeicherte Eltern-Kind-Einträge (ohne Duplikate / ungültige Verweise).
  const parentEntries = new Map<string, { parentId: string; coupleId: string | null }[]>();
  const seenLinks = new Set<string>();
  for (const link of graph.links) {
    if (!personById.has(link.childId) || !personById.has(link.parentId)) continue;
    if (link.childId === link.parentId) continue;
    const key = `${link.parentId}>${link.childId}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    if (!parentEntries.has(link.childId)) parentEntries.set(link.childId, []);
    parentEntries.get(link.childId)!.push({ parentId: link.parentId, coupleId: link.coupleId ?? null });
  }

  // Wirksame Eltern eines Kindes: gespeicherte Eltern + beide Partner der
  // gespeicherten Partnerschaft (coupleId). So passt das Layout genau zu den Linien.
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const [childId, entries] of parentEntries) {
    const ids: string[] = [];
    const add = (id: string) => {
      if (id !== childId && personById.has(id) && !ids.includes(id)) ids.push(id);
    };
    for (const e of entries) {
      add(e.parentId);
      const couple = e.coupleId ? coupleById.get(e.coupleId) : undefined;
      if (couple) {
        add(couple.parent1Id);
        add(couple.parent2Id);
      }
    }
    parentsOf.set(childId, ids);
    for (const pid of ids) {
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid)!.push(childId);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Einheiten bilden (Partner + gemeinsame Eltern eines Kindes)
  // ---------------------------------------------------------------------------
  const ufParent = new Map<string, string>(people.map((p) => [p.id, p.id]));
  const find = (id: string): string => {
    let root = id;
    while (ufParent.get(root) !== root) root = ufParent.get(root)!;
    let cur = id;
    while (ufParent.get(cur) !== root) {
      const next = ufParent.get(cur)!;
      ufParent.set(cur, root);
      cur = next;
    }
    return root;
  };

  const adjacency = new Map<string, string[]>(); // Kanten innerhalb einer Einheit
  const pairKeys = new Set<string>();
  const connect = (a: string, b: string) => {
    if (a === b) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (pairKeys.has(key)) return;
    pairKeys.add(key);
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push(b);
    adjacency.get(b)!.push(a);
    ufParent.set(find(a), find(b));
  };
  for (const c of couples) connect(c.parent1Id, c.parent2Id);
  for (const ids of parentsOf.values()) {
    for (let i = 1; i < ids.length; i += 1) connect(ids[0], ids[i]);
  }

  const groupMembers = new Map<string, string[]>();
  for (const p of people) {
    const g = find(p.id);
    if (!groupMembers.has(g)) groupMembers.set(g, []);
    groupMembers.get(g)!.push(p.id);
  }

  // ---------------------------------------------------------------------------
  // 3. Generationen (Schichtung der Einheiten)
  // ---------------------------------------------------------------------------
  const groupIds = [...groupMembers.keys()];
  const edgeKeys = new Set<string>();
  const edges: [string, string][] = [];
  for (const [childId, ids] of parentsOf) {
    for (const pid of ids) {
      const gp = find(pid);
      const gc = find(childId);
      if (gp === gc) continue;
      const key = `${gp}>${gc}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push([gp, gc]);
    }
  }

  const rank = new Map<string, number>(groupIds.map((g) => [g, 0]));
  for (let i = 0; i <= groupIds.length; i += 1) {
    let changed = false;
    for (const [gp, gc] of edges) {
      const need = rank.get(gp)! + 1;
      if (rank.get(gc)! < need) {
        rank.set(gc, need);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Einheiten ohne Eltern direkt über ihre Kinder setzen (nicht ganz nach oben).
  const hasIncoming = new Set(edges.map((e) => e[1]));
  const outgoing = new Map<string, string[]>();
  for (const [gp, gc] of edges) {
    if (!outgoing.has(gp)) outgoing.set(gp, []);
    outgoing.get(gp)!.push(gc);
  }
  for (const g of groupIds) {
    if (hasIncoming.has(g)) continue;
    const kids = outgoing.get(g);
    if (kids && kids.length > 0) rank.set(g, Math.min(...kids.map((k) => rank.get(k)!)) - 1);
  }

  const rootOffset = rootId && personById.has(rootId) ? rank.get(find(rootId)) ?? 0 : 0;
  const generationOf = (personId: string): number => (rank.get(find(personId)) ?? 0) - rootOffset;

  // ---------------------------------------------------------------------------
  // 4. Einheiten mit Reihenfolge der Mitglieder anlegen
  // ---------------------------------------------------------------------------
  const genderRank = (id: string): number => {
    const g = personById.get(id)?.gender;
    return g === "MALE" ? 0 : g === "FEMALE" ? 1 : 2;
  };
  const byDefaultOrder = (a: string, b: string): number =>
    genderRank(a) - genderRank(b) || birthYear(a) - birthYear(b) || a.localeCompare(b);

  function orderMembers(ids: string[]): string[] {
    if (ids.length <= 1) return [...ids];
    if (ids.length === 2) return [...ids].sort(byDefaultOrder);

    // Kette: bei mehreren Partnern steht die Person mit mehreren Partnern in der Mitte.
    const inGroup = new Set(ids);
    const neighbours = (id: string) =>
      (adjacency.get(id) ?? []).filter((n) => inGroup.has(n)).sort((a, b) => birthYear(a) - birthYear(b) || a.localeCompare(b));
    const start = [...ids].sort(
      (a, b) => neighbours(a).length - neighbours(b).length || byDefaultOrder(a, b)
    )[0];
    const result: string[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      result.push(id);
      for (const n of neighbours(id)) walk(n);
    };
    walk(start);
    for (const id of ids) walk(id);
    return result;
  }

  const units: Unit[] = [];
  const unitOf = new Map<string, Unit>();
  groupIds.forEach((g, index) => {
    const members = orderMembers(groupMembers.get(g)!);
    const unit: Unit = { id: index, members, generation: generationOf(members[0]), x: 0 };
    units.push(unit);
    for (const m of members) unitOf.set(m, unit);
  });

  const minBirth = (u: Unit) => Math.min(...u.members.map(birthYear));
  const unitWidth = (u: Unit) => (u.members.length - 1) * MEMBER_GAP;

  const childUnitsOf = (u: Unit): Unit[] => {
    const childIds = new Set<string>();
    for (const m of u.members) for (const c of childrenOf.get(m) ?? []) childIds.add(c);
    const sorted = [...childIds].sort((a, b) => birthYear(a) - birthYear(b) || a.localeCompare(b));
    const result: Unit[] = [];
    for (const c of sorted) {
      const cu = unitOf.get(c);
      if (cu && cu !== u && !result.includes(cu)) result.push(cu);
    }
    return result;
  };

  // ---------------------------------------------------------------------------
  // 5. Reihenfolge je Generation (Tiefensuche, Blätter von links nach rechts)
  // ---------------------------------------------------------------------------
  const orderValue = new Map<Unit, number>();
  const visiting = new Set<Unit>();
  let cursor = 0;
  const visit = (u: Unit): number => {
    const known = orderValue.get(u);
    if (known !== undefined) return known;
    if (visiting.has(u)) return cursor;
    visiting.add(u);
    const kids = childUnitsOf(u);
    let value: number;
    if (kids.length > 0) {
      const values = kids.map(visit);
      value = values.reduce((a, b) => a + b, 0) / values.length;
    } else {
      value = cursor;
      cursor += 1;
    }
    visiting.delete(u);
    orderValue.set(u, value);
    return value;
  };
  [...units]
    .sort((a, b) => a.generation - b.generation || minBirth(a) - minBirth(b) || a.id - b.id)
    .forEach((u) => visit(u));

  const rows = new Map<number, Unit[]>();
  for (const u of units) {
    if (!rows.has(u.generation)) rows.set(u.generation, []);
    rows.get(u.generation)!.push(u);
  }
  const generationsAsc = [...rows.keys()].sort((a, b) => a - b);
  for (const g of generationsAsc) {
    rows.get(g)!.sort(
      (a, b) => orderValue.get(a)! - orderValue.get(b)! || minBirth(a) - minBirth(b) || a.id - b.id
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Positionen
  // ---------------------------------------------------------------------------
  const xOf = (personId: string): number => {
    const u = unitOf.get(personId)!;
    return u.x + u.members.indexOf(personId) * MEMBER_GAP;
  };

  // Startposition: jede Generation von links nach rechts dicht packen.
  for (const g of generationsAsc) {
    let x = 0;
    for (const u of rows.get(g)!) {
      u.x = x;
      x += unitWidth(u) + UNIT_GAP;
    }
  }

  /** Mitte zwischen der linken und rechten Elternkarte einer Person (oder null). */
  const parentAnchor = (personId: string): number | null => {
    const ids = parentsOf.get(personId);
    if (!ids || ids.length === 0) return null;
    const xs = ids.map(xOf);
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  };

  /**
   * Setzt eine Generation so nah wie möglich an die Wunschpositionen, ohne dass
   * die Reihenfolge oder der Mindestabstand verletzt wird (gewichtete isotone
   * Regression).
   */
  const placeRow = (row: Unit[], desired: (number | null)[]) => {
    const n = row.length;
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < n; i += 1) {
      offsets.push(acc);
      acc += unitWidth(row[i]) + UNIT_GAP;
    }
    const blocks: { sum: number; weight: number; count: number }[] = [];
    for (let i = 0; i < n; i += 1) {
      const wanted = desired[i];
      const weight = wanted === null ? 0.2 : 1;
      const target = (wanted === null ? row[i].x : wanted) - offsets[i];
      blocks.push({ sum: target * weight, weight, count: 1 });
      while (blocks.length > 1) {
        const last = blocks[blocks.length - 1];
        const prev = blocks[blocks.length - 2];
        if (prev.sum / prev.weight <= last.sum / last.weight) break;
        blocks.splice(blocks.length - 2, 2, {
          sum: prev.sum + last.sum,
          weight: prev.weight + last.weight,
          count: prev.count + last.count
        });
      }
    }
    let index = 0;
    for (const block of blocks) {
      const y = block.sum / block.weight;
      for (let k = 0; k < block.count; k += 1) {
        row[index].x = y + offsets[index];
        index += 1;
      }
    }
  };

  const sweepDown = () => {
    for (const g of generationsAsc) {
      const row = rows.get(g)!;
      // Zwei Partner so ordnen, dass sich die Linien zu den Eltern nicht kreuzen.
      for (const u of row) {
        if (u.members.length !== 2) continue;
        const a = parentAnchor(u.members[0]);
        const b = parentAnchor(u.members[1]);
        if (a !== null && b !== null && a > b + 0.05) u.members.reverse();
      }
      const desired = row.map((u) => {
        const wants: number[] = [];
        u.members.forEach((m, i) => {
          const anchor = parentAnchor(m);
          if (anchor !== null) wants.push(anchor - i * MEMBER_GAP);
        });
        return wants.length ? wants.reduce((a, b) => a + b, 0) / wants.length : null;
      });
      placeRow(row, desired);
    }
  };

  const sweepUp = () => {
    for (const g of [...generationsAsc].reverse()) {
      const row = rows.get(g)!;
      const desired = row.map((u) => {
        const wants: number[] = [];
        const seen = new Set<string>();
        for (const m of u.members) {
          for (const childId of childrenOf.get(m) ?? []) {
            if (seen.has(childId)) continue;
            seen.add(childId);
            const offsets = (parentsOf.get(childId) ?? [])
              .filter((pid) => unitOf.get(pid) === u)
              .map((pid) => u.members.indexOf(pid) * MEMBER_GAP);
            if (offsets.length === 0) continue;
            const anchorOffset = (Math.min(...offsets) + Math.max(...offsets)) / 2;
            wants.push(xOf(childId) - anchorOffset);
          }
        }
        return wants.length ? wants.reduce((a, b) => a + b, 0) / wants.length : null;
      });
      placeRow(row, desired);
    }
  };

  for (let i = 0; i < SWEEPS; i += 1) {
    sweepDown();
    sweepUp();
  }
  sweepDown();

  // Ganz links beginnen.
  let minX = Infinity;
  for (const p of people) minX = Math.min(minX, xOf(p.id));
  const round = (value: number) => Math.round(value * 1000) / 1000;

  // ---------------------------------------------------------------------------
  // 7. Knoten für die Anzeige
  // ---------------------------------------------------------------------------
  const nodes: TreeNode[] = people.map((p) => {
    const partnerIds = [
      ...new Set(
        (couplesByPerson.get(p.id) ?? [])
          .map((cid) => {
            const c = coupleById.get(cid)!;
            return c.parent1Id === p.id ? c.parent2Id : c.parent1Id;
          })
          .filter((id) => id !== p.id)
      )
    ];

    const parentIds = parentsOf.get(p.id) ?? [];
    const entries = parentEntries.get(p.id) ?? [];

    // Partnerschaft der Eltern: bevorzugt die gespeicherte coupleId, deren beide
    // Partner auch tatsächlich Eltern des Kindes sind; sonst ein Paar unter den Eltern.
    let parentCoupleId: string | null = null;
    const withCouple = entries.filter((e) => e.coupleId && coupleById.has(e.coupleId));
    const best = withCouple.find((e) => {
      const c = coupleById.get(e.coupleId!)!;
      return parentIds.includes(c.parent1Id) && parentIds.includes(c.parent2Id);
    });
    if (best) parentCoupleId = best.coupleId;
    else if (withCouple.length > 0) parentCoupleId = withCouple[0].coupleId;
    else if (parentIds.length >= 2) {
      const match = couples.find((c) => parentIds.includes(c.parent1Id) && parentIds.includes(c.parent2Id));
      parentCoupleId = match?.id ?? null;
    }

    return {
      person: p,
      generation: generationOf(p.id),
      column: round(xOf(p.id) - minX),
      partnerIds,
      childIds: [...(childrenOf.get(p.id) ?? [])],
      parentIds: [...parentIds],
      parentCoupleId
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
