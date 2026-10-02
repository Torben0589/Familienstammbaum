import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth";
import { importGedcom } from "@/lib/gedcom";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Keine GEDCOM-Datei (.ged) übermittelt." }, { status: 400 });
  }

  const content = await file.text();
  try {
    const result = await importGedcom(content);
    return NextResponse.json(result);
  } catch (err) {
    console.error("GEDCOM-Import fehlgeschlagen", err);
    return NextResponse.json({ error: "Die Datei konnte nicht verarbeitet werden. Ist es eine gültige GEDCOM-Datei?" }, { status: 400 });
  }
}
