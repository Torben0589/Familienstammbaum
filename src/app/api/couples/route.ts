import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionOrNull } from "@/lib/auth";

const coupleSchema = z.object({
  parent1Id: z.string().min(1),
  parent2Id: z.string().min(1),
  type: z.enum(["MARRIED", "PARTNERED", "DIVORCED", "SEPARATED"]).default("MARRIED"),
  startDate: z.string().optional().nullable(),
  startPlace: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const couples = await prisma.couple.findMany({ include: { parent1: true, parent2: true } });
  return NextResponse.json(couples);
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = await req.json();
  const parsed = coupleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Daten" }, { status: 400 });
  }
  if (parsed.data.parent1Id === parsed.data.parent2Id) {
    return NextResponse.json({ error: "Eine Person kann nicht mit sich selbst verbunden werden." }, { status: 400 });
  }

  const couple = await prisma.couple.create({ data: parsed.data });
  return NextResponse.json(couple);
}
