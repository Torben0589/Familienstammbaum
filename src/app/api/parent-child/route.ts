import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionOrNull } from "@/lib/auth";

const linkSchema = z.object({
  childId: z.string().min(1),
  parentId: z.string().min(1),
  coupleId: z.string().optional().nullable(),
  relation: z.enum(["BIOLOGICAL", "ADOPTED", "STEP"]).default("BIOLOGICAL")
});

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const links = await prisma.parentChild.findMany();
  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = await req.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Daten" }, { status: 400 });
  }
  if (parsed.data.childId === parsed.data.parentId) {
    return NextResponse.json({ error: "Eine Person kann nicht ihr eigenes Kind sein." }, { status: 400 });
  }

  const link = await prisma.parentChild.create({ data: parsed.data });
  return NextResponse.json(link);
}
