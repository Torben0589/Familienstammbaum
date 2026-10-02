import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrNull } from "@/lib/auth";

// Entfernt ein Familienmitglied-Konto. Man kann sich nicht selbst löschen,
// wenn es das letzte verbleibende Konto wäre.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const count = await prisma.user.count();
  if (count <= 1) {
    return NextResponse.json({ error: "Das letzte Benutzerkonto kann nicht gelöscht werden." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
