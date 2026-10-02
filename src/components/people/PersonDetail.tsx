"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Input } from "@/components/ui/Input";
import { GenderBadge } from "@/components/ui/Badge";
import { PersonPicker } from "@/components/people/PersonPicker";
import { fullName, lifeSpan, initials, formatFuzzyDate } from "@/lib/utils";
import type { PersonDTO } from "@/types";

type PartnerType = "MARRIED" | "PARTNERED" | "DIVORCED" | "SEPARATED";
type RelationType = "BIOLOGICAL" | "ADOPTED" | "STEP";

interface FullPerson extends PersonDTO {
  asParent1: { id: string; type: PartnerType; startDate?: string | null; parent2: PersonDTO }[];
  asParent2: { id: string; type: PartnerType; startDate?: string | null; parent1: PersonDTO }[];
  parentLinks: { id: string; relation: RelationType; parent: PersonDTO; coupleId?: string | null }[];
  childLinks: { id: string; relation: RelationType; child: PersonDTO }[];
}

const partnerTypeLabel: Record<PartnerType, string> = {
  MARRIED: "Verheiratet",
  PARTNERED: "Partnerschaft",
  DIVORCED: "Geschieden",
  SEPARATED: "Getrennt"
};

const relationLabel: Record<RelationType, string> = {
  BIOLOGICAL: "leiblich",
  ADOPTED: "adoptiert",
  STEP: "Stiefkind"
};

