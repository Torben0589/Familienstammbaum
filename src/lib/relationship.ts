// Datei: src/lib/relationship.ts
// Verwandtschaftsrechner (Engine) nach dem "Verwandtschaftslexikon für große Familienstammbäume".
//
// Grundidee: Die Bezeichnung wird NICHT gespeichert, sondern aus dem Beziehungsgraphen berechnet.
// Jede Beziehung bringt Pfad, gemeinsame Vorfahren und Abstände mit. Mehrere Beziehungen zwischen
// denselben Personen werden alle ausgegeben (keine stille Überschreibung).
//
// Perspektive: analyzeRelationship(graph, A, B) beschreibt, was B für A ist.
// Beispiel: B ist Vater von A  ->  label = "Vater", reverseLabel = "Sohn"/"Tochter"/"Kind".

import type { FamilyGraph, Gender, PartnershipType, PersonDTO } from "@/types";

type Id = string;

const MAX_DEPTH = 12; // maximale Generationen aufwärts bei der Vorfahrensuche
const MAX_NAMED_GENERATIONS = 6; // bis hier "Ur-…"-Bezeichnungen, danach "… in n. Generation"

// ---------------------------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------------------------

export type Category = "direct" | "lateral" | "half" | "inlaw" | "step" | "adoptive";

export const CATEGORY_ORDER: Category[] = ["direct", "lateral", "half", "inlaw", "step", "adoptive"];

export const CATEGORY_TITLES: Record<Category, string> = {
  direct: "Direkte Linie",
  lateral: "Seitenlinie",
  half: "Halbverwandtschaft",
  inlaw: "Partnerschaft und angeheiratet",
  step: "Stiefbeziehung",
  adoptive: "Adoptivbeziehung"
};

export interface ChainStep {
  person: PersonDTO;
  role: string; // z. B. "Mutter", "Großvater"; leer bei der Ausgangsperson
}

export interface RelationFinding {
  category: Category;
  label: string; // was B für A ist
  reverseLabel: string; // was A für B ist
  explanation: string;
  uncertain: boolean; // true, wenn Daten fehlen (z. B. zweiter Elternteil unbekannt)
  uncertainNote?: string;
  commonAncestors: PersonDTO[];
  distA?: number; // Generationen von A bis zum gemeinsamen Vorfahren
  distB?: number; // Generationen von B bis zum gemeinsamen Vorfahren
  chainA?: ChainStep[]; // A -> ... -> gemeinsamer Vorfahr
  chainB?: ChainStep[]; // B -> ... -> gemeinsamer Vorfahr
  via?: PersonDTO; // vermittelnde Person bei angeheirateten und Stiefbeziehungen
}

export interface RelationshipAnalysis {
  from: PersonDTO;
  to: PersonDTO;
  same: boolean;
  findings: RelationFinding[];
  connection: PersonDTO[] | null; // nur gefüllt, wenn keine Standardbezeichnung gefunden wurde
}

// ---------------------------------------------------------------------------------------------
// Kleine Helfer für Sprache
// ---------------------------------------------------------------------------------------------

