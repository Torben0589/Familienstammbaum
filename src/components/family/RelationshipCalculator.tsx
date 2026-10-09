"use client";

// Datei: src/components/family/RelationshipCalculator.tsx
// Verwandtschaftsrechner: zwei Personen wählen, Beziehung samt Gegenrichtung, gemeinsamen Vorfahren
// und Beziehungspfad anzeigen. Über den Info-Button öffnet sich ein Erklärfenster (Schließen mit X).

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PersonPicker } from "@/components/people/PersonPicker";
import { analyzeRelationship, CATEGORY_TITLES, type ChainStep, type RelationFinding } from "@/lib/relationship";
import type { FamilyGraph, PersonDTO } from "@/types";

const fullName = (p: PersonDTO) => `${p.firstName} ${p.lastName}`.trim();

function chainText(chain: ChainStep[]): string {
  return chain.map((s) => (s.role ? `${fullName(s.person)} (${s.role})` : fullName(s.person))).join(" → ");
}

function FindingDetails({ f, from, to }: { f: RelationFinding; from: PersonDTO; to: PersonDTO }) {
  const hasChains = (f.chainA?.length ?? 0) > 1 || (f.chainB?.length ?? 0) > 1;
  return (
    <div className="space-y-2">
      <div className="text-sm text-ink-700">{f.explanation}</div>

      {f.uncertain && f.uncertainNote && (
        <div className="text-sm text-ink-700 rounded-xl border border-ink-900/10 px-3 py-2">
          <strong>Nicht eindeutig:</strong> {f.uncertainNote}
        </div>
      )}

      {f.commonAncestors.length > 0 && f.distA !== undefined && f.distB !== undefined && f.distA > 0 && f.distB > 0 && (
        <div className="text-sm text-ink-500">
          Abstand zum gemeinsamen Vorfahren in Generationen: {from.firstName} {f.distA}, {to.firstName} {f.distB}.
        </div>
      )}

      {hasChains && (
        <details className="text-sm text-ink-500">
          <summary className="cursor-pointer select-none py-1">Beziehungspfad anzeigen</summary>
          <div className="mt-1 space-y-1">
            {f.chainA && f.chainA.length > 1 && <div>{chainText(f.chainA)}</div>}
            {f.chainB && f.chainB.length > 1 && <div>{chainText(f.chainB)}</div>}
          </div>
        </details>
      )}
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="font-semibold text-ink-900">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function InfoDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Per Portal an <body> hängen: Die Karte, in der der Rechner liegt, hat einen Weichzeichner-Filter,
  // der "fixed"-Elemente sonst an die Karte binden würde.
  return createPortal(
    <div
      className="fixed inset-0 z-[300000] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relationship-info-title"
    >
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />

      <div className="glass-card !bg-white/95 relative w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3 border-b border-ink-900/10">
          <h2 id="relationship-info-title" className="text-xl font-semibold text-ink-900">
            Verwandtschaft verständlich erklärt
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fenster schließen"
            className="glow-button-secondary !p-0 w-11 h-11 shrink-0 touch-manipulation"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-4 text-sm text-ink-700">
          <InfoSection title="So liest du das Ergebnis">
            <p>
              Die große Zeile sagt, was die <strong>zweite</strong> Person für die <strong>erste</strong> Person ist. Darunter steht die Gegenrichtung.
              Eine Beziehung gilt immer aus Sicht einer Bezugsperson.
            </p>
          </InfoSection>

          <InfoSection title="Direkte Linie">
            <p>
              Eine Person stammt von der anderen ab. Aufwärts: Eltern, Großeltern, Urgroßeltern, Ururgroßeltern und so weiter. Abwärts: Kinder, Enkel,
              Urenkel, Ururenkel. Ab der 7. Generation steht statt einer langen „Ur“-Kette die Zahl, zum Beispiel „Vorfahr in der 7. Generation“.
            </p>
          </InfoSection>

          <InfoSection title="Seitenlinie">
            <p>
              Keine Abstammung voneinander, aber gemeinsame Vorfahren. Geschwister haben dieselben Eltern. Onkel und Tante sind Geschwister eines Elternteils,
              Großonkel und Großtante Geschwister eines Großelternteils. Neffe und Nichte sind Kinder eines Geschwisters.
            </p>
          </InfoSection>

          <InfoSection title="Cousins und Cousinen">
            <p>
              Der Grad zeigt, wie weit die gemeinsamen Vorfahren zurückliegen: 1. Grades teilen Großeltern, 2. Grades Urgroßeltern, 3. Grades Ururgroßeltern.
            </p>
            <p>
              „Einmal entfernt“ heißt: Die beiden Personen sind unterschiedlich viele Generationen vom gemeinsamen Vorfahren entfernt. Beispiel: du und das
              Kind deines Cousins 1. Grades sind Cousin und Cousine 1. Grades, einmal entfernt.
            </p>
            <p>Rechenregel: Grad = der kleinere Abstand zum gemeinsamen Vorfahren minus 1. „Entfernt“ = der Unterschied der beiden Abstände.</p>
          </InfoSection>

          <InfoSection title="Halbverwandtschaft">
            <p>
              Halbgeschwister haben genau einen gemeinsamen Elternteil. Entsprechend gibt es Halbcousins. Ist bei einer Person nur ein Elternteil erfasst, kann
              der Rechner nicht sicher sagen, ob es volle oder halbe Verwandtschaft ist. Dann steht dort „Geschwister oder Halbgeschwister“ mit einem Hinweis.
            </p>
          </InfoSection>

          <InfoSection title="Angeheiratet">
            <p>
              Die Verbindung läuft über eine Ehe oder Partnerschaft und sagt nichts über Abstammung aus. Beispiele: Schwiegereltern, Schwiegerkinder, Schwager
              und Schwägerin (Bruder oder Schwester des Ehepartners, oder Ehepartner eines Geschwisters) und angeheiratete Onkel oder Tanten.
            </p>
            <p>
              Es wird höchstens ein Partnerschaftsschritt berücksichtigt. Bei Partnerschaften ohne Ehe steht „über Partner/in“ statt „Schwieger-“. Ist die
              Ehe geschieden oder getrennt, steht „ehemalige/r“ davor.
            </p>
          </InfoSection>

          <InfoSection title="Stiefbeziehungen">
            <p>
              Ein Stiefelternteil ist der Partner oder die Partnerin eines Elternteils, ohne selbst als Elternteil gespeichert zu sein. Das ist keine Adoption.
              Stiefgeschwister sind Kinder eines Stiefelternteils, ohne gemeinsamen Elternteil.
            </p>
          </InfoSection>

          <InfoSection title="Adoption">
            <p>
              Eine Adoption ist eine rechtliche Eltern-Kind-Beziehung. Sie wird getrennt von der biologischen Abstammung angezeigt und ist am Hinweis
              „Adoptiv-“ oder „über Adoption“ zu erkennen.
            </p>
          </InfoSection>

          <InfoSection title="Mehrere Beziehungen">
            <p>
              Zwei Personen können auf mehreren Wegen verbunden sein, zum Beispiel als Cousin und gleichzeitig angeheiratet. Der Rechner zeigt alle Wege an.
              Die Hauptbezeichnung ist die direkteste Beziehung.
            </p>
          </InfoSection>

          <InfoSection title="Grenzen">
            <p>
              Der Rechner nutzt nur die gespeicherten Daten. Fehlende Eltern oder Verknüpfungen führen zu vorsichtigen Aussagen. Patenschaften, Pflegekinder und
              Vormunde sind nicht abgebildet. Regional werden manche Begriffe unterschiedlich verwendet.
            </p>
          </InfoSection>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function RelationshipCalculator({ graph }: { graph: FamilyGraph }) {
  const [from, setFrom] = useState<PersonDTO | null>(null);
  const [to, setTo] = useState<PersonDTO | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const closeInfo = useCallback(() => setInfoOpen(false), []);

  const analysis = useMemo(() => (from && to ? analyzeRelationship(graph, from.id, to.id) : null), [graph, from, to]);

  const primary = analysis?.findings[0];
  const others = analysis?.findings.slice(1) ?? [];

  return (
    <div className="space-y-3 relative z-50">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">Wähle zwei Personen. Die Beziehung gilt aus Sicht der ersten Person.</p>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label="Erklärung zu den Verwandtschaftsbegriffen öffnen"
          className="glow-button-secondary !py-2 !px-3 text-sm shrink-0 touch-manipulation"
        >
          <span aria-hidden="true">ⓘ</span> Info
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 relative z-50">
        <PersonPicker placeholder="Erste Person suchen…" excludeIds={to ? [to.id] : []} onSelect={setFrom} />
        <PersonPicker placeholder="Zweite Person suchen…" excludeIds={from ? [from.id] : []} onSelect={setTo} />
      </div>

      {from && to && analysis && (
        <>
          {analysis.same ? (
            <div className="rounded-2xl bg-white/60 border border-ink-900/5 p-4 relative z-0">
              <div className="text-xl font-semibold text-ink-900">Dieselbe Person</div>
              <div className="text-sm text-ink-700 mt-2">Beide Auswahlen bezeichnen dieselbe Person.</div>
            </div>
          ) : primary ? (
            <div className="rounded-2xl bg-white/60 border border-ink-900/5 p-4 relative z-0 space-y-3">
              <div className="text-sm text-ink-500">
                Aus Sicht von {fullName(from)} ist {fullName(to)}:
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-500">{CATEGORY_TITLES[primary.category]}</div>
                <div className="text-xl font-semibold text-ink-900 mt-0.5">{primary.label}</div>
              </div>
              <div className="text-sm text-ink-700">
                Umgekehrt ist {from.firstName} für {to.firstName}: <strong>{primary.reverseLabel}</strong>
              </div>
              <FindingDetails f={primary} from={from} to={to} />
            </div>
          ) : (
            <div className="rounded-2xl bg-white/60 border border-ink-900/5 p-4 relative z-0 space-y-2">
              <div className="text-xl font-semibold text-ink-900">Keine verwandtschaftliche Bezeichnung gefunden</div>
              {analysis.connection ? (
                <>
                  <div className="text-sm text-ink-700">
                    Die beiden Personen sind im Stammbaum verbunden, es passt aber keine gängige Verwandtschaftsbezeichnung.
                  </div>
                  <div className="text-sm text-ink-500">Verbindung: {analysis.connection.map(fullName).join(" → ")}</div>
                </>
              ) : (
                <div className="text-sm text-ink-700">Zwischen diesen Personen ist im Stammbaum keine Verbindung gespeichert.</div>
              )}
            </div>
          )}

          {others.length > 0 && (
            <div className="space-y-2 relative z-0">
              <div className="text-sm font-semibold text-ink-900">
                Weitere Beziehungen ({others.length})
              </div>
              {others.map((f, i) => (
                <div key={`${f.label}-${i}`} className="rounded-2xl bg-white/60 border border-ink-900/5 p-4 space-y-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-ink-500">{CATEGORY_TITLES[f.category]}</div>
                    <div className="text-lg font-semibold text-ink-900 mt-0.5">{f.label}</div>
                  </div>
                  <div className="text-sm text-ink-700">
                    Umgekehrt: <strong>{f.reverseLabel}</strong>
                  </div>
                  <FindingDetails f={f} from={from} to={to} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {infoOpen && <InfoDialog onClose={closeInfo} />}
    </div>
  );
}
