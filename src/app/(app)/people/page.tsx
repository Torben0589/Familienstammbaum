import Link from "next/link";
import { PersonList } from "@/components/people/PersonList";

export default function PeoplePage() {
  return (
    <div className="pt-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Personen</h1>
          <p className="text-ink-500 mt-1">Alle Mitglieder eures Familienstammbaums.</p>
        </div>
        <Link href="/people/new" className="glow-button">
          ➕ Neue Person
        </Link>
      </div>
      <PersonList />
    </div>
  );
}
