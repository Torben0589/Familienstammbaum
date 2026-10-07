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
//  4. Reihenfolge je Generation nach Abstammungslinie: Ausgehend von der
//     jüngsten Person steht auf jeder Ebene die Linie des Vaters links und die
//     der Mutter rechts. Verwandte (Geschwister, Cousins, Onkel/Tanten) stehen
//     bei der Linie, zu der sie gehören.
//  5. Positionen per Mehrfach-Durchlauf: Kinder unter ihre Eltern, Eltern über
//     ihre Kinder. Je Generation wird dabei der Mindestabstand garantiert, es
//     kann also nie zwei überlappende Karten geben.
//
// Die Spalten sind Kommazahlen. Partner stehen enger zusammen als andere Karten.

/** Abstand zwischen zwei Partnern einer Einheit (in Spalten). */
const MEMBER_GAP = 0.9;
/** Zusätzlicher Mindestabstand zwischen zwei Einheiten (in Spalten). */
const UNIT_GAP = 1;
/** Anzahl der Optimierungsdurchläufe (jeweils abwärts + aufwärts). */
const SWEEPS = 8;
/**
 * Anordnung von links nach rechts, ausgehend von der jüngsten Person:
 * true  = die Linie des Vaters steht links, die der Mutter rechts.
 * false = umgekehrt.
 */
