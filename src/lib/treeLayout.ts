import type { FamilyGraph, TreeNode } from "@/types";
import { yearOf } from "@/lib/utils";

/**
 * Berechnet Generation und Spalte aller Personen.
 *
 * Wichtige Regeln:
 * - Eltern stehen eine Generation ueber ihren Kindern.
 * - Partner stehen in derselben Generation.
 * - Primaere Partner werden nebeneinander angeordnet.
 * - Spalten sind ganzzahlig und innerhalb einer Generation eindeutig.
 * - parentCoupleId wird aus der tatsaechlichen Eltern-Kind-Verknuepfung ermittelt.
 */
export function computeTreeLayout(
  graph: FamilyGraph,
  rootId?: string
): { nodes: TreeNode[]; columnUnit: number } {
  if (graph.people.length === 0) {
    return { nodes: [], columnUnit: 1 };
  }

  const personById = new Map(graph.people.map((person) => [person.id, person]));
  const coupleById = new Map(graph.couples.map((couple) => [couple.id, couple]));

  const parentsByChild = new Map<
    string,
    { parentId: string; coupleId: string | null }[]
  >();
  const childrenByParent = new Map<string, Set<string>>();
  const couplesByPerson = new Map<string, string[]>();
  const childrenByCouple = new Map<string, Set<string>>();

  for (const link of graph.links) {
    if (!personById.has(link.childId) || !personById.has(link.parentId)) {
      continue;
    }

    const parentEntries = parentsByChild.get(link.childId) ?? [];
    parentEntries.push({
      parentId: link.parentId,
      coupleId: link.coupleId ?? null
    });
    parentsByChild.set(link.childId, parentEntries);

    const children = childrenByParent.get(link.parentId) ?? new Set<string>();
    children.add(link.childId);
    childrenByParent.set(link.parentId, children);

    if (link.coupleId) {
      const coupleChildren =
        childrenByCouple.get(link.coupleId) ?? new Set<string>();
      coupleChildren.add(link.childId);
      childrenByCouple.set(link.coupleId, coupleChildren);
    }
  }

  for (const couple of graph.couples) {
    if (!personById.has(couple.parent1Id) || !personById.has(couple.parent2Id)) {
      continue;
    }

    const firstCouples = couplesByPerson.get(couple.parent1Id) ?? [];
    firstCouples.push(couple.id);
    couplesByPerson.set(couple.parent1Id, firstCouples);

    const secondCouples = couplesByPerson.get(couple.parent2Id) ?? [];
    secondCouples.push(couple.id);
    couplesByPerson.set(couple.parent2Id, secondCouples);
  }

  // Bei mehreren Partnerschaften dient die Partnerschaft mit den meisten
  // gemeinsamen Kindern als primaere Einheit fuer die Positionierung.
  const primaryCoupleOfPerson = new Map<string, string>();

  for (const [personId, coupleIds] of couplesByPerson) {
    const sortedCoupleIds = [...coupleIds].sort((firstId, secondId) => {
      const childDifference =
        (childrenByCouple.get(secondId)?.size ?? 0) -
        (childrenByCouple.get(firstId)?.size ?? 0);

      if (childDifference !== 0) return childDifference;
      return firstId.localeCompare(secondId);
    });

    if (sortedCoupleIds[0]) {
      primaryCoupleOfPerson.set(personId, sortedCoupleIds[0]);
    }
  }

  const generation = calculateGenerations(
    graph,
    personById,
    parentsByChild,
    childrenByParent,
    couplesByPerson,
    coupleById,
    rootId
  );

  const columnOf = new Map<string, number>();
  const placedUnits = new Set<string>();
  let cursor = 0;

  function sortedChildren(childIds: Iterable<string>): string[] {
    return [...childIds].sort((firstId, secondId) => {
      const firstPerson = personById.get(firstId);
      const secondPerson = personById.get(secondId);

      const yearDifference =
        (yearOf(firstPerson?.birthDate) ?? 9999) -
        (yearOf(secondPerson?.birthDate) ?? 9999);

      if (yearDifference !== 0) return yearDifference;
      return firstId.localeCompare(secondId);
    });
  }

  function layoutPerson(personId: string): number {
    const existingColumn = columnOf.get(personId);
    if (existingColumn !== undefined) return existingColumn;

    const primaryCoupleId = primaryCoupleOfPerson.get(personId);
    const unitKey = primaryCoupleId
      ? `couple:${primaryCoupleId}`
      : `single:${personId}`;

    if (placedUnits.has(unitKey)) {
      return columnOf.get(personId) ?? cursor;
    }
    placedUnits.add(unitKey);

    let partnerId: string | undefined;
    let childIds: string[];

    if (primaryCoupleId) {
      const couple = coupleById.get(primaryCoupleId);

      if (couple) {
        partnerId =
          couple.parent1Id === personId
            ? couple.parent2Id
            : couple.parent1Id;
      }

      childIds = sortedChildren(
        childrenByCouple.get(primaryCoupleId) ?? []
      );
    } else {
      childIds = sortedChildren(childrenByParent.get(personId) ?? []);
    }

    let personColumn: number;

    if (childIds.length > 0) {
      const childColumns = childIds.map((childId) => layoutPerson(childId));

      // Ganze Spalten verhindern Teilueberlappungen durch Werte wie 4.5.
      personColumn = Math.round(
        childColumns.reduce((sum, column) => sum + column, 0) /
          childColumns.length
      );
    } else {
      personColumn = cursor;
      cursor += 1;
    }

    columnOf.set(personId, personColumn);

    if (partnerId && !columnOf.has(partnerId)) {
      columnOf.set(partnerId, personColumn + 1);
    }

    return personColumn;
  }

  const orderedPeople = [...graph.people].sort((first, second) => {
    const generationDifference =
      (generation.get(first.id) ?? 0) -
      (generation.get(second.id) ?? 0);

    if (generationDifference !== 0) return generationDifference;

    const yearDifference =
      (yearOf(first.birthDate) ?? 9999) -
      (yearOf(second.birthDate) ?? 9999);

    if (yearDifference !== 0) return yearDifference;
    return first.id.localeCompare(second.id);
  });

  for (const person of orderedPeople) {
    if (!columnOf.has(person.id)) {
      layoutPerson(person.id);
    }
  }

  removeColumnCollisions(graph, generation, columnOf, primaryCoupleOfPerson, coupleById);

  const nodes: TreeNode[] = graph.people.map((person) => {
    const partnerIds = (couplesByPerson.get(person.id) ?? [])
      .map((coupleId) => {
        const couple = coupleById.get(coupleId);
        if (!couple) return null;

        return couple.parent1Id === person.id
          ? couple.parent2Id
          : couple.parent1Id;
      })
      .filter((partnerId): partnerId is string =>
        Boolean(partnerId && partnerId !== person.id)
      );

    const parentEntries = parentsByChild.get(person.id) ?? [];
    const parentIds = [...new Set(parentEntries.map((entry) => entry.parentId))];

    // Nicht den ersten Datensatz blind verwenden. Bevorzugt wird eine coupleId,
    // deren Partnerschaft genau zu den gespeicherten Eltern des Kindes passt.
    const matchingCoupleEntry = parentEntries.find((entry) => {
      if (!entry.coupleId) return false;

      const couple = coupleById.get(entry.coupleId);
      if (!couple) return false;

      return (
        parentIds.includes(couple.parent1Id) &&
        parentIds.includes(couple.parent2Id)
      );
    });

    const fallbackCoupleEntry = parentEntries.find(
      (entry) => entry.coupleId != null && coupleById.has(entry.coupleId)
    );

    return {
      person,
      generation: generation.get(person.id) ?? 0,
      column: columnOf.get(person.id) ?? 0,
      partnerIds: [...new Set(partnerIds)],
      childIds: [...(childrenByParent.get(person.id) ?? [])],
      parentIds,
      parentCoupleId:
        matchingCoupleEntry?.coupleId ?? fallbackCoupleEntry?.coupleId ?? null
    };
  });

  return { nodes, columnUnit: 1 };
}

