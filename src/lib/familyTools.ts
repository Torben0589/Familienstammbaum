import type { FamilyGraph, PersonDTO } from "@/types";

export interface FamilyStatistics {
  people: number;
  living: number;
  deceased: number;
  couples: number;
  generations: number;
  youngest?: { person: PersonDTO; age: number };
  oldest?: { person: PersonDTO; age: number };
  averageAge?: number;
  peopleByGeneration: { generation: number; count: number }[];
}

function exactDate(value?: string | null): Date | null {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageAt(birth: Date, end: Date): number {
  let age = end.getFullYear() - birth.getFullYear();
  if (end.getMonth() < birth.getMonth() || (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate())) age--;
  return age;
}

export function buildFamilyStatistics(
  graph: FamilyGraph,
  generations: Map<string, number>,
  today = new Date()
): FamilyStatistics {
  const livingAges: { person: PersonDTO; age: number }[] = [];
  const allAges: number[] = [];
  for (const person of graph.people) {
    const birth = exactDate(person.birthDate);
    if (!birth) continue;
    const death = exactDate(person.deathDate);
    const age = ageAt(birth, death ?? today);
    if (age < 0 || age > 130) continue;
    allAges.push(age);
    if (!person.deathDate?.trim()) livingAges.push({ person, age });
  }
  livingAges.sort((a, b) => a.age - b.age);
  const generationCounts = new Map<number, number>();
  for (const person of graph.people) {
    const generation = generations.get(person.id) ?? 0;
    generationCounts.set(generation, (generationCounts.get(generation) ?? 0) + 1);
  }
  return {
    people: graph.people.length,
    living: graph.people.filter((p) => !p.deathDate?.trim()).length,
    deceased: graph.people.filter((p) => Boolean(p.deathDate?.trim())).length,
    couples: graph.couples.length,
    generations: generationCounts.size,
    youngest: livingAges[0],
    oldest: livingAges[livingAges.length - 1],
    averageAge: allAges.length ? Math.round((allAges.reduce((a, b) => a + b, 0) / allAges.length) * 10) / 10 : undefined,
    peopleByGeneration: [...generationCounts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([generation, count]) => ({ generation, count }))
  };
}

type EdgeKind = "parent" | "child" | "partner";
interface Edge { to: string; kind: EdgeKind }
export interface RelationshipResult { label: string; path: PersonDTO[]; steps: EdgeKind[] }

function genderWord(person: PersonDTO, male: string, female: string, neutral: string): string {
  return person.gender === "MALE" ? male : person.gender === "FEMALE" ? female : neutral;
}

export function findRelationship(graph: FamilyGraph, fromId: string, toId: string): RelationshipResult | null {
  if (fromId === toId) {
    const person = graph.people.find((p) => p.id === fromId);
    return person ? { label: "Dieselbe Person", path: [person], steps: [] } : null;
  }
  const people = new Map(graph.people.map((p) => [p.id, p]));
  const adjacency = new Map<string, Edge[]>();
  const add = (from: string, edge: Edge) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    if (!adjacency.get(from)!.some((e) => e.to === edge.to && e.kind === edge.kind)) adjacency.get(from)!.push(edge);
  };
  for (const link of graph.links) {
    add(link.childId, { to: link.parentId, kind: "parent" });
    add(link.parentId, { to: link.childId, kind: "child" });
  }
  for (const couple of graph.couples) {
    add(couple.parent1Id, { to: couple.parent2Id, kind: "partner" });
    add(couple.parent2Id, { to: couple.parent1Id, kind: "partner" });
  }
  const queue: { id: string; ids: string[]; steps: EdgeKind[] }[] = [{ id: fromId, ids: [fromId], steps: [] }];
  const seen = new Set([fromId]);
  let found: { ids: string[]; steps: EdgeKind[] } | null = null;
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current.steps.length >= 8) continue;
    for (const edge of adjacency.get(current.id) ?? []) {
      if (seen.has(edge.to)) continue;
      const next = { id: edge.to, ids: [...current.ids, edge.to], steps: [...current.steps, edge.kind] };
      if (edge.to === toId) { found = next; break; }
      seen.add(edge.to);
      queue.push(next);
    }
    if (found) break;
  }
  if (!found) return null;
  const target = people.get(toId)!;
  const s = found.steps.join(",");
  let label = "Verwandte Person";
  if (s === "parent") label = genderWord(target, "Vater", "Mutter", "Elternteil");
  else if (s === "child") label = genderWord(target, "Sohn", "Tochter", "Kind");
  else if (s === "partner") label = genderWord(target, "Partner/Ehemann", "Partnerin/Ehefrau", "Partnerperson");
  else if (s === "parent,parent") label = genderWord(target, "Großvater", "Großmutter", "Großelternteil");
  else if (s === "child,child") label = genderWord(target, "Enkel", "Enkelin", "Enkelkind");
  else if (s === "parent,child") label = genderWord(target, "Bruder", "Schwester", "Geschwister");
  else if (s === "partner,parent") label = genderWord(target, "Schwiegervater", "Schwiegermutter", "Schwiegerelternteil");
  else if (s === "child,partner") label = genderWord(target, "Schwiegersohn", "Schwiegertochter", "Schwiegerkind");
  else if (s === "parent,parent,child") label = genderWord(target, "Onkel", "Tante", "Elterngeschwister");
  else if (s === "parent,child,child") label = genderWord(target, "Neffe", "Nichte", "Geschwisterkind");
  else if (s === "parent,parent,child,child") label = genderWord(target, "Cousin", "Cousine", "Cousin/Cousine");
  else if (s === "parent,child,partner" || s === "partner,parent,child") label = genderWord(target, "Schwager", "Schwägerin", "angeheiratetes Geschwister");
  else if (/^(parent,)+parent$/.test(s)) {
    const n = found.steps.length;
    label = `${"Ur".repeat(Math.max(0, n - 2))}${genderWord(target, "großvater", "großmutter", "großelternteil")}`;
    label = label.charAt(0).toUpperCase() + label.slice(1);
  } else if (/^(child,)+child$/.test(s)) {
    const n = found.steps.length;
    label = `${"Ur".repeat(Math.max(0, n - 2))}${genderWord(target, "enkel", "enkelin", "enkelkind")}`;
    label = label.charAt(0).toUpperCase() + label.slice(1);
  }
  return { label, path: found.ids.map((id) => people.get(id)!).filter(Boolean), steps: found.steps };
}
