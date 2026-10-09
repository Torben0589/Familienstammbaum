// Datei: scripts/test-relationship.ts
// Prüft die Berechnung des Verwandtschaftsrechners gegen die Testfälle aus dem Verwandtschaftslexikon
// (Seite 7) und gegen zusätzliche Randfälle.
//
// Ausführen im Codespace:
//   npx --yes tsx scripts/test-relationship.ts
//
// Das Skript verändert weder Datenbank noch App.

import { analyzeRelationship } from "../src/lib/relationship";
import type { FamilyGraph, PersonDTO } from "../src/types";

type Gender = PersonDTO["gender"];

class Builder {
  people: FamilyGraph["people"] = [];
  couples: FamilyGraph["couples"] = [];
  links: FamilyGraph["links"] = [];

  person(id: string, gender: Gender = "UNKNOWN") {
    this.people.push({ id, firstName: id, lastName: "T", gender });
    return this;
  }
  persons(ids: string[], gender: Gender = "UNKNOWN") {
    ids.forEach((id) => this.person(id, gender));
    return this;
  }
  parent(parentId: string, childId: string, relation: "BIOLOGICAL" | "ADOPTED" | "STEP" = "BIOLOGICAL", coupleId?: string) {
    this.links.push({ id: `l${this.links.length}`, parentId, childId, relation, coupleId: coupleId ?? null });
    return this;
  }
  /** Beide Eltern auf einmal */
  parents(a: string, b: string, childId: string) {
    return this.parent(a, childId).parent(b, childId);
  }
  couple(a: string, b: string, type: "MARRIED" | "PARTNERED" | "DIVORCED" | "SEPARATED" = "MARRIED", id?: string) {
    this.couples.push({ id: id ?? `c${this.couples.length}`, type, parent1Id: a, parent2Id: b });
    return this;
  }
  graph(): FamilyGraph {
    return { people: this.people, couples: this.couples, links: this.links };
  }
}

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  OK    ${name}`);
  } else {
    failed++;
    console.log(`  FEHLER ${name}\n         erwartet: ${JSON.stringify(expected)}\n         erhalten: ${JSON.stringify(actual)}`);
  }
}

/** Label von B aus Sicht von A (erstes = wichtigstes Ergebnis) */
function label(b: Builder, a: string, to: string): string | undefined {
  return analyzeRelationship(b.graph(), a, to)?.findings[0]?.label;
}
function labels(b: Builder, a: string, to: string): string[] {
  return analyzeRelationship(b.graph(), a, to)?.findings.map((f) => f.label) ?? [];
}

console.log("\nTestfälle aus dem Lexikon (Seite 7)");

{
  const g = new Builder().person("A").person("B").parent("A", "B");
  check("A ist Elternteil von B: B sieht A als Elternteil", label(g, "B", "A"), "Elternteil");
  check("A ist Elternteil von B: A sieht B als Kind", label(g, "A", "B"), "Kind");
}
{
  const g = new Builder().persons(["A", "M", "B"]).parent("A", "M").parent("M", "B");
  check("A ist Großelternteil von B", label(g, "B", "A"), "Großelternteil");
  check("A sieht B als Enkelkind", label(g, "A", "B"), "Enkelkind");
}
{
  const g = new Builder().persons(["P", "Q", "A", "B"]).parents("P", "Q", "A").parents("P", "Q", "B");
  check("Beide Eltern gemeinsam: Geschwister", label(g, "A", "B"), "Geschwister");
}
{
  const g = new Builder().persons(["P", "Q1", "Q2", "A", "B"]).parents("P", "Q1", "A").parents("P", "Q2", "B");
  check("Genau ein gemeinsamer Elternteil (beide zweiten Elternteile bekannt): Halbgeschwister", label(g, "A", "B"), "Halbgeschwister");
}
{
  // Eltern von A und B sind Geschwister -> Cousins 1. Grades
  const g = new Builder().persons(["G", "H", "F1", "F2", "A", "B"]);
  g.parents("G", "H", "F1").parents("G", "H", "F2").parent("F1", "A").parent("F2", "B");
  check("Eltern sind Geschwister: Cousin/Cousine 1. Grades", label(g, "A", "B"), "Cousin/Cousine 1. Grades");
}
{
  const g = new Builder().persons(["G", "H", "S1", "S2", "F1", "F2", "A", "B"]);
  g.parents("G", "H", "S1").parents("G", "H", "S2").parent("S1", "F1").parent("S2", "F2").parent("F1", "A").parent("F2", "B");
  check("Großeltern sind Geschwister: Cousin/Cousine 2. Grades", label(g, "A", "B"), "Cousin/Cousine 2. Grades");
}
{
  const g = new Builder().persons(["G", "H", "T1", "T2", "S1", "S2", "F1", "F2", "A", "B"]);
  g.parents("G", "H", "T1").parents("G", "H", "T2");
  g.parent("T1", "S1").parent("T2", "S2").parent("S1", "F1").parent("S2", "F2").parent("F1", "A").parent("F2", "B");
  check("Urgroßeltern sind Geschwister: Cousin/Cousine 3. Grades", label(g, "A", "B"), "Cousin/Cousine 3. Grades");
}
{
  // B ist Kind des Cousins 1. Grades von A
  const g = new Builder().persons(["G", "H", "F1", "F2", "A", "C", "B"]);
  g.parents("G", "H", "F1").parents("G", "H", "F2").parent("F1", "A").parent("F2", "C").parent("C", "B");
  check("B ist Kind des Cousins 1. Grades von A", label(g, "A", "B"), "Cousin/Cousine 1. Grades, einmal entfernt");
  check("Umgekehrt ebenfalls einmal entfernt", label(g, "B", "A"), "Cousin/Cousine 1. Grades, einmal entfernt");
}
{
  // A ist Bruder des Vaters von B
  const g = new Builder().persons(["G", "H", "F", "B"]).person("A", "MALE");
  g.parents("G", "H", "F").parents("G", "H", "A").parent("F", "B");
  check("A ist Bruder des Vaters von B: A ist Onkel", label(g, "B", "A"), "Onkel");
  g.people.find((p) => p.id === "B")!.gender = "FEMALE";
  check("... und B ist für A die Nichte", label(g, "A", "B"), "Nichte");
}
{
  // A ist Vater des Ehepartners von B
  const g = new Builder().person("A", "MALE").person("S").person("B", "FEMALE");
  g.parent("A", "S").couple("S", "B");
  check("A ist Vater des Ehepartners von B: Schwiegervater", label(g, "B", "A"), "Schwiegervater");
  check("... und B ist für A die Schwiegertochter", label(g, "A", "B"), "Schwiegertochter");
}
{
  // Stiefelternteil ohne Adoption
  const g = new Builder().person("A", "MALE").person("P").person("B", "MALE");
  g.parent("P", "B").couple("P", "A");
  check("Stiefvater (keine Adoption)", label(g, "B", "A"), "Stiefvater");
  check("Stiefsohn aus Sicht des Stiefvaters", label(g, "A", "B"), "Stiefsohn");
  check("Stiefelternteil erscheint nicht als biologischer Elternteil", analyzeRelationship(g.graph(), "B", "A")?.findings.some((f) => f.category === "direct"), false);
}
{
  // Adoptivelternteil, biologischer Pfad getrennt
  const g = new Builder().person("A", "MALE").person("B");
  g.parent("A", "B", "ADOPTED");
  check("Adoptivvater", label(g, "B", "A"), "Adoptivvater");
  check("Adoptivkind", label(g, "A", "B"), "Adoptivkind");
  check("Adoption ist nicht als biologische Linie eingeordnet", analyzeRelationship(g.graph(), "B", "A")?.findings[0].category, "adoptive");
}
{
  // Mehrere gemeinsame Vorfahren: doppelte Cousins -> mehrere Beziehungen, nichts wird überschrieben
  const g = new Builder().persons(["G1", "G2", "G3", "G4", "F", "F2", "M", "M2", "A", "B"]);
  g.parents("G1", "G2", "F").parents("G1", "G2", "F2").parents("G3", "G4", "M").parents("G3", "G4", "M2");
  g.parents("F", "M", "A").parents("F2", "M2", "B");
  const f = analyzeRelationship(g.graph(), "A", "B")!.findings;
  check("Doppelte Cousins: zwei Beziehungen", f.length, 2);
  check("... beide Cousin/Cousine 1. Grades", f.map((x) => x.label), ["Cousin/Cousine 1. Grades", "Cousin/Cousine 1. Grades"]);
}

console.log("\nDirekte Linie");
{
  const g = new Builder().persons(["U", "G", "M", "A"]).person("B", "MALE");
  // Kette: B(Urgroßvater) -> G -> M -> A
  g.parent("B", "G").parent("G", "M").parent("M", "A");
  check("Urgroßvater", label(g, "A", "B"), "Urgroßvater");
  check("Urenkelkind aus Sicht von B", label(g, "B", "A"), "Urenkelkind");
}
{
  const ids = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"];
  const g = new Builder().persons(["X", ...ids]);
  g.parent("P1", "X");
  for (let i = 1; i < ids.length; i++) g.parent(ids[i], ids[i - 1]);
  check("6 Generationen aufwärts: Ururururgroßelternteil", label(g, "X", "P6"), "Ururururgroßelternteil");
  check("7 Generationen: Zahl statt endloser Ur-Kette", label(g, "X", "P7"), "Vorfahr in der 7. Generation");
  check("7 Generationen abwärts", label(g, "P7", "X"), "Nachkomme in der 7. Generation");
}

console.log("\nSeitenlinie");
{
  // A ist Bruder des Großvaters von B -> Großonkel
  const g = new Builder().persons(["G", "H", "GV", "F", "B"]).person("A", "MALE");
  g.parents("G", "H", "GV").parents("G", "H", "A").parent("GV", "F").parent("F", "B");
  check("Großonkel", label(g, "B", "A"), "Großonkel");
  check("Großneffe/-nichte (neutral)", label(g, "A", "B"), "Großgeschwisterkind");
}
{
  const g = new Builder().persons(["G", "H", "F1", "F2", "A", "C", "D", "B"]);
  g.parents("G", "H", "F1").parents("G", "H", "F2").parent("F1", "A").parent("F2", "C").parent("C", "D").parent("D", "B");
  check("Cousin 1. Grades, zweimal entfernt", label(g, "A", "B"), "Cousin/Cousine 1. Grades, zweimal entfernt");
}

console.log("\nHalbverwandtschaft und unvollständige Daten");
{
  // Nur ein Elternteil bei A bekannt -> keine voreilige Klassifizierung
  const g = new Builder().persons(["P", "Q", "A", "B"]);
  g.parent("P", "A").parents("P", "Q", "B");
  const f = analyzeRelationship(g.graph(), "A", "B")!.findings[0];
  check("Zweiter Elternteil unbekannt: Geschwister oder Halbgeschwister", f.label, "Geschwister oder Halbgeschwister");
  check("... mit Unsicherheits-Hinweis", f.uncertain, true);
}
{
  // Halbcousins: Eltern sind Halbgeschwister, alle Elternteile bekannt
  const g = new Builder().persons(["G", "H1", "H2", "F1", "F2", "W1", "W2", "A", "B"]);
  g.parents("G", "H1", "F1").parents("G", "H2", "F2").parents("F1", "W1", "A").parents("F2", "W2", "B");
  check("Halbcousin 1. Grades", label(g, "A", "B"), "Halbcousin/-cousine 1. Grades");
}

console.log("\nAngeheiratet und Partnerschaften");
{
  const g = new Builder().person("A", "MALE").person("S", "FEMALE").person("B", "MALE");
  g.couple("A", "S").persons(["P", "Q"]).parents("P", "Q", "S").parents("P", "Q", "B");
  check("Bruder des Ehepartners: Schwager", label(g, "A", "B"), "Schwager");
}
{
  const g = new Builder().person("A", "MALE").person("R", "FEMALE").person("B", "MALE").persons(["P", "Q"]);
  g.parents("P", "Q", "A").parents("P", "Q", "R").couple("R", "B");
  check("Ehemann der Schwester: Schwager", label(g, "A", "B"), "Schwager");
}
{
  const g = new Builder().person("A").person("C").person("B", "MALE").couple("C", "B").parent("A", "C");
  check("Ehepartner des eigenen Kindes: Schwiegersohn", label(g, "A", "B"), "Schwiegersohn");
}
{
  const g = new Builder().person("A", "MALE").person("B", "FEMALE").couple("A", "B", "DIVORCED");
  check("Geschieden: ehemalige Ehefrau", label(g, "A", "B"), "ehemalige Ehefrau");
}
{
  const g = new Builder().person("A", "MALE").person("S", "FEMALE").person("B", "FEMALE").couple("A", "S", "DIVORCED").parent("B", "S");
  check("Mutter der geschiedenen Ehefrau: ehemalige Schwiegermutter", label(g, "A", "B"), "ehemalige Schwiegermutter");
}
{
  const g = new Builder().person("A", "MALE").person("B", "FEMALE").couple("A", "B", "PARTNERED");
  check("Unverheiratet: Partnerin", label(g, "A", "B"), "Partnerin");
}
{
  const g = new Builder().person("A").person("S").person("B", "MALE").couple("A", "S", "PARTNERED").parent("B", "S");
  const l = label(g, "A", "B") ?? "";
  check("Unverheiratet: keine Schwiegereltern, sondern 'über Partner/in'", l.startsWith("Vater (über Partner/in"), true);
}
{
  // angeheirateter Onkel: Ehemann der Tante
  const g = new Builder().persons(["G", "H", "F", "A"]).person("T", "FEMALE").person("B", "MALE");
  g.parents("G", "H", "F").parents("G", "H", "T").parent("F", "A").couple("T", "B");
  check("Ehemann der Tante: angeheirateter Onkel", label(g, "A", "B"), "angeheirateter Onkel");
}
{
  // Cousin und Ehepartner zugleich: beide Beziehungen werden angezeigt
  const g = new Builder().persons(["G", "H", "F1", "F2", "A", "B"]);
  g.parents("G", "H", "F1").parents("G", "H", "F2").parent("F1", "A").parent("F2", "B").couple("A", "B");
  const l = labels(g, "A", "B");
  check("Cousin und Ehepartner: beide Ergebnisse", l, ["Cousin/Cousine 1. Grades", "Ehepartner/in"]);
}

console.log("\nStiefbeziehungen");
{
  const g = new Builder().person("A").person("P").person("S").person("B", "FEMALE");
  g.parent("P", "A").couple("P", "S").parent("S", "B");
  check("Stiefgeschwister", label(g, "A", "B"), "Stiefschwester");
}
{
  const g = new Builder().person("A", "MALE").person("B");
  g.parent("A", "B", "STEP");
  check("Stiefelternteil über STEP-Verknüpfung", label(g, "B", "A"), "Stiefvater");
}
{
  // Paar mit Kind, aber nur ein Elternteil verknüpft: das Paar sagt, dass beide Eltern sind -> kein Stiefelternteil
  const g = new Builder().person("P").person("Q").person("K");
  g.couple("P", "Q", "MARRIED", "cx").parent("P", "K", "BIOLOGICAL", "cx");
  const steps = analyzeRelationship(g.graph(), "K", "Q")!.findings.filter((f) => f.category === "step");
  check("Elternpaar mit unvollständiger Verknüpfung erzeugt keinen Stiefelternteil", steps.length, 0);
}

console.log("\nKeine Beziehung");
{
  const g = new Builder().person("A").person("B");
  const r = analyzeRelationship(g.graph(), "A", "B")!;
  check("Keine Verbindung: keine Ergebnisse", r.findings.length, 0);
  check("... und kein Verbindungsweg", r.connection, null);
}
{
  const g = new Builder().person("A").person("B");
  check("Dieselbe Person", analyzeRelationship(g.graph(), "A", "A")?.same, true);
}

console.log("\nLeistung (großer Stammbaum)");
{
  // 12 Generationen, je Person 2 Kinder -> 8191 Personen
  const g = new Builder();
  let id = 0;
  const level: string[][] = [[`p${id++}`]];
  g.person(level[0][0]);
  for (let gen = 1; gen < 12; gen++) {
    const next: string[] = [];
    for (const par of level[gen - 1]) {
      for (let k = 0; k < 2; k++) {
        const c = `p${id++}`;
        g.person(c);
        g.parent(par, c);
        next.push(c);
      }
    }
    level.push(next);
  }
  const t0 = Date.now();
  const r = analyzeRelationship(g.graph(), level[11][0], level[11][level[11].length - 1])!;
  const ms = Date.now() - t0;
  check(`${g.people.length} Personen: Ergebnis vorhanden`, r.findings.length > 0, true);
  check(`Berechnung unter 1500 ms (${ms} ms)`, ms < 1500, true);
}

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) {
  console.log("\nMindestens ein Test ist fehlgeschlagen.");
  process.exit(1);
}
