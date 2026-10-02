import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth";
import { exportGedcom } from "@/lib/gedcom";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const gedcom = await exportGedcom();
  return new NextResponse(gedcom, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="familienstammbaum-${new Date().toISOString().slice(0, 10)}.ged"`
    }
  });
}
