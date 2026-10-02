"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { GenderBadge } from "@/components/ui/Badge";
import { fullName, lifeSpan, initials } from "@/lib/utils";
import type { PersonDTO } from "@/types";

export function PersonList() {
  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/people?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      if (res.ok) setPeople(await res.json());
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="space-y-5">
      <Input
        placeholder="Nach Name oder Ort suchen…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="text-sm text-ink-500">Lädt…</p>
      ) : people.length === 0 ? (
        <p className="text-sm text-ink-500">Keine Personen gefunden.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.map((p) => (
            <Link key={p.id} href={`/people/${p.id}`}>
              <Card className="!p-5 hover:shadow-glow-lg transition-shadow cursor-pointer h-full">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-glow to-lavender-glow text-white flex items-center justify-center font-semibold shrink-0">
                    {initials(p)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-ink-900 truncate">{fullName(p)}</div>
                    <div className="text-xs text-ink-500">{lifeSpan(p)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <GenderBadge gender={p.gender} />
                  {p.birthPlace && <span className="text-xs text-ink-500 truncate">📍 {p.birthPlace}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