export function PersonDetail({ personId }: { personId: string }) {
  const router = useRouter();
  const [person, setPerson] = useState<FullPerson | null>(null);
  const [modal, setModal] = useState<"partner" | "parent" | "child" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/people/${personId}`);
    if (res.ok) setPerson(await res.json());
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!person) return <p className="text-sm text-ink-500 pt-6">Lädt…</p>;

  const partners = [
    ...person.asParent1.map((c) => ({ coupleId: c.id, type: c.type, person: c.parent2 })),
    ...person.asParent2.map((c) => ({ coupleId: c.id, type: c.type, person: c.parent1 }))
  ];
  const couplesOfThisPerson = partners.map((p) => ({
    coupleId: p.coupleId,
    partnerId: p.person.id,
    partnerName: fullName(p.person)
  }));

  async function deletePerson() {
    if (!confirm(`${fullName(person!)} wirklich endgültig löschen?`)) return;
    await fetch(`/api/people/${personId}`, { method: "DELETE" });
    router.push("/people");
  }

  async function removeCouple(coupleId: string) {
    if (!confirm("Diese Partnerschaft wirklich entfernen?")) return;
    await fetch(`/api/couples/${coupleId}`, { method: "DELETE" });
    load();
  }

  async function removeParentLink(linkId: string) {
    await fetch(`/api/parent-child/${linkId}`, { method: "DELETE" });
    load();
  }

  async function removeChildLink(linkId: string) {
    await fetch(`/api/parent-child/${linkId}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="pt-6 space-y-6 max-w-4xl">
      <Card>
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-glow to-lavender-glow text-white flex items-center justify-center text-xl font-semibold shrink-0">
            {initials(person)}
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-semibold text-ink-900">{fullName(person)}</h1>
            {person.birthName && <p className="text-sm text-ink-500">geb. {person.birthName}</p>}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <GenderBadge gender={person.gender} />
              <span className="text-sm text-ink-700">{lifeSpan(person)}</span>
            </div>
            {(person.birthPlace || person.deathPlace) && (
              <p className="text-sm text-ink-500 mt-1">
                {person.birthPlace && <>📍 geboren in {person.birthPlace} </>}
                {person.deathPlace && <>· gestorben in {person.deathPlace}</>}
              </p>
            )}
            {person.occupation && <p className="text-sm text-ink-700 mt-1">💼 {person.occupation}</p>}
            {person.notes && <p className="text-sm text-ink-700 mt-3 whitespace-pre-wrap">{person.notes}</p>}
          </div>
          <div className="flex gap-2">
            <Link href={`/people/${personId}/edit`} className="glow-button-secondary !py-2 !px-4 text-sm">
              ✏️ Bearbeiten
            </Link>
            <Button variant="danger" className="!py-2 !px-4 text-sm" onClick={deletePerson}>
              🗑️ Löschen
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink-900">💍 Partnerschaften</h2>
            <button className="text-sm text-ink-700 underline" onClick={() => setModal("partner")}>
              + Hinzufügen
            </button>
          </div>
          {partners.length === 0 ? (
            <p className="text-sm text-ink-500">Keine Einträge.</p>
          ) : (
            <ul className="space-y-2">
              {partners.map((p) => (
                <li key={p.coupleId} className="flex items-center justify-between">
                  <Link href={`/people/${p.person.id}`} className="text-sm font-medium text-ink-900 hover:underline">
                    {fullName(p.person)}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-500">{partnerTypeLabel[p.type]}</span>
                    <button className="text-ink-500 hover:text-rose-600" onClick={() => removeCouple(p.coupleId)}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink-900">⬆️ Eltern</h2>
            <button className="text-sm text-ink-700 underline" onClick={() => setModal("parent")}>
              + Hinzufügen
            </button>
          </div>
          {person.parentLinks.length === 0 ? (
            <p className="text-sm text-ink-500">Keine Einträge.</p>
          ) : (
            <ul className="space-y-2">
              {person.parentLinks.map((l) => (
                <li key={l.id} className="flex items-center justify-between">
                  <Link href={`/people/${l.parent.id}`} className="text-sm font-medium text-ink-900 hover:underline">
                    {fullName(l.parent)}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-500">{relationLabel[l.relation]}</span>
                    <button className="text-ink-500 hover:text-rose-600" onClick={() => removeParentLink(l.id)}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink-900">⬇️ Kinder</h2>
            <button className="text-sm text-ink-700 underline" onClick={() => setModal("child")}>
              + Hinzufügen
            </button>
          </div>
          {person.childLinks.length === 0 ? (
            <p className="text-sm text-ink-500">Keine Einträge.</p>
          ) : (
            <ul className="space-y-2">
              {person.childLinks.map((l) => (
                <li key={l.id} className="flex items-center justify-between">
                  <Link href={`/people/${l.child.id}`} className="text-sm font-medium text-ink-900 hover:underline">
                    {fullName(l.child)}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-500">{relationLabel[l.relation]}</span>
                    <button className="text-ink-500 hover:text-rose-600" onClick={() => removeChildLink(l.id)}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {modal === "partner" && (
        <AddPartnerModal
          personId={personId}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {modal === "parent" && (
        <AddParentModal
          personId={personId}
          existingParentIds={person.parentLinks.map((l) => l.parent.id)}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {modal === "child" && (
        <AddChildModal
          personId={personId}
          existingChildIds={person.childLinks.map((l) => l.child.id)}
          couples={couplesOfThisPerson}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddPartnerModal({
  personId,
  onClose,
  onDone
}: {
  personId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<PersonDTO | null>(null);
  const [type, setType] = useState<PartnerType>("MARRIED");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!selected) {
      setError("Bitte eine Person auswählen.");
      return;
    }
    const res = await fetch("/api/couples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent1Id: personId, parent2Id: selected.id, type, startDate: startDate || null })
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Speichern.");
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Partnerschaft hinzufügen">
      <div className="space-y-4">
        <Field label="Partner/in">
          <PersonPicker excludeIds={[personId]} onSelect={setSelected} />
        </Field>
        <Field label="Art der Beziehung">
          <Select value={type} onChange={(e) => setType(e.target.value as PartnerType)}>
            <option value="MARRIED">Verheiratet</option>
            <option value="PARTNERED">Partnerschaft</option>
            <option value="DIVORCED">Geschieden</option>
            <option value="SEPARATED">Getrennt</option>
          </Select>
        </Field>
        <Field label="Datum (optional)">
          <Input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="z. B. 1978 oder 14.06.1978" />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="button" onClick={submit} className="w-full">
          Speichern
        </Button>
      </div>
    </Modal>
  );
}

function AddParentModal({
  personId,
  existingParentIds,
  onClose,
  onDone
}: {
  personId: string;
  existingParentIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<PersonDTO | null>(null);
  const [relation, setRelation] = useState<RelationType>("BIOLOGICAL");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!selected) {
      setError("Bitte eine Person auswählen.");
      return;
    }
    const res = await fetch("/api/parent-child", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: personId, parentId: selected.id, relation })
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Speichern.");
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Elternteil hinzufügen">
      <div className="space-y-4">
        <Field label="Elternteil">
          <PersonPicker excludeIds={[personId, ...existingParentIds]} onSelect={setSelected} />
        </Field>
        <Field label="Art der Beziehung">
          <Select value={relation} onChange={(e) => setRelation(e.target.value as RelationType)}>
            <option value="BIOLOGICAL">Leiblich</option>
            <option value="ADOPTED">Adoptiert</option>
            <option value="STEP">Stiefelternteil</option>
          </Select>
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="button" onClick={submit} className="w-full">
          Speichern
        </Button>
      </div>
    </Modal>
  );
}

function AddChildModal({
  personId,
  existingChildIds,
  couples,
  onClose,
  onDone
}: {
  personId: string;
  existingChildIds: string[];
  couples: { coupleId: string; partnerId: string; partnerName: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<PersonDTO | null>(null);
  const [relation, setRelation] = useState<RelationType>("BIOLOGICAL");
  const [coupleId, setCoupleId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!selected) {
      setError("Bitte eine Person auswählen.");
      return;
    }
    const chosenCouple = couples.find((c) => c.coupleId === coupleId);

    const res = await fetch("/api/parent-child", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: selected.id,
        parentId: personId,
        relation,
        coupleId: coupleId || null
      })
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Speichern.");
      return;
    }

    // Falls "gemeinsam mit" gewählt wurde, auch den anderen Elternteil verknüpfen.
    if (chosenCouple) {
      await fetch("/api/parent-child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: selected.id,
          parentId: chosenCouple.partnerId,
          relation,
          coupleId: coupleId
        })
      });
    }

    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Kind hinzufügen">
      <div className="space-y-4">
        <Field label="Kind">
          <PersonPicker excludeIds={[personId, ...existingChildIds]} onSelect={setSelected} />
        </Field>
        <Field label="Art der Beziehung">
          <Select value={relation} onChange={(e) => setRelation(e.target.value as RelationType)}>
            <option value="BIOLOGICAL">Leiblich</option>
            <option value="ADOPTED">Adoptiert</option>
            <option value="STEP">Stiefkind</option>
          </Select>
        </Field>
        {couples.length > 0 && (
          <Field label="Gemeinsam mit (optional, verknüpft auch den anderen Elternteil)">
            <Select value={coupleId} onChange={(e) => setCoupleId(e.target.value)}>
              <option value="">— nur dieser Elternteil —</option>
              {couples.map((c) => (
                <option key={c.coupleId} value={c.coupleId}>
                  {c.partnerName}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="button" onClick={submit} className="w-full">
          Speichern
        </Button>
      </div>
    </Modal>
  );
}
