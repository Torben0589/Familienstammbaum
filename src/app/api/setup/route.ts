import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isFirstRun } from "@/lib/auth";

// Erstellt den allerersten Benutzer. Danach ist dieser Endpoint gesperrt,
// weitere Mitglieder werden über /api/users (eingeloggt) angelegt.
export async function POST(req: NextRequest) {
  if (!(await isFirstRun())) {
    return NextResponse.json({ error: "Einrichtung bereits abgeschlossen." }, { status: 403 });
  }

  const body = await req.json();
  const { name, username, password } = body as { name?: string; username?: string; password?: string };

  if (!name || !username || !password) {
    return NextResponse.json({ error: "Name, Benutzername und Passwort sind erforderlich." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, username: username.trim().toLowerCase(), passwordHash }
  });

  return NextResponse.json({ id: user.id, username: user.username });
}
