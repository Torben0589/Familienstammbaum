import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrNull } from "@/lib/auth";
import type { FamilyGraph } from "@/types";

// Liefert den kompletten Beziehungsgraphen (Personen, Paare, Eltern-Kind-Links)
// für die Baumansicht im Frontend.
export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const [people, couples, links] = await Promise.all([
    prisma.person.findMany(),
    prisma.couple.findMany(),
    prisma.parentChild.findMany()
  ]);

  const graph: FamilyGraph = {
    people: people.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      birthName: p.birthName,
      gender: p.gender,
      birthDate: p.birthDate,
      birthPlace: p.birthPlace,
      deathDate: p.deathDate,
      deathPlace: p.deathPlace,
      occupation: p.occupation,
      notes: p.notes,
      photoUrl: p.photoUrl
    })),
    couples: couples.map((c) => ({
      id: c.id,
      type: c.type,
      startDate: c.startDate,
      startPlace: c.startPlace,
      endDate: c.endDate,
      notes: c.notes,
      parent1Id: c.parent1Id,
      parent2Id: c.parent2Id
    })),
    links: links.map((l) => ({
      id: l.id,
      childId: l.childId,
      parentId: l.parentId,
      coupleId: l.coupleId,
      relation: l.relation
    }))
  };

  return NextResponse.json(graph);
}