const FATHER_LINE_LEFT = true;

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
  // 3. Generationen (feste Ebenen nach Verwandtschaftsgrad)
  // ---------------------------------------------------------------------------
  // Jede Einheit bekommt ihre Ebene aus der Beziehung zu ihren Nachbarn:
  //   Kind = Ebene der Eltern + 1, Partner = gleiche Ebene (liegen in einer Einheit).
  // Ausgehend von einer Startperson wird die Ebene Schritt für Schritt über alle
  // Beziehungen weitergegeben (Breitensuche). Dadurch stehen Geschwister, Cousins,
  // Onkel/Tanten, Eltern und Großeltern immer genau auf der Ebene, die ihrem
  // Verwandtschaftsgrad entspricht – egal, wie viele Vorfahren auf der anderen Seite
  // der Familie bekannt sind. Bei widersprüchlichen Daten gewinnt der kürzeste Weg
  // von der Startperson.
  const groupIds = [...groupMembers.keys()];
  const relations = new Map<string, { to: string; delta: number }[]>();
  const addRelation = (from: string, to: string, delta: number) => {
    if (!relations.has(from)) relations.set(from, []);
    relations.get(from)!.push({ to, delta });
  };
  const edgeKeys = new Set<string>();
  for (const [childId, ids] of parentsOf) {
    for (const pid of ids) {
      const gp = find(pid);
      const gc = find(childId);
      if (gp === gc) continue;
      const key = `${gp}>${gc}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      addRelation(gp, gc, 1); // Kind liegt eine Ebene unter den Eltern
      addRelation(gc, gp, -1);
    }
  }

  const rank = new Map<string, number>();
  const degree = (g: string): number => relations.get(g)?.length ?? 0;
  const startOrder = [...groupIds].sort((a, b) => degree(b) - degree(a) || a.localeCompare(b));
  if (rootId && personById.has(rootId)) startOrder.unshift(find(rootId));

  for (const start of startOrder) {
    if (rank.has(start)) continue;
    // Eine zusammenhängende Verwandtschaft (Komponente) ausgehend von "start".
    const component = [start];
    rank.set(start, 0);
    for (let i = 0; i < component.length; i += 1) {
      const g = component[i];
      for (const { to, delta } of relations.get(g) ?? []) {
        if (rank.has(to)) continue;
        rank.set(to, rank.get(g)! + delta);
        component.push(to);
      }
    }
    // Oberste Ebene dieser Verwandtschaft = 0.
    const top = Math.min(...component.map((g) => rank.get(g)!));
    for (const g of component) rank.set(g, rank.get(g)! - top);
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

  // --- Abstammungslinien (links/rechts) ---------------------------------------
  // Jede Person bekommt einen Linien-Schlüssel (kleine Zahl = weiter links).
  // Die jüngste Person bekommt das Intervall [0, 1). Ihre beiden Eltern teilen
  // sich dieses Intervall (Vater linke Hälfte, Mutter rechte Hälfte), deren Eltern
  // teilen wiederum ihr Intervall usw. Der Schlüssel ist die Mitte des Intervalls.
  // Alle anderen Personen erben den Schlüssel von ihren Eltern, Partnern oder Kindern:
  //   Geschwister/Cousins -> Mittelwert der Eltern, Partner -> Schlüssel des Partners.
  // Unabhängige Familien (nicht verbunden) werden rechts daneben angehängt.
  const lineKey = new Map<string, number>();
  const directLine = new Set<string>(); // direkte Vorfahren der jüngsten Person
  const normKey = (v: number): number => Math.round(v * 1e9) / 1e9;
  const meanOf = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;
  const parentSide = (a: string, b: string): number =>
    (FATHER_LINE_LEFT ? 1 : -1) * (genderRank(a) - genderRank(b)) ||
    birthYear(a) - birthYear(b) ||
    a.localeCompare(b);

  // Zusammenhängende Verwandtschaften (über Eltern, Kinder, Partner).
  const personComponents: string[][] = [];
  {
    const seenPerson = new Set<string>();
    for (const p of people) {
      if (seenPerson.has(p.id)) continue;
      const comp = [p.id];
      seenPerson.add(p.id);
      for (let i = 0; i < comp.length; i += 1) {
        const id = comp[i];
        const next = [...(parentsOf.get(id) ?? []), ...(childrenOf.get(id) ?? []), ...(adjacency.get(id) ?? [])];
        for (const n of next) {
          if (seenPerson.has(n)) continue;
          seenPerson.add(n);
          comp.push(n);
        }
      }
      personComponents.push(comp);
    }
  }
  personComponents.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));

  const ancestorCount = (id: string): number => {
    const seen = new Set<string>();
    const stack = [...(parentsOf.get(id) ?? [])];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur) || cur === id) continue;
      seen.add(cur);
      stack.push(...(parentsOf.get(cur) ?? []));
    }
    return seen.size;
  };

  personComponents.forEach((comp, compIndex) => {
    // Ausgangsperson: die Person der untersten Ebene (jüngste Generation) mit den meisten bekannten Vorfahren.
    const lowest = Math.max(...comp.map(generationOf));
    const focus = comp
      .filter((id) => generationOf(id) === lowest)
      .sort((a, b) => ancestorCount(b) - ancestorCount(a) || birthYear(b) - birthYear(a) || a.localeCompare(b))[0];

    const queue: { id: string; lo: number; hi: number }[] = [{ id: focus, lo: compIndex, hi: compIndex + 1 }];
    for (let i = 0; i < queue.length; i += 1) {
      const { id, lo, hi } = queue[i];
      if (lineKey.has(id)) continue; // Ahnenschwund: der kürzeste Weg gewinnt
      lineKey.set(id, normKey((lo + hi) / 2));
      directLine.add(id);
      const parents = [...(parentsOf.get(id) ?? [])].sort(parentSide);
      const width = (hi - lo) / Math.max(1, parents.length);
      parents.forEach((pid, idx) => queue.push({ id: pid, lo: lo + idx * width, hi: lo + (idx + 1) * width }));
    }
  });

  // Übrige Personen (Geschwister, Cousins, angeheiratete Personen ...).
  const peopleTopDown = [...people].sort(
    (a, b) => generationOf(a.id) - generationOf(b.id) || birthYear(a.id) - birthYear(b.id) || a.id.localeCompare(b.id)
  );
  for (let sweep = 0; sweep <= people.length; sweep += 1) {
    let changed = false;
    for (const p of peopleTopDown) {
      if (lineKey.has(p.id)) continue;
      const known = (ids: string[]) => ids.filter((id) => lineKey.has(id)).map((id) => lineKey.get(id)!);
      let keys = known(parentsOf.get(p.id) ?? []);
      if (keys.length === 0) keys = known(adjacency.get(p.id) ?? []);
      if (keys.length === 0) keys = known(childrenOf.get(p.id) ?? []);
      if (keys.length === 0) continue;
      lineKey.set(p.id, normKey(meanOf(keys)));
      changed = true;
    }
    if (!changed) break;
  }
  for (const p of people) if (!lineKey.has(p.id)) lineKey.set(p.id, 0);

  function orderMembers(ids: string[]): string[] {
    if (ids.length <= 1) return [...ids];
    if (ids.length === 2) {
      return [...ids].sort((a, b) => lineKey.get(a)! - lineKey.get(b)! || byDefaultOrder(a, b));
    }

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

  // ---------------------------------------------------------------------------
  // 5. Reihenfolge je Generation (nach Abstammungslinie, links -> rechts)
  // ---------------------------------------------------------------------------
  // Eine Einheit steht an der Mitte der Linien-Schlüssel ihrer Mitglieder. Bei gleichem
  // Schlüssel stehen Verwandte der linken Hälfte links neben der Hauptlinie, Verwandte
  // der rechten Hälfte rechts daneben.
  const orderValue = new Map<Unit, number>();
  const orderKind = new Map<Unit, number>();
  for (const u of units) {
    const key = normKey(meanOf(u.members.map((m) => lineKey.get(m) ?? 0)));
    orderValue.set(u, key);
    const isDirect = u.members.some((m) => directLine.has(m));
    orderKind.set(u, isDirect ? 0 : key - Math.floor(key) < 0.5 ? -1 : 1);
  }

  const rows = new Map<number, Unit[]>();
  for (const u of units) {
    if (!rows.has(u.generation)) rows.set(u.generation, []);
    rows.get(u.generation)!.push(u);
  }
  const generationsAsc = [...rows.keys()].sort((a, b) => a - b);
  for (const g of generationsAsc) {
    rows.get(g)!.sort(
      (a, b) =>
        orderValue.get(a)! - orderValue.get(b)! ||
        orderKind.get(a)! - orderKind.get(b)! ||
        minBirth(a) - minBirth(b) ||
        a.id - b.id
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