const pick = (g: Gender, m: string, f: string, n: string) => (g === "MALE" ? m : g === "FEMALE" ? f : n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const gens = (n: number) => (n === 1 ? "1 Generation" : `${n} Generationen`);
const times = (n: number) => (n === 1 ? "einmal" : n === 2 ? "zweimal" : n === 3 ? "dreimal" : `${n}-mal`);
const fullName = (p: PersonDTO) => `${p.firstName} ${p.lastName}`.trim();
const isEnded = (t: PartnershipType) => t === "DIVORCED" || t === "SEPARATED";
const ex = (label: string, g: Gender) => `${pick(g, "ehemaliger", "ehemalige", "ehemalige/r")} ${label}`;

function partnershipWord(t: PartnershipType): string {
  switch (t) {
    case "MARRIED":
      return "verheiratet";
    case "PARTNERED":
      return "in einer Partnerschaft";
    case "DIVORCED":
      return "geschieden";
    default:
      return "getrennt";
  }
}

function ancestorsWord(d: number): string {
  if (d <= 0) return "";
  if (d === 1) return "Eltern";
  if (d - 2 > MAX_NAMED_GENERATIONS - 2) return `Vorfahren in der ${d}. Generation`;
  return cap("ur".repeat(d - 2) + "großeltern");
}

/**
 * Bezeichnung der Zielperson relativ zur Bezugsperson bei einer blutsverwandten Beziehung.
 * dF = Generationen von der Bezugsperson bis zum gemeinsamen Vorfahren
 * dT = Generationen von der Zielperson bis zum gemeinsamen Vorfahren
 * Gender g ist das Geschlecht der ZIELPERSON.
 */
export function roleLabel(dF: number, dT: number, g: Gender): string {
  if (dF === 0 && dT === 0) return "Dieselbe Person";

  // Zielperson ist Vorfahr der Bezugsperson
  if (dT === 0) {
    if (dF === 1) return pick(g, "Vater", "Mutter", "Elternteil");
    if (dF > MAX_NAMED_GENERATIONS) return `Vorfahr in der ${dF}. Generation`;
    return cap("ur".repeat(dF - 2) + pick(g, "großvater", "großmutter", "großelternteil"));
  }

  // Zielperson ist Nachkomme der Bezugsperson
  if (dF === 0) {
    if (dT === 1) return pick(g, "Sohn", "Tochter", "Kind");
    if (dT > MAX_NAMED_GENERATIONS) return `Nachkomme in der ${dT}. Generation`;
    return cap("ur".repeat(dT - 2) + pick(g, "enkel", "enkelin", "enkelkind"));
  }

  // Geschwister
  if (dF === 1 && dT === 1) return pick(g, "Bruder", "Schwester", "Geschwister");

  // Neffe / Nichte und deren Nachkommen
  if (dF === 1 && dT >= 2) {
    if (dT === 2) return pick(g, "Neffe", "Nichte", "Geschwisterkind");
    if (dT - 3 > MAX_NAMED_GENERATIONS - 2) return `Nachkomme eines Geschwisters (${dT}. Generation)`;
    return cap("ur".repeat(dT - 3) + pick(g, "großneffe", "großnichte", "großgeschwisterkind"));
  }

  // Onkel / Tante und deren Vorfahrenreihe
  if (dT === 1 && dF >= 2) {
    if (dF === 2) return pick(g, "Onkel", "Tante", "Elterngeschwister");
    if (dF - 3 > MAX_NAMED_GENERATIONS - 2) return `Geschwister eines Vorfahren (${dF}. Generation)`;
    return cap("ur".repeat(dF - 3) + pick(g, "großonkel", "großtante", "großelterngeschwister"));
  }

  // Cousins und Cousinen: Grad = min(dA, dB) - 1, entfernt = |dA - dB|
  const degree = Math.min(dF, dT) - 1;
  const removed = Math.abs(dF - dT);
  const base = pick(g, "Cousin", "Cousine", "Cousin/Cousine");
  return `${base} ${degree}. Grades${removed > 0 ? `, ${times(removed)} entfernt` : ""}`;
}

function halfCousinBase(g: Gender): string {
  return pick(g, "Halbcousin", "Halbcousine", "Halbcousin/-cousine");
}

// ---------------------------------------------------------------------------------------------
// Index über den Graphen
// ---------------------------------------------------------------------------------------------

interface PartnerEdge {
  id: Id;
  type: PartnershipType;
}

interface Index {
  people: Map<Id, PersonDTO>;
  bioParents: Map<Id, Id[]>;
  bioChildren: Map<Id, Id[]>;
  legalParents: Map<Id, Id[]>; // biologisch + adoptiv
  legalChildren: Map<Id, Id[]>;
  stepLinkParents: Map<Id, Id[]>; // Eltern-Kind-Verknüpfungen mit relation = STEP
  impliedCoParents: Map<Id, Set<Id>>; // Paare, an denen eine Eltern-Kind-Verknüpfung hängt
  partners: Map<Id, PartnerEdge[]>;
}

function pushUnique(m: Map<Id, Id[]>, key: Id, value: Id) {
  const list = m.get(key);
  if (!list) m.set(key, [value]);
  else if (!list.includes(value)) list.push(value);
}

function buildIndex(g: FamilyGraph): Index {
  const people = new Map(g.people.map((p) => [p.id, p] as const));
  const ix: Index = {
    people,
    bioParents: new Map(),
    bioChildren: new Map(),
    legalParents: new Map(),
    legalChildren: new Map(),
    stepLinkParents: new Map(),
    impliedCoParents: new Map(),
    partners: new Map()
  };
  const coupleById = new Map(g.couples.map((c) => [c.id, c] as const));

  for (const l of g.links) {
    if (!people.has(l.childId) || !people.has(l.parentId) || l.childId === l.parentId) continue;
    if (l.relation === "STEP") {
      pushUnique(ix.stepLinkParents, l.childId, l.parentId);
      continue;
    }
    pushUnique(ix.legalParents, l.childId, l.parentId);
    pushUnique(ix.legalChildren, l.parentId, l.childId);
    if (l.relation !== "ADOPTED") {
      pushUnique(ix.bioParents, l.childId, l.parentId);
      pushUnique(ix.bioChildren, l.parentId, l.childId);
    }
    if (l.coupleId) {
      const c = coupleById.get(l.coupleId);
      if (c) {
        const set = ix.impliedCoParents.get(l.childId) ?? new Set<Id>();
        set.add(c.parent1Id);
        set.add(c.parent2Id);
        ix.impliedCoParents.set(l.childId, set);
      }
    }
  }

  const addPartner = (a: Id, b: Id, type: PartnershipType) => {
    const list = ix.partners.get(a) ?? [];
    if (!list.some((x) => x.id === b)) list.push({ id: b, type });
    ix.partners.set(a, list);
  };
  for (const c of g.couples) {
    if (!people.has(c.parent1Id) || !people.has(c.parent2Id) || c.parent1Id === c.parent2Id) continue;
    addPartner(c.parent1Id, c.parent2Id, c.type);
    addPartner(c.parent2Id, c.parent1Id, c.type);
  }
  return ix;
}

// ---------------------------------------------------------------------------------------------
// Vorfahren, gemeinsame Vorfahren, Cluster
// ---------------------------------------------------------------------------------------------

interface Anc {
  d: number; // kürzeste Generationenzahl vom Startpunkt
  prev: Id | null; // Knoten, der auf dem kürzesten Weg näher am Startpunkt liegt
}

function ancestorMap(start: Id, parents: Map<Id, Id[]>): Map<Id, Anc> {
  const map = new Map<Id, Anc>([[start, { d: 0, prev: null }]]);
  const queue: Id[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i];
    const dx = map.get(x)!.d;
    if (dx >= MAX_DEPTH) continue;
    for (const p of parents.get(x) ?? []) {
      if (map.has(p)) continue;
      map.set(p, { d: dx + 1, prev: x });
      queue.push(p);
    }
  }
  return map;
}

