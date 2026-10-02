import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrNull } from "@/lib/auth";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const [personCount, coupleCount, userCount, oldestPerson, youngestPerson] = await Promise.all([
    prisma.person.count(),
    prisma.couple.count(),
    prisma.user.count(),
    prisma.person.findMany({ where: { birthDate: { not: null } }, orderBy: { birthDate: "asc" }, take: 1 }),
    prisma.person.findMany({ where: { birthDate: { not: null } }, orderBy: { birthDate: "desc" }, take: 1 })
  ]);

  return NextResponse.json({
    personCount,
    coupleCount,
    userCount,
    oldestPerson: oldestPerson[0] ?? null,
    youngestPerson: youngestPerson[0] ?? null
  });
}
