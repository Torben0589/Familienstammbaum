import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { StatCards } from "@/components/dashboard/StatCards";
import { fullName, lifeSpan } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [personCount, coupleCount, userCount, people] = await Promise.all([
    prisma.person.count(),
    prisma.couple.count(),
    prisma.user.count(),
    prisma.person.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
  ]);

  const stats = [
    { label: "Personen im Baum", value: personCount, icon: "👥", glow: "amber" as const },
    { label: "Paare / Ehen", value: coupleCount, icon: "💍", glow: "lavender" as const },
    { label: "Familienmitglieder mit Zugang", value: userCount, icon: "🔑", glow: "teal" as const },
    { label: "Freie Plätze (max. 5)", value: Math.max(0, 5 - userCount), icon: "➕", glow: "amber" as const }
  ];

  return (
    <div className="pt-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Willkommen zurück <span className="theme-icon-modern"><span className="emoji-icon">👋</span></span><span className="theme-icon-historic">❧</span></h1>
        <p className="text-ink-500 mt-1">Hier ist der aktuelle Stand eures Familienstammbaums.</p>
      </div>

      <StatCards stats={stats} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold text-ink-900 mb-4">Zuletzt hinzugefügt</h2>
          {people.length === 0 ? (
            <p className="text-sm text-ink-500">
              Noch keine Personen angelegt. <Link href="/people/new" className="text-ink-900 underline">Jetzt die erste Person hinzufügen</Link>.
            </p>
          ) : (
            <ul className="space-y-3">
              {people.map((p) => (
                <li key={p.id}>
                  <Link href={`/people/${p.id}`} className="flex items-center justify-between hover:underline">
                    <span className="font-medium text-ink-900">{fullName(p)}</span>
                    <span className="text-sm text-ink-500">{lifeSpan(p)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-ink-900 mb-4">Schnellzugriff</h2>
          <div className="flex flex-col gap-3">
            <Link href="/tree" className="glow-button-secondary justify-start">
              <span className="emoji-icon">🌳</span> Stammbaum ansehen
            </Link>
            <Link href="/people/new" className="glow-button-secondary justify-start">
              <span className="emoji-icon">➕</span> Neue Person anlegen
            </Link>
            <Link href="/settings" className="glow-button-secondary justify-start">
              <span className="emoji-icon">⚙️</span> GEDCOM importieren / exportieren
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