type HalfStatus = "full" | "half" | "unknown";

interface Cluster {
  dA: number;
  dB: number;
  ancestors: Id[];
  status: HalfStatus;
}

interface LineageResult {
  clusters: Cluster[];
  ma: Map<Id, Anc>;
  mb: Map<Id, Anc>;
}

function lineage(ix: Index, a: Id, b: Id, kind: "bio" | "legal"): LineageResult {
  const parents = kind === "bio" ? ix.bioParents : ix.legalParents;
  const children = kind === "bio" ? ix.bioChildren : ix.legalChildren;
  const ma = ancestorMap(a, parents);
  const mb = ancestorMap(b, parents);

  const common = [...ma.keys()].filter((id) => mb.has(id));
  if (!common.length) return { clusters: [], ma, mb };

  // "Niedrigste" gemeinsame Vorfahren: kein anderer gemeinsamer Vorfahr steht unter ihnen.
  const commonSet = new Set(common);
  const hasLowerCommon = new Set<Id>();
  for (const y of common) {
    for (const x of ancestorMap(y, parents).keys()) {
      if (x !== y && commonSet.has(x)) hasLowerCommon.add(x);
    }
  }
  const lowest = common.filter((x) => !hasLowerCommon.has(x));

  // Zusammengehörige niedrigste Vorfahren (Paare) zu einem Cluster bündeln.
  const linked = (x: Id, y: Id) =>
    (ix.partners.get(x) ?? []).some((p) => p.id === y) ||
    (children.get(x) ?? []).some((c) => (children.get(y) ?? []).includes(c));

  const groups: { dA: number; dB: number; members: Id[] }[] = [];
  for (const x of lowest) {
    const dA = ma.get(x)!.d;
    const dB = mb.get(x)!.d;
    const g = groups.find((gr) => gr.dA === dA && gr.dB === dB && gr.members.some((m) => linked(x, m)));
    if (g) g.members.push(x);
    else groups.push({ dA, dB, members: [x] });
  }

  const clusters: Cluster[] = groups.map((gr) => {
    let status: HalfStatus = "full";
    if (gr.dA >= 1 && gr.dB >= 1 && gr.members.length === 1) {
      // Nur ein gemeinsamer Vorfahr: Halbverwandtschaft oder unvollständige Daten?
      const x = gr.members[0];
      const sideA = (children.get(x) ?? []).filter((c) => ma.get(c)?.d === gr.dA - 1);
      const sideB = (children.get(x) ?? []).filter((c) => mb.get(c)?.d === gr.dB - 1);
      let anyPair = false;
      let unknown = false;
      for (const c1 of sideA) {
        for (const c2 of sideB) {
          if (c1 === c2) continue;
          anyPair = true;
          if ((parents.get(c1)?.length ?? 0) < 2 || (parents.get(c2)?.length ?? 0) < 2) unknown = true;
        }
      }
      status = !anyPair || unknown ? "unknown" : "half";
    }
    return { dA: gr.dA, dB: gr.dB, ancestors: gr.members, status };
  });

  return { clusters, ma, mb };
}

