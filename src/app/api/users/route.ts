import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionOrNull, MAX_USERS } from "@/lib/auth";

// Liste aller Familienmitglieder-Konten (ohne Passwort-Hash).
export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, createdAt: true },
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json(users);
}

// Legt ein weiteres Familienmitglied-Konto an (max. MAX_USERS, alle mit gleichen Rechten).
export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const count = await prisma.user.count();
  if (count >= MAX_USERS) {
    return NextResponse.json(
      { error: `Maximal ${MAX_USERS} Benutzerkonten sind erlaubt.` },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { name, username, password } = body as { name?: string; username?: string; password?: string };
  if (!name || !username || !password) {
    return NextResponse.json({ error: "Name, Benutzername und Passwort sind erforderlich." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Dieser Benutzername ist bereits vergeben." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, username: username.trim().toLowerCase(), passwordHash }
  });

  return NextResponse.json({ id: user.id, username: user.username, name: user.name });
}
