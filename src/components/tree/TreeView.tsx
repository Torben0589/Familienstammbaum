"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { computeTreeLayout } from "@/lib/treeLayout";
import { fullName, lifeSpan, initials } from "@/lib/utils";
import { PersonPicker } from "@/components/people/PersonPicker";
import type { FamilyGraph, PersonDTO } from "@/types";

const COL_WIDTH = 260;
const ROW_HEIGHT = 190;
const CARD_WIDTH = 168;
const CARD_HEIGHT = 92;
const PADDING = 80;
const DRAG_THRESHOLD = 5;

const genderRing: Record<string, string> = {
  MALE: "ring-sky-300",
  FEMALE: "ring-rose-300",
  OTHER: "ring-violet-300",
  UNKNOWN: "ring-ink-900/10"
};

export function TreeView({ graph }: { graph: FamilyGraph }) {
  const [rootId, setRootId] = useState<string | undefined>(undefined);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: PADDING, y: PADDING });
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { nodes } = useMemo(() => computeTreeLayout(graph, rootId), [graph, rootId]);

  const nodeByPerson = useMemo(() => new Map(nodes.map((n) => [n.person.id, n])), [nodes]);
  const coupleById = useMemo(() => new Map(graph.couples.map((c) => [c.id, c])), [graph.couples]);

  const minGen = nodes.length ? Math.min(...nodes.map((n) => n.generation)) : 0;
  const maxCol = nodes.length ? Math.max(...nodes.map((n) => n.column)) : 0;
  const maxGen = nodes.length ? Math.max(...nodes.map((n) => n.generation)) : 0;

  const contentWidth = (maxCol + 1) * COL_WIDTH + PADDING * 2;
  const contentHeight = (maxGen - minGen + 1) * ROW_HEIGHT + PADDING * 2;

  function posOf(personId: string) {
    const n = nodeByPerson.get(personId);
    if (!n) return { x: 0, y: 0 };
    return {
      x: n.column * COL_WIDTH,
      y: (n.generation - minGen) * ROW_HEIGHT
    };
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setScale((s) => Math.min(2, Math.max(0.35, s + delta)));
  }

  // Kein Pointer-Capture beim Antippen: sonst wird der Klick auf die
  // Personenkarten (Link) auf den Container umgeleitet und die Karte öffnet nicht.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;

    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.moved) {
      if (Math.abs(dx) <= DRAG_THRESHOLD && Math.abs(dy) <= DRAG_THRESHOLD) return;

      // Erst jetzt ist es ein Ziehen: Pointer einfangen.
      drag.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
    }

    setPan({
      x: drag.panX + dx / scale,
      y: drag.panY + dy / scale
    });
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current?.pointerId !== e.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    setIsDragging(false);

    window.setTimeout(() => {
      dragState.current = null;
    }, 0);
  }

  function onTreeClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (dragState.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Alle Verbindungslinien vorberechnen (Partner-Linien + Eltern-Kind-Linien).
  const partnerLines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
  const childLines: { path: string; key: string }[] = [];
  const seenPartnerPairs = new Set<string>();

  for (const n of nodes) {
    const basePos = posOf(n.person.id);

    // Partnerlinie: immer von der rechten Kante der linken Karte
    // zur linken Kante der rechten Karte.
    for (const partnerId of n.partnerIds) {
      const pairKey = [n.person.id, partnerId].sort().join("|");
      if (seenPartnerPairs.has(pairKey)) continue;
      seenPartnerPairs.add(pairKey);

      const partnerPos = posOf(partnerId);
      const leftPos = basePos.x <= partnerPos.x ? basePos : partnerPos;
      const rightPos = basePos.x <= partnerPos.x ? partnerPos : basePos;

      partnerLines.push({
        x1: leftPos.x + CARD_WIDTH,
        y1: leftPos.y + CARD_HEIGHT / 2,
        x2: rightPos.x,
        y2: rightPos.y + CARD_HEIGHT / 2,
        key: pairKey
      });
    }

    if (n.parentIds.length > 0) {
      // Elterngruppe bestimmen: bevorzugt die beiden Partner der gespeicherten
      // Partnerschaft, sonst alle eingetragenen Eltern (nicht nur das erste Elternteil).
      let parentGroup = n.parentIds;
      const parentCouple = n.parentCoupleId ? coupleById.get(n.parentCoupleId) : undefined;
      if (
        parentCouple &&
        nodeByPerson.has(parentCouple.parent1Id) &&
        nodeByPerson.has(parentCouple.parent2Id)
      ) {
        parentGroup = [parentCouple.parent1Id, parentCouple.parent2Id];
      }

      const parents = parentGroup
        .filter((pid) => nodeByPerson.has(pid))
        .map((pid) => posOf(pid))
        .sort((a, b) => a.x - b.x);

      if (parents.length > 0) {
        const first = parents[0];
        const last = parents[parents.length - 1];

        // Standard: unten mittig zwischen den Elternkarten.
        let anchorX = (first.x + last.x) / 2 + CARD_WIDTH / 2;
        let anchorY = Math.max(...parents.map((p) => p.y)) + CARD_HEIGHT;

        // Bei zwei Eltern nebeneinander: Linie startet in der Mitte der Partnerlinie.
        if (parents.length >= 2 && Math.abs(first.y - last.y) < 1) {
          const gapStart = first.x + CARD_WIDTH;
          const gapEnd = last.x;

          if (gapEnd > gapStart) {
            const gapMiddle = (gapStart + gapEnd) / 2;

            // Nur verwenden, wenn dort keine fremde Karte liegt.
            const blocked = nodes.some((o) => {
              if (parentGroup.includes(o.person.id)) return false;
              const op = posOf(o.person.id);
              return (
                Math.abs(op.y - first.y) < 1 &&
                op.x < gapMiddle + 1 &&
                op.x + CARD_WIDTH > gapMiddle - 1
              );
            });

            if (!blocked) {
              anchorX = gapMiddle;
              anchorY = first.y + CARD_HEIGHT / 2;
            }
          }
        }

        const childX = basePos.x + CARD_WIDTH / 2;
        const childY = basePos.y;
        const midY = anchorY + (childY - anchorY) / 2;

        childLines.push({
          key: `${n.person.id}-parents`,
          path: `M ${anchorX} ${anchorY} C ${anchorX} ${midY}, ${childX} ${midY}, ${childX} ${childY}`
        });
      }
    }
  }

  return (
    <div className="pt-4 md:pt-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Stammbaum</h1>
          <p className="text-ink-500 mt-1 text-sm">
            Ziehen zum Verschieben, Mausrad zum Zoomen. Klicke auf eine Person für Details.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="w-64">
            <PersonPicker
              placeholder="Person auswählen…"
              onSelect={(p: PersonDTO) => setRootId(p.id)}
            />
          </div>
          {rootId && (
            <button className="glow-button-secondary !py-2 !px-3 text-sm" onClick={() => setRootId(undefined)}>
              Zurücksetzen
            </button>
          )}
          <button className="glow-button-secondary !py-2 !px-3 text-sm" onClick={() => setScale((s) => Math.min(2, s + 0.15))}>
            ➕
          </button>
          <button className="glow-button-secondary !py-2 !px-3 text-sm" onClick={() => setScale((s) => Math.max(0.35, s - 0.15))}>
            ➖
          </button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="glass-card p-10 text-center text-ink-500">
          Noch keine Personen vorhanden. Lege zuerst Personen unter „Personen“ an.
        </div>
      ) : (
        <div
          className="glass-card overflow-hidden relative select-none"
          style={{
            height: "70vh",
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none"
          }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClickCapture={onTreeClickCapture}
        >
          <div
            style={{
              position: "absolute",
              transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: "0 0",
              width: contentWidth,
              height: contentHeight
            }}
          >
            <svg
              width={contentWidth}
              height={contentHeight}
              className="absolute inset-0 pointer-events-none"
            >
              {partnerLines.map((l) => (
                <line
                  key={l.key}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="#ffb347"
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.6}
                />
              ))}
              {childLines.map((l) => (
                <path key={l.key} d={l.path} fill="none" stroke="#a78bfa" strokeWidth={2.5} opacity={0.55} />
              ))}
            </svg>

            {nodes.map((n) => {
              const pos = posOf(n.person.id);
              return (
                <Link
                  key={n.person.id}
                  href={`/people/${n.person.id}`}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT
                  }}
                  className={`glass-card !rounded-2xl !p-3 flex items-center gap-2.5 hover:shadow-glow-lg transition-shadow ring-2 ${genderRing[n.person.gender] ?? ""}`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-glow to-lavender-glow text-white flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials(n.person)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink-900 truncate">{fullName(n.person)}</div>
                    <div className="text-xs text-ink-500 truncate">{lifeSpan(n.person)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
