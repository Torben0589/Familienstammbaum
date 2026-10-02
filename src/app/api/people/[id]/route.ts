import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionOrNull } from "@/lib/auth";

const personSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthName: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
  birthDate: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  deathDate: z.string().optional().nullable(),
  deathPlace: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const person = await prisma.person.findUnique({
    where: { id: params.id },
    include: {
      asParent1: { include: { parent2: true } },
      asParent2: { include: { parent1: true } },
      parentLinks: { include: { parent: true, couple: true } },
      childLinks: { include: { child: true } }
    }
  });
  if (!person) return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  return NextResponse.json(person);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = await req.json();
  const parsed = personSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Daten" }, { status: 400 });
  }

  const person = await prisma.person.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(person);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await prisma.person.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