function calculateGenerations(
  graph: FamilyGraph,
  personById: Map<string, FamilyGraph["people"][number]>,
  parentsByChild: Map<
    string,
    { parentId: string; coupleId: string | null }[]
  >,
  childrenByParent: Map<string, Set<string>>,
  couplesByPerson: Map<string, string[]>,
  coupleById: Map<string, FamilyGraph["couples"][number]>,
  rootId?: string
): Map<string, number> {
  const generation = new Map<string, number>();
  const visited = new Set<string>();

  function bfsFrom(startId: string, startGeneration: number): void {
    const queue: Array<[string, number]> = [[startId, startGeneration]];

    while (queue.length > 0) {
      const [personId, personGeneration] = queue.shift()!;
      if (visited.has(personId)) continue;

      visited.add(personId);
      generation.set(personId, personGeneration);

      for (const parent of parentsByChild.get(personId) ?? []) {
        if (!visited.has(parent.parentId)) {
          queue.push([parent.parentId, personGeneration - 1]);
        }
      }

      for (const childId of childrenByParent.get(personId) ?? []) {
        if (!visited.has(childId)) {
          queue.push([childId, personGeneration + 1]);
        }
      }

      for (const coupleId of couplesByPerson.get(personId) ?? []) {
        const couple = coupleById.get(coupleId);
        if (!couple) continue;

        const partnerId =
          couple.parent1Id === personId
            ? couple.parent2Id
            : couple.parent1Id;

        if (!visited.has(partnerId)) {
          queue.push([partnerId, personGeneration]);
        }
      }
    }
  }

  const selectedRoot =
    rootId && personById.has(rootId)
      ? rootId
      : findDefaultRoot(graph, parentsByChild);

  if (selectedRoot) {
    bfsFrom(selectedRoot, 0);
  }

  for (const person of graph.people) {
    if (!visited.has(person.id)) {
      bfsFrom(person.id, 0);
    }
  }

  return generation;
}

