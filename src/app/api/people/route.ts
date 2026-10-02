import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionOrNull } from "@/lib/auth";

const personSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  birthName: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
  birthDate: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  deathDate: z.string().optional().nullable(),
  deathPlace: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function GET(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const people = await prisma.person.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { birthName: { contains: q } },
            { birthPlace: { contains: q } }
          ]
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
  });
  return NextResponse.json(people);
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = await req.json();
  const parsed = personSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Daten" }, { status: 400 });
  }

  const person = await prisma.person.create({ data: parsed.data });
  return NextResponse.json(person);
}
