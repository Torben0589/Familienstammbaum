"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { PersonDTO } from "@/types";

interface Props {
  initial?: Partial<PersonDTO>;
  mode: "create" | "edit";
  personId?: string;
}

export function PersonForm({ initial, mode, personId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    birthName: initial?.birthName ?? "",
    gender: initial?.gender ?? "UNKNOWN",
    birthDate: initial?.birthDate ?? "",
    birthPlace: initial?.birthPlace ?? "",
    deathDate: initial?.deathDate ?? "",
    deathPlace: initial?.deathPlace ?? "",
    occupation: initial?.occupation ?? "",
    notes: initial?.notes ?? ""
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = mode === "create" ? "/api/people" : `/api/people/${personId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Speichern fehlgeschlagen.");
      return;
    }

    router.push(`/people/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Vorname *">
          <Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required />
        </Field>
        <Field label="Nachname *">
          <Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Geburtsname (falls abweichend)">
          <Input value={form.birthName ?? ""} onChange={(e) => update("birthName", e.target.value)} />
        </Field>
        <Field label="Geschlecht">
          <Select value={form.gender} onChange={(e) => update("gender", e.target.value as any)}>
            <option value="UNKNOWN">Unbekannt</option>
            <option value="MALE">Männlich</option>
            <option value="FEMALE">Weiblich</option>
            <option value="OTHER">Divers</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Geburtsdatum (z. B. 1952 oder 12.03.1952)">
          <Input value={form.birthDate ?? ""} onChange={(e) => update("birthDate", e.target.value)} />
        </Field>
        <Field label="Geburtsort">
          <Input value={form.birthPlace ?? ""} onChange={(e) => update("birthPlace", e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Sterbedatum (falls zutreffend)">
          <Input value={form.deathDate ?? ""} onChange={(e) => update("deathDate", e.target.value)} />
        </Field>
        <Field label="Sterbeort">
          <Input value={form.deathPlace ?? ""} onChange={(e) => update("deathPlace", e.target.value)} />
        </Field>
      </div>

      <Field label="Beruf">
        <Input value={form.occupation ?? ""} onChange={(e) => update("occupation", e.target.value)} />
      </Field>

      <Field label="Notizen">
        <Textarea value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} />
      </Field>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Speichert…" : mode === "create" ? "Person anlegen" : "Änderungen speichern"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