function chainTo(ix: Index, map: Map<Id, Anc>, target: Id, startRole: string): ChainStep[] {
  const ids: Id[] = [];
  let cur: Id | null = target;
  while (cur) {
    ids.push(cur);
    cur = map.get(cur)?.prev ?? null;
  }
  ids.reverse();
  return ids.map((id, i) => {
    const person = ix.people.get(id)!;
    return { person, role: i === 0 ? startRole : roleLabel(i, 0, person.gender) };
  });
}

// ---------------------------------------------------------------------------------------------
// Blutsverwandtschaft und Adoption (Linien über gemeinsame Vorfahren)
// ---------------------------------------------------------------------------------------------

function lineageExplanation(A: PersonDTO, B: PersonDTO, c: Cluster, ancestors: PersonDTO[]): string {
  if (c.dA === 0) {
    return `${B.firstName} ist ${gens(c.dB)} unter ${A.firstName} in direkter Linie (Nachkomme).`;
  }
  if (c.dB === 0) {
    return `${B.firstName} ist ${gens(c.dA)} über ${A.firstName} in direkter Linie (Vorfahr).`;
  }
  const names = ancestors.map(fullName).join(" und ");
  const forA = ancestorsWord(c.dA);
  const forB = ancestorsWord(c.dB);
  const roles = c.dA === c.dB ? `${forA} beider Personen` : `für ${A.firstName}: ${forA}, für ${B.firstName}: ${forB}`;
  return `Gemeinsame Vorfahren: ${names} (${roles}).`;
}

