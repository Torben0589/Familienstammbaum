import { prisma } from "@/lib/db";
import type { Gender, PartnershipType } from "@/types";

// ---------------------------------------------------------------------------
// GEDCOM 5.5.1 Export
// ---------------------------------------------------------------------------
export async function exportGedcom(): Promise<string> {
  const people = await prisma.person.findMany();
  const couples = await prisma.couple.findMany();
  const links = await prisma.parentChild.findMany();

  const lines: string[] = [];
  lines.push("0 HEAD");
  lines.push("1 SOUR FamilienstammbaumApp");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");

  const indiTag = (id: string) => `@I${id}@`;
  const famTag = (id: string) => `@F${id}@`;

  for (const p of people) {
    lines.push(`0 ${indiTag(p.id)} INDI`);
    lines.push(`1 NAME ${p.firstName} /${p.lastName}/`);
    if (p.birthName) lines.push(`2 _MARNM ${p.birthName}`);
    const sex = p.gender === "MALE" ? "M" : p.gender === "FEMALE" ? "F" : "U";
    lines.push(`1 SEX ${sex}`);
    if (p.birthDate || p.birthPlace) {
      lines.push("1 BIRT");
      if (p.birthDate) lines.push(`2 DATE ${p.birthDate}`);
      if (p.birthPlace) lines.push(`2 PLAC ${p.birthPlace}`);
    }
    if (p.deathDate || p.deathPlace) {
      lines.push("1 DEAT");
      if (p.deathDate) lines.push(`2 DATE ${p.deathDate}`);
      if (p.deathPlace) lines.push(`2 PLAC ${p.deathPlace}`);
    }
    if (p.occupation) lines.push(`1 OCCU ${p.occupation}`);
    if (p.notes) lines.push(`1 NOTE ${p.notes.replace(/\n/g, " ")}`);

    const asSpouseCouples = couples.filter((c) => c.parent1Id === p.id || c.parent2Id === p.id);
    for (const c of asSpouseCouples) lines.push(`1 FAMS ${famTag(c.id)}`);

    const asChildLinks = links.filter((l) => l.childId === p.id && l.coupleId);
    const famcSeen = new Set<string>();
    for (const l of asChildLinks) {
      if (l.coupleId && !famcSeen.has(l.coupleId)) {
        famcSeen.add(l.coupleId);
        lines.push(`1 FAMC ${famTag(l.coupleId)}`);
      }
    }
  }

  for (const c of couples) {
    lines.push(`0 ${famTag(c.id)} FAM`);
    lines.push(`1 HUSB ${indiTag(c.parent1Id)}`);
    lines.push(`1 WIFE ${indiTag(c.parent2Id)}`);
    if (c.type === "MARRIED") {
      lines.push("1 MARR");
      if (c.startDate) lines.push(`2 DATE ${c.startDate}`);
      if (c.startPlace) lines.push(`2 PLAC ${c.startPlace}`);
    }
    if (c.type === "DIVORCED") {
      lines.push("1 DIV");
      if (c.endDate) lines.push(`2 DATE ${c.endDate}`);
    }
    const children = links.filter((l) => l.coupleId === c.id);
    for (const ch of children) lines.push(`1 CHIL ${indiTag(ch.childId)}`);
  }

  lines.push("0 TRLR");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// GEDCOM Import (unterstützt INDI: NAME/SEX/BIRT/DEAT/OCCU/NOTE, FAM: HUSB/WIFE/CHIL/MARR)
// ---------------------------------------------------------------------------
interface RawIndi {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  occupation?: string;
  notes?: string;
}

interface RawFam {
  id: string;
  husbandId?: string;
  wifeId?: string;
  childIds: string[];
  type: PartnershipType;
  startDate?: string;
  startPlace?: string;
  endDate?: string;
}

export function parseGedcom(content: string): { indis: RawIndi[]; fams: RawFam[] } {
  const rawLines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const indis: RawIndi[] = [];
  const fams: RawFam[] = [];

  let current: { kind: "INDI" | "FAM"; data: any } | null = null;
  let lastTag: { level: number; tag: string } | null = null;

  function flush() {
    if (!current) return;
    if (current.kind === "INDI") indis.push(current.data);
    else fams.push(current.data);
    current = null;
  }

  for (const raw of rawLines) {
    const match = raw.match(/^(\d+)\s+(@\w+@\s+)?(\w+)(\s+(.*))?$/);
    if (!match) continue;
    const level = parseInt(match[1], 10);
    const xref = match[2]?.trim().replace(/@/g, "");
    const tag = match[3];
    const value = match[5] ?? "";

    if (level === 0 && tag === "INDI" && xref) {
      flush();
      current = { kind: "INDI", data: { id: xref, firstName: "", lastName: "", gender: "UNKNOWN" } };
      lastTag = null;
      continue;
    }
    if (level === 0 && tag === "FAM" && xref) {
      flush();
      current = { kind: "FAM", data: { id: xref, childIds: [], type: "MARRIED" } };
      lastTag = null;
      continue;
    }
    if (level === 0) {
      // andere 0-Level Records (HEAD, TRLR, SUBM, etc.) ignorieren
      if (current) flush();
      lastTag = null;
      continue;
    }
    if (!current) continue;

    if (current.kind === "INDI") {
      const d = current.data as RawIndi;
      if (level === 1 && tag === "NAME") {
        const nameMatch = value.match(/^(.*?)\s*\/(.*)\/\s*$/);
        if (nameMatch) {
          d.firstName = nameMatch[1].trim();
          d.lastName = nameMatch[2].trim();
        } else {
          d.firstName = value.trim();
        }
      } else if (level === 1 && tag === "SEX") {
        d.gender = value.trim() === "M" ? "MALE" : value.trim() === "F" ? "FEMALE" : "UNKNOWN";
      } else if (level === 1 && tag === "OCCU") {
        d.occupation = value.trim();
      } else if (level === 1 && tag === "NOTE") {
        d.notes = value.trim();
      } else if (level === 1 && (tag === "BIRT" || tag === "DEAT")) {
        lastTag = { level, tag };
      } else if (level === 2 && tag === "DATE" && lastTag?.tag === "BIRT") {
        d.birthDate = value.trim();
      } else if (level === 2 && tag === "PLAC" && lastTag?.tag === "BIRT") {
        d.birthPlace = value.trim();
      } else if (level === 2 && tag === "DATE" && lastTag?.tag === "DEAT") {
        d.deathDate = value.trim();
      } else if (level === 2 && tag === "PLAC" && lastTag?.tag === "DEAT") {
        d.deathPlace = value.trim();
      }
    } else {
      const d = current.data as RawFam;
      if (level === 1 && tag === "HUSB") d.husbandId = value.replace(/@/g, "").trim();
      else if (level === 1 && tag === "WIFE") d.wifeId = value.replace(/@/g, "").trim();
      else if (level === 1 && tag === "CHIL") d.childIds.push(value.replace(/@/g, "").trim());
      else if (level === 1 && tag === "MARR") {
        d.type = "MARRIED";
        lastTag = { level, tag: "MARR" };
      } else if (level === 1 && tag === "DIV") {
        d.type = "DIVORCED";
        lastTag = { level, tag: "DIV" };
      } else if (level === 2 && tag === "DATE" && lastTag?.tag === "MARR") {
        d.startDate = value.trim();
      } else if (level === 2 && tag === "PLAC" && lastTag?.tag === "MARR") {
        d.startPlace = value.trim();
      } else if (level === 2 && tag === "DATE" && lastTag?.tag === "DIV") {
        d.endDate = value.trim();
      }
    }
  }
  flush();

  return { indis, fams };
}

export async function importGedcom(content: string): Promise<{ people: number; couples: number; links: number }> {
  const { indis, fams } = parseGedcom(content);

  // Mapping von GEDCOM-XRef (z. B. "I12") auf die neu erzeugte Datenbank-ID
  const idMap = new Map<string, string>();
  let couplesCreated = 0;
  let linksCreated = 0;

  await prisma.$transaction(async (tx) => {
    for (const indi of indis) {
      const created = await tx.person.create({
        data: {
          firstName: indi.firstName || "Unbekannt",
          lastName: indi.lastName || "Unbekannt",
          gender: indi.gender,
          birthDate: indi.birthDate,
          birthPlace: indi.birthPlace,
          deathDate: indi.deathDate,
          deathPlace: indi.deathPlace,
          occupation: indi.occupation,
          notes: indi.notes
        }
      });
      idMap.set(indi.id, created.id);
    }

    for (const fam of fams) {
      const p1 = fam.husbandId ? idMap.get(fam.husbandId) : undefined;
      const p2 = fam.wifeId ? idMap.get(fam.wifeId) : undefined;

      let coupleId: string | undefined;
      if (p1 && p2) {
        const couple = await tx.couple.create({
          data: {
            parent1Id: p1,
            parent2Id: p2,
            type: fam.type,
            startDate: fam.startDate,
            startPlace: fam.startPlace,
            endDate: fam.endDate
          }
        });
        coupleId = couple.id;
        couplesCreated += 1;
      }

      for (const childXref of fam.childIds) {
        const childId = idMap.get(childXref);
        if (!childId) continue;
        if (p1) {
          await tx.parentChild.create({ data: { childId, parentId: p1, coupleId } });
          linksCreated += 1;
        }
        if (p2) {
          await tx.parentChild.create({ data: { childId, parentId: p2, coupleId } });
          linksCreated += 1;
        }
      }
    }
  });

  return { people: idMap.size, couples: couplesCreated, links: linksCreated };
}
