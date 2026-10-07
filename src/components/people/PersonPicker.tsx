"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { fullName, lifeSpan } from "@/lib/utils";
import type { PersonDTO } from "@/types";

export function PersonPicker({
  excludeIds = [],
  onSelect,
  placeholder = "Person suchen…"
}: {
  excludeIds?: string[];
  onSelect: (person: PersonDTO) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonDTO[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/people?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data: PersonDTO[] = await res.json();
        setResults(data.filter((p) => !excludeIds.includes(p.id)));
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, excludeIds]);

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && results.length > 0 && (
        <div className="absolute z-[9999] mt-1 w-full bg-white rounded-2xl shadow-glow-lg border border-ink-900/5 max-h-60 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-ink-900/5 flex items-center justify-between"
              onClick={() => {
                onSelect(p);
                setQuery(fullName(p));
                setOpen(false);
              }}
            >
              <span className="font-medium text-ink-900">{fullName(p)}</span>
              <span className="text-xs text-ink-500">{lifeSpan(p)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