function bloodLabels(c: Cluster, gA: Gender, gB: Gender): { label: string; reverse: string; category: Category } {
  const direct = c.dA === 0 || c.dB === 0;
  const label = roleLabel(c.dA, c.dB, gB);
  const reverse = roleLabel(c.dB, c.dA, gA);
  if (direct || c.status === "full") {
    return { label, reverse, category: direct ? "direct" : "lateral" };
  }

  // Halbverwandtschaft bzw. unvollständige Daten
  const sibling = c.dA === 1 && c.dB === 1;
  const cousin = c.dA >= 2 && c.dB >= 2;
  const removed = Math.abs(c.dA - c.dB);
  const degree = Math.min(c.dA, c.dB) - 1;
  const tail = () => ` ${degree}. Grades${removed > 0 ? `, ${times(removed)} entfernt` : ""}`;

  if (c.status === "half") {
    if (sibling) {
      return {
        label: pick(gB, "Halbbruder", "Halbschwester", "Halbgeschwister"),
        reverse: pick(gA, "Halbbruder", "Halbschwester", "Halbgeschwister"),
        category: "half"
      };
    }
    if (cousin) {
      return { label: halfCousinBase(gB) + tail(), reverse: halfCousinBase(gA) + tail(), category: "half" };
    }
    return { label: `${label} (über Halbgeschwister)`, reverse: `${reverse} (über Halbgeschwister)`, category: "half" };
  }

  // unknown
  if (sibling) {
    return {
      label: "Geschwister oder Halbgeschwister",
      reverse: "Geschwister oder Halbgeschwister",
      category: "half"
    };
  }
  if (cousin) {
    return {
      label: `${label} oder ${halfCousinBase(gB)}${tail()}`,
      reverse: `${reverse} oder ${halfCousinBase(gA)}${tail()}`,
      category: "half"
    };
  }
  return { label: `${label} (evtl. Halbverwandtschaft)`, reverse: `${reverse} (evtl. Halbverwandtschaft)`, category: "half" };
}

function adoptiveLabels(c: Cluster, gA: Gender, gB: Gender): { label: string; reverse: string } {
  const one = (dF: number, dT: number, g: Gender): string => {
    if (dF === 1 && dT === 0) return pick(g, "Adoptivvater", "Adoptivmutter", "Adoptivelternteil");
    if (dF === 0 && dT === 1) return pick(g, "Adoptivsohn", "Adoptivtochter", "Adoptivkind");
    if (dF === 1 && dT === 1) return pick(g, "Adoptivbruder", "Adoptivschwester", "Adoptivgeschwister");
    return `${roleLabel(dF, dT, g)} (über Adoption)`;
  };
  return { label: one(c.dA, c.dB, gB), reverse: one(c.dB, c.dA, gA) };
}