function findDefaultRoot(
  graph: FamilyGraph,
  parentsByChild: Map<
    string,
    { parentId: string; coupleId: string | null }[]
  >
): string | undefined {
  const peopleWithoutParents = graph.people.filter(
    (person) => !parentsByChild.has(person.id)
  );

  const candidates =
    peopleWithoutParents.length > 0 ? peopleWithoutParents : graph.people;

  return [...candidates]
    .sort((first, second) => {
      const yearDifference =
        (yearOf(first.birthDate) ?? 9999) -
        (yearOf(second.birthDate) ?? 9999);

      if (yearDifference !== 0) return yearDifference;
      return first.id.localeCompare(second.id);
    })[0]?.id;
}

function removeColumnCollisions(
  graph: FamilyGraph,
  generation: Map<string, number>,
  columnOf: Map<string, number>,
  primaryCoupleOfPerson: Map<string, string>,
  coupleById: Map<string, FamilyGraph["couples"][number]>
): void {
  const peopleByGeneration = new Map<
    number,
    FamilyGraph["people"]
  >();

  for (const person of graph.people) {
    const personGeneration = generation.get(person.id) ?? 0;
    const row = peopleByGeneration.get(personGeneration) ?? [];
    row.push(person);
    peopleByGeneration.set(personGeneration, row);
  }

  for (const people of peopleByGeneration.values()) {
    people.sort((first, second) => {
      const columnDifference =
        (columnOf.get(first.id) ?? 0) -
        (columnOf.get(second.id) ?? 0);

      if (columnDifference !== 0) return columnDifference;

      const yearDifference =
        (yearOf(first.birthDate) ?? 9999) -
        (yearOf(second.birthDate) ?? 9999);

      if (yearDifference !== 0) return yearDifference;
      return first.id.localeCompare(second.id);
    });

    const occupiedColumns = new Set<number>();

    for (const person of people) {
      if (occupiedColumns.has(columnOf.get(person.id) ?? 0)) {
        continue;
      }

      const primaryCoupleId = primaryCoupleOfPerson.get(person.id);
      const couple = primaryCoupleId
        ? coupleById.get(primaryCoupleId)
        : undefined;

      if (couple) {
        const partnerId =
          couple.parent1Id === person.id
            ? couple.parent2Id
            : couple.parent1Id;

        const partnerInSameGeneration = people.some(
          (candidate) => candidate.id === partnerId
        );

        if (partnerInSameGeneration) {
          let startColumn = Math.round(columnOf.get(person.id) ?? 0);

          while (
            occupiedColumns.has(startColumn) ||
            occupiedColumns.has(startColumn + 1)
          ) {
            startColumn += 1;
          }

          columnOf.set(person.id, startColumn);
          columnOf.set(partnerId, startColumn + 1);
          occupiedColumns.add(startColumn);
          occupiedColumns.add(startColumn + 1);
          continue;
        }
      }

      let column = Math.round(columnOf.get(person.id) ?? 0);

      while (occupiedColumns.has(column)) {
        column += 1;
      }

      columnOf.set(person.id, column);
      occupiedColumns.add(column);
    }
  }
}

export function minMaxGeneration(nodes: TreeNode[]): [number, number] {
  if (nodes.length === 0) return [0, 0];

  let minimum = Infinity;
  let maximum = -Infinity;

  for (const node of nodes) {
    if (node.generation < minimum) minimum = node.generation;
    if (node.generation > maximum) maximum = node.generation;
  }

  return [minimum, maximum];
}