function lineageFindings(ix: Index, a: Id, b: Id): RelationFinding[] {
  const A = ix.people.get(a)!;
  const B = ix.people.get(b)!;
  const out: RelationFinding[] = [];

  const toFinding = (
    c: Cluster,
    res: LineageResult,
    labels: { label: string; reverse: string; category: Category },
    adoptive: boolean
  ): RelationFinding => {
    const ancestors = c.ancestors.map((id) => ix.people.get(id)!).filter(Boolean);
    const first = c.ancestors[0];
    let uncertainNote: string | undefined;
    if (c.status === "unknown" && !adoptive) {
      uncertainNote = "Bei mindestens einer Person ist ein Elternteil nicht erfasst. Ob es sich um volle oder halbe Verwandtschaft handelt, lässt sich aus den Daten nicht sicher bestimmen.";
    }
    let explanation = lineageExplanation(A, B, c, ancestors);
    if (adoptive) explanation += " Die Verbindung läuft über mindestens eine Adoption (rechtliche Beziehung, nicht biologisch).";
    return {
      category: labels.category,
      label: labels.label,
      reverseLabel: labels.reverse,
      explanation,
      uncertain: c.status === "unknown" && !adoptive,
      uncertainNote,
      commonAncestors: ancestors,
      distA: c.dA,
      distB: c.dB,
      chainA: chainTo(ix, res.ma, first, "Ausgangsperson"),
      chainB: chainTo(ix, res.mb, first, "Zielperson"),
    };
  };

  const bio = lineage(ix, a, b, "bio");
  const used = new Set<Id>();
  for (const c of bio.clusters) {
    c.ancestors.forEach((x) => used.add(x));
    out.push(toFinding(c, bio, bloodLabels(c, A.gender, B.gender), false));
  }

  const legal = lineage(ix, a, b, "legal");
  for (const c of legal.clusters) {
    if (c.ancestors.every((x) => used.has(x))) continue; // schon als biologische Beziehung erfasst
    const l = adoptiveLabels(c, A.gender, B.gender);
    out.push(toFinding(c, legal, { label: l.label, reverse: l.reverse, category: "adoptive" }, true));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Partner, angeheiratet
// ---------------------------------------------------------------------------------------------

function partnerLabel(type: PartnershipType, g: Gender): string {
  const base = type === "PARTNERED" ? pick(g, "Partner", "Partnerin", "Partner/in") : pick(g, "Ehemann", "Ehefrau", "Ehepartner/in");
  return isEnded(type) ? ex(base, g) : base;
}

/** B ist blutsverwandt mit dem Partner von A (Referenz: Partner S). */
function relativeOfPartnerLabel(dF: number, dT: number, g: Gender, type: PartnershipType, partner: PersonDTO): string {
  let label: string;
  if (type === "PARTNERED") {
    label = `${roleLabel(dF, dT, g)} (über Partner/in ${partner.firstName})`;
  } else if (dT === 0 && dF === 1) {
    label = pick(g, "Schwiegervater", "Schwiegermutter", "Schwiegerelternteil");
  } else if (dT === 0 && dF === 2) {
    label = pick(g, "Schwiegergroßvater", "Schwiegergroßmutter", "Schwiegergroßelternteil");
  } else if (dT === 0 && dF <= MAX_NAMED_GENERATIONS) {
    const ur = "ur".repeat(dF - 2);
    label = `Schwieger-${ur}${pick(g, "großvater", "großmutter", "großelternteil")}`;
  } else if (dT === 1 && dF === 1) {
    label = pick(g, "Schwager", "Schwägerin", "Schwager/Schwägerin");
  } else {
    label = `${pick(g, "angeheirateter", "angeheiratete", "angeheiratete/r")} ${roleLabel(dF, dT, g)}`;
  }
  return isEnded(type) ? ex(label, g) : label;
}

/** B ist Partner einer blutsverwandten Person R von A. */
function partnerOfRelativeLabel(dF: number, dT: number, g: Gender, type: PartnershipType, relative: PersonDTO): string {
  let label: string;
  if (type === "PARTNERED") {
    label = `${pick(g, "Partner", "Partnerin", "Partner/in")} von ${relative.firstName} (${roleLabel(dF, dT, relative.gender)})`;
  } else if (dF === 0 && dT === 1) {
    label = pick(g, "Schwiegersohn", "Schwiegertochter", "Schwiegerkind");
  } else if (dF === 1 && dT === 1) {
    label = pick(g, "Schwager", "Schwägerin", "Schwager/Schwägerin");
  } else {
    label = `${pick(g, "angeheirateter", "angeheiratete", "angeheiratete/r")} ${roleLabel(dF, dT, g)}`;
  }
  return isEnded(type) ? ex(label, g) : label;
}

function bioClusters(ix: Index, x: Id, y: Id): Cluster[] {
  return lineage(ix, x, y, "bio").clusters;
}

function partnerFinding(ix: Index, a: Id, b: Id): RelationFinding | null {
  const A = ix.people.get(a)!;
  const B = ix.people.get(b)!;
  const edge = (ix.partners.get(a) ?? []).find((p) => p.id === b);
  if (!edge) return null;
  return {
    category: "inlaw",
    label: partnerLabel(edge.type, B.gender),
    reverseLabel: partnerLabel(edge.type, A.gender),
    explanation: `${A.firstName} und ${B.firstName} sind als ${partnershipWord(edge.type)} gespeichert.`,
    uncertain: false,
    commonAncestors: []
  };
}

function inLawFindings(ix: Index, a: Id, b: Id): RelationFinding[] {
  const A = ix.people.get(a)!;
  const B = ix.people.get(b)!;
  const out: RelationFinding[] = [];
  const seen = new Set<string>();
  const add = (f: RelationFinding) => {
    const key = `${f.label}|${f.via?.id ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };

  // (1) B ist blutsverwandt mit dem Partner von A (Schwiegereltern, Schwager, angeheirateter Onkel ...)
  for (const pt of ix.partners.get(a) ?? []) {
    if (pt.id === b) continue;
    const S = ix.people.get(pt.id)!;
    for (const c of bioClusters(ix, pt.id, b)) {
      if (c.dA === 0 && c.dB >= 1) continue; // Kinder des Partners: siehe Stiefbeziehung
      add({
        category: "inlaw",
        label: relativeOfPartnerLabel(c.dA, c.dB, B.gender, pt.type, S),
        reverseLabel: partnerOfRelativeLabel(c.dB, c.dA, A.gender, pt.type, S),
        explanation: `${S.firstName} ist ${partnershipWord(pt.type)} mit ${A.firstName}. ${B.firstName} ist für ${S.firstName}: ${roleLabel(c.dA, c.dB, B.gender)}.`,
        uncertain: false,
        commonAncestors: c.ancestors.map((id) => ix.people.get(id)!).filter(Boolean),
        via: S
      });
    }
  }

  // (2) B ist Partner einer blutsverwandten Person von A (Schwiegerkind, Schwager, angeheiratete Tante ...)
  for (const pt of ix.partners.get(b) ?? []) {
    if (pt.id === a) continue;
    const R = ix.people.get(pt.id)!;
    for (const c of bioClusters(ix, a, pt.id)) {
      if (c.dA === 1 && c.dB === 0) continue; // Partner eines Elternteils: siehe Stiefbeziehung
      add({
        category: "inlaw",
        label: partnerOfRelativeLabel(c.dA, c.dB, B.gender, pt.type, R),
        reverseLabel: relativeOfPartnerLabel(c.dB, c.dA, A.gender, pt.type, R),
        explanation: `${R.firstName} ist für ${A.firstName}: ${roleLabel(c.dA, c.dB, R.gender)}. ${B.firstName} ist ${partnershipWord(pt.type)} mit ${R.firstName}.`,
        uncertain: false,
        commonAncestors: c.ancestors.map((id) => ix.people.get(id)!).filter(Boolean),
        via: R
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Stiefbeziehungen
// ---------------------------------------------------------------------------------------------

interface StepParent {
  id: Id;
  ended: boolean;
}

function stepParentsOf(ix: Index, child: Id): StepParent[] {
  const legal = new Set(ix.legalParents.get(child) ?? []);
  const implied = ix.impliedCoParents.get(child) ?? new Set<Id>();
  const found = new Map<Id, boolean>(); // id -> alle verbindenden Partnerschaften beendet?

  for (const p of legal) {
    for (const pt of ix.partners.get(p) ?? []) {
      if (pt.id === child || legal.has(pt.id) || implied.has(pt.id)) continue;
      const ended = isEnded(pt.type);
      found.set(pt.id, found.has(pt.id) ? found.get(pt.id)! && ended : ended);
    }
  }
  for (const s of ix.stepLinkParents.get(child) ?? []) {
    if (!legal.has(s)) found.set(s, false);
  }
  return [...found].map(([id, ended]) => ({ id, ended }));
}

function stepWord(kind: "parent" | "child" | "sibling", g: Gender, ended: boolean): string {
  const base =
    kind === "parent"
      ? pick(g, "Stiefvater", "Stiefmutter", "Stiefelternteil")
      : kind === "child"
      ? pick(g, "Stiefsohn", "Stieftochter", "Stiefkind")
      : pick(g, "Stiefbruder", "Stiefschwester", "Stiefgeschwister");
  return ended ? ex(base, g) : base;
}

function stepFindings(ix: Index, a: Id, b: Id): RelationFinding[] {
  const A = ix.people.get(a)!;
  const B = ix.people.get(b)!;
  const out: RelationFinding[] = [];
  const spA = stepParentsOf(ix, a);
  const spB = stepParentsOf(ix, b);

  const asParent = spA.find((s) => s.id === b);
  if (asParent) {
    out.push({
      category: "step",
      label: stepWord("parent", B.gender, asParent.ended),
      reverseLabel: stepWord("child", A.gender, asParent.ended),
      explanation: `${B.firstName} ist Partner/in eines Elternteils von ${A.firstName}, aber nicht selbst als Elternteil gespeichert (keine Adoption).`,
      uncertain: false,
      commonAncestors: []
    });
  }
  const asChild = spB.find((s) => s.id === a);
  if (asChild) {
    out.push({
      category: "step",
      label: stepWord("child", B.gender, asChild.ended),
      reverseLabel: stepWord("parent", A.gender, asChild.ended),
      explanation: `${A.firstName} ist Partner/in eines Elternteils von ${B.firstName}, aber nicht selbst als Elternteil gespeichert (keine Adoption).`,
      uncertain: false,
      commonAncestors: []
    });
  }

  // Stiefgeschwister: Kinder des Stiefelternteils, ohne gemeinsamen Elternteil
  const pa = new Set(ix.legalParents.get(a) ?? []);
  const pb = ix.legalParents.get(b) ?? [];
  if (!pb.some((p) => pa.has(p))) {
    let via: StepParent | undefined = spA.find((s) => (ix.legalChildren.get(s.id) ?? []).includes(b));
    if (!via) via = spB.find((s) => (ix.legalChildren.get(s.id) ?? []).includes(a));
    if (via) {
      const V = ix.people.get(via.id)!;
      out.push({
        category: "step",
        label: stepWord("sibling", B.gender, via.ended),
        reverseLabel: stepWord("sibling", A.gender, via.ended),
        explanation: `Verbunden über ${fullName(V)}: Stiefelternteil der einen und Elternteil der anderen Person. Es gibt keinen gemeinsamen Elternteil.`,
        uncertain: false,
        commonAncestors: [],
        via: V
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Fallback: irgendein Verbindungsweg (nur wenn keine Standardbezeichnung gefunden wurde)
// ---------------------------------------------------------------------------------------------

function connectionPath(ix: Index, a: Id, b: Id, maxSteps = 14): PersonDTO[] | null {
  const adj = new Map<Id, Id[]>();
  const link = (x: Id, y: Id) => {
    pushUnique(adj, x, y);
    pushUnique(adj, y, x);
  };
  for (const [c, ps] of ix.legalParents) ps.forEach((p) => link(c, p));
  for (const [c, ps] of ix.stepLinkParents) ps.forEach((p) => link(c, p));
  for (const [x, ps] of ix.partners) ps.forEach((p) => link(x, p.id));

  const prev = new Map<Id, Id | null>([[a, null]]);
  const depth = new Map<Id, number>([[a, 0]]);
  const queue: Id[] = [a];
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i];
    if (x === b) break;
    if ((depth.get(x) ?? 0) >= maxSteps) continue;
    for (const y of adj.get(x) ?? []) {
      if (prev.has(y)) continue;
      prev.set(y, x);
      depth.set(y, (depth.get(x) ?? 0) + 1);
      queue.push(y);
    }
  }
  if (!prev.has(b)) return null;
  const ids: Id[] = [];
  let cur: Id | null = b;
  while (cur) {
    ids.push(cur);
    cur = prev.get(cur) ?? null;
  }
  return ids.reverse().map((id) => ix.people.get(id)!);
}

// ---------------------------------------------------------------------------------------------
// Einstiegspunkt
// ---------------------------------------------------------------------------------------------

export function analyzeRelationship(graph: FamilyGraph, aId: string, bId: string): RelationshipAnalysis | null {
  const ix = buildIndex(graph);
  const A = ix.people.get(aId);
  const B = ix.people.get(bId);
  if (!A || !B) return null;
  if (aId === bId) return { from: A, to: B, same: true, findings: [], connection: null };

  const findings: RelationFinding[] = [];
  findings.push(...lineageFindings(ix, aId, bId));
  const partner = partnerFinding(ix, aId, bId);
  if (partner) findings.push(partner);
  findings.push(...inLawFindings(ix, aId, bId));
  findings.push(...stepFindings(ix, aId, bId));

  const weight = (f: RelationFinding) => (f.distA ?? 0) + (f.distB ?? 0);
  findings.sort((x, y) => {
    const c = CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category);
    if (c !== 0) return c;
    return weight(x) - weight(y);
  });

  return {
    from: A,
    to: B,
    same: false,
    findings,
    connection: findings.length ? null : connectionPath(ix, aId, bId)
  };
}
