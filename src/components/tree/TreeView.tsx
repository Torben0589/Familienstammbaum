"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { computeTreeLayout } from "@/lib/treeLayout";
import { initials } from "@/lib/utils";
import { PersonPicker } from "@/components/people/PersonPicker";
import type { CoupleDTO, FamilyGraph, PersonDTO, TreeNode } from "@/types";

// ROUTING-START
// Kachelgröße: Vorname, Nachname, *Geburtsdatum, †Sterbedatum (4 Zeilen).
const COL_WIDTH = 260;
const ROW_HEIGHT = 190;
const CARD_WIDTH = 180;
const CARD_HEIGHT = 104;
const PADDING = 80;
const DRAG_THRESHOLD = 5;

/** Mindestabstand einer Linie zu einer Kachel (nur beim Umgehen mehrerer Zeilen). */
const CARD_CLEARANCE = 14;
/** Mindestabstand zweier Linien, die sich dieselbe Bahn zwischen den Zeilen teilen. */
const LANE_MARGIN = 12;
/** Radius der abgerundeten Ecken der Kinderlinien. */
const CORNER_RADIUS = 10;

interface Point {
  x: number;
  y: number;
}

interface PartnerLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  key: string;
}

interface ChildLine {
  path: string;
  key: string;
  points: Point[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const pt = (x: number, y: number): Point => ({ x: round2(x), y: round2(y) });

// Wandelt rechtwinklige Eckpunkte in einen Pfad mit abgerundeten Ecken um.
function roundedPolyline(input: Point[], radius: number): string {
  const deduped = input.filter(
    (p, i) => i === 0 || p.x !== input[i - 1].x || p.y !== input[i - 1].y
  );
  const pts = deduped.filter((p, i) => {
    if (i === 0 || i === deduped.length - 1) return true;
    const a = deduped[i - 1];
    const c = deduped[i + 1];
    return !((a.x === p.x && p.x === c.x) || (a.y === p.y && p.y === c.y));
  });

  if (pts.length < 2) return "";

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const lenIn = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const lenOut = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, lenIn / 2, lenOut / 2);
    const sx = cur.x + ((prev.x - cur.x) / lenIn) * r;
    const sy = cur.y + ((prev.y - cur.y) / lenIn) * r;
    const ex = cur.x + ((next.x - cur.x) / lenOut) * r;
    const ey = cur.y + ((next.y - cur.y) / lenOut) * r;
    d += ` L ${round2(sx)} ${round2(sy)} Q ${cur.x} ${cur.y} ${round2(ex)} ${round2(ey)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

// Berechnet alle Verbindungslinien.
//  - Partnerlinien laufen von der rechten Kante der linken Karte zur linken Kante der rechten Karte.
//  - Kinderlinien starten in der Mitte der Partnerlinie, laufen senkrecht durch die Lücke
//    zwischen den Eltern in den freien Streifen zwischen zwei Generationen, dort waagerecht
//    und dann senkrecht von oben zum Kind. Dadurch verläuft keine Linie über eine Kachel.
//  - Liegt das Kind mehr als eine Generation tiefer, wird eine freie Bahn zwischen den
//    Kacheln der dazwischenliegenden Zeilen gesucht.
function computeConnections(
  nodes: TreeNode[],
  couples: CoupleDTO[],
  minGen: number
): { partnerLines: PartnerLine[]; childLines: ChildLine[] } {
  const nodeByPerson = new Map(nodes.map((n) => [n.person.id, n]));
  const coupleById = new Map(couples.map((c) => [c.id, c]));

  const rowOf = (personId: string) => (nodeByPerson.get(personId)?.generation ?? 0) - minGen;
  const posOf = (personId: string): Point => {
    const n = nodeByPerson.get(personId);
    if (!n) return { x: 0, y: 0 };
    return { x: n.column * COL_WIDTH, y: (n.generation - minGen) * ROW_HEIGHT };
  };

  const cardXByRow = new Map<number, number[]>();
  for (const n of nodes) {
    const row = n.generation - minGen;
    if (!cardXByRow.has(row)) cardXByRow.set(row, []);
    cardXByRow.get(row)!.push(posOf(n.person.id).x);
  }

  const partnerLines: PartnerLine[] = [];
  const seenPartnerPairs = new Set<string>();

  interface Pending {
    key: string;
    anchorX: number;
    anchorY: number;
    childX: number;
    childY: number;
    parentRow: number;
    childRow: number;
  }
  const pending: Pending[] = [];

  for (const n of nodes) {
    const basePos = posOf(n.person.id);

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

    if (n.parentIds.length === 0) continue;

    // Elterngruppe: bevorzugt die beiden Partner der gespeicherten Partnerschaft.
    let parentGroup = n.parentIds;
    const parentCouple = n.parentCoupleId ? coupleById.get(n.parentCoupleId) : undefined;
    if (
      parentCouple &&
      nodeByPerson.has(parentCouple.parent1Id) &&
      nodeByPerson.has(parentCouple.parent2Id)
    ) {
      parentGroup = [parentCouple.parent1Id, parentCouple.parent2Id];
    }

    const parentIds = parentGroup.filter((pid) => nodeByPerson.has(pid));
    if (parentIds.length === 0) continue;

    const parents = parentIds.map((pid) => posOf(pid)).sort((a, b) => a.x - b.x);
    const parentRow = Math.max(...parentIds.map(rowOf));
    const first = parents[0];
    const last = parents[parents.length - 1];

    // Standard: unten mittig zwischen den Elternkarten.
    let anchorX = (first.x + last.x) / 2 + CARD_WIDTH / 2;
    let anchorY = Math.max(...parents.map((p) => p.y)) + CARD_HEIGHT;

    // Bei zwei Eltern nebeneinander: Start in der Mitte der Partnerlinie.
    if (parents.length >= 2 && Math.abs(first.y - last.y) < 1) {
      const gapStart = first.x + CARD_WIDTH;
      const gapEnd = last.x;

      if (gapEnd > gapStart) {
        const gapMiddle = (gapStart + gapEnd) / 2;
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

    pending.push({
      key: `${n.person.id}-parents`,
      anchorX,
      anchorY,
      childX: basePos.x + CARD_WIDTH / 2,
      childY: basePos.y,
      parentRow,
      childRow: rowOf(n.person.id)
    });
  }

  // ---- Bahnen im Streifen zwischen zwei Zeilen vergeben ----
  // Kinder derselben Eltern teilen sich eine waagerechte Linie. Überlappen sich die
  // Bereiche verschiedener Familien, bekommen sie unterschiedliche Höhen.
  interface Bus {
    channel: number;
    x1: number;
    x2: number;
    lane: number;
  }
  const buses = new Map<string, Bus>();
  const registerBus = (key: string, channel: number, xa: number, xb: number) => {
    const lo = Math.min(xa, xb);
    const hi = Math.max(xa, xb);
    const existing = buses.get(key);
    if (existing) {
      existing.x1 = Math.min(existing.x1, lo);
      existing.x2 = Math.max(existing.x2, hi);
    } else {
      buses.set(key, { channel, x1: lo, x2: hi, lane: 0 });
    }
  };

  // Freie senkrechte Bahn für Kinder, die mehr als eine Zeile tiefer stehen.
  const findLaneX = (p: Pending): number => {
    const blocked: [number, number][] = [];
    for (let row = p.parentRow + 1; row < p.childRow; row += 1) {
      for (const x of cardXByRow.get(row) ?? []) {
        blocked.push([x - CARD_CLEARANCE, x + CARD_WIDTH + CARD_CLEARANCE]);
      }
    }
    const isFree = (x: number) => blocked.every(([a, b]) => x <= a || x >= b);
    const preferred = (p.anchorX + p.childX) / 2;
    const candidates = [preferred, ...blocked.flatMap(([a, b]) => [a, b])].filter(isFree);
    candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
    return candidates[0] ?? preferred;
  };

  const laneXOf = new Map<string, number>();
  for (const p of pending) {
    if (p.childRow === p.parentRow + 1) {
      registerBus(`d:${p.parentRow}:${p.anchorX}:${p.anchorY}`, p.parentRow, p.anchorX, p.childX);
    } else if (p.childRow > p.parentRow + 1) {
      const laneX = findLaneX(p);
      laneXOf.set(p.key, laneX);
      registerBus(`${p.key}:a`, p.parentRow, p.anchorX, laneX);
      registerBus(`${p.key}:b`, p.childRow - 1, laneX, p.childX);
    }
  }

  const busesByChannel = new Map<number, Bus[]>();
  for (const bus of buses.values()) {
    if (!busesByChannel.has(bus.channel)) busesByChannel.set(bus.channel, []);
    busesByChannel.get(bus.channel)!.push(bus);
  }
  const laneCount = new Map<number, number>();
  for (const [channel, list] of busesByChannel) {
    list.sort((a, b) => a.x1 - b.x1 || a.x2 - b.x2);
    const laneEnds: number[] = [];
    for (const bus of list) {
      let lane = laneEnds.findIndex((end) => end + LANE_MARGIN < bus.x1);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(bus.x2);
      } else {
        laneEnds[lane] = bus.x2;
      }
      bus.lane = lane;
    }
    laneCount.set(channel, laneEnds.length);
  }

  const busY = (key: string): number => {
    const bus = buses.get(key)!;
    const count = laneCount.get(bus.channel) ?? 1;
    const top = bus.channel * ROW_HEIGHT + CARD_HEIGHT;
    const height = ROW_HEIGHT - CARD_HEIGHT;
    return top + (height * (bus.lane + 1)) / (count + 1);
  };

  const childLines: ChildLine[] = [];
  for (const p of pending) {
    let points: Point[];

    if (p.childRow === p.parentRow + 1) {
      const y = busY(`d:${p.parentRow}:${p.anchorX}:${p.anchorY}`);
      points = [pt(p.anchorX, p.anchorY), pt(p.anchorX, y), pt(p.childX, y), pt(p.childX, p.childY)];
    } else if (p.childRow > p.parentRow + 1) {
      const laneX = laneXOf.get(p.key) ?? (p.anchorX + p.childX) / 2;
      const y1 = busY(`${p.key}:a`);
      const y2 = busY(`${p.key}:b`);
      points = [
        pt(p.anchorX, p.anchorY),
        pt(p.anchorX, y1),
        pt(laneX, y1),
        pt(laneX, y2),
        pt(p.childX, y2),
        pt(p.childX, p.childY)
      ];
    } else {
      // Ungewöhnliche Daten (Kind nicht unter den Eltern): einfache Linie.
      points = [pt(p.anchorX, p.anchorY), pt(p.childX, p.childY)];
    }

    childLines.push({ key: p.key, points, path: roundedPolyline(points, CORNER_RADIUS) });
  }

  return { partnerLines, childLines };
}
// ROUTING-END

const genderRing: Record<string, string> = {
  MALE: "ring-sky-300",
  FEMALE: "ring-rose-300",
  OTHER: "ring-violet-300",
  UNKNOWN: "ring-ink-900/10"
};

// Gespeicherte Daten sind teils unscharf ("1955", "ca. 1920"). Vollständige Daten
// (JJJJ-MM-TT) werden als TT.MM.JJJJ angezeigt, alles andere unverändert.
function formatCardDate(value?: string | null): string {
  const text = value?.trim();
  if (!text || text === "?") return "";

  const full = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (full) return `${full[3]}.${full[2]}.${full[1]}`;

  const monthYear = text.match(/^(\d{4})-(\d{2})$/);
  if (monthYear) return `${monthYear[2]}.${monthYear[1]}`;

  return text;
}

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

  const minGen = nodes.length ? Math.min(...nodes.map((n) => n.generation)) : 0;
  const maxCol = nodes.length ? Math.max(...nodes.map((n) => n.column)) : 0;
  const maxGen = nodes.length ? Math.max(...nodes.map((n) => n.generation)) : 0;

  const contentWidth = (maxCol + 1) * COL_WIDTH + PADDING * 2;
  const contentHeight = (maxGen - minGen + 1) * ROW_HEIGHT + PADDING * 2;

  const { partnerLines, childLines } = useMemo(
    () => computeConnections(nodes, graph.couples, minGen),
    [nodes, graph.couples, minGen]
  );

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
              {/* Gruppe mit Deckkraft: Wo sich Linien einer Familie überlagern, entsteht kein dunklerer Strich. */}
              <g opacity={0.55}>
                {childLines.map((l) => (
                  <path
                    key={l.key}
                    d={l.path}
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            </svg>

            {nodes.map((n) => {
              const pos = posOf(n.person.id);
              const birth = formatCardDate(n.person.birthDate);
              const death = formatCardDate(n.person.deathDate);
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
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-sm font-semibold text-ink-900 truncate">{n.person.firstName}</div>
                    <div className="text-sm font-semibold text-ink-900 truncate">{n.person.lastName}</div>
                    {birth && <div className="text-xs text-ink-500 truncate mt-0.5">*{birth}</div>}
                    {death && <div className="text-xs text-ink-500 truncate">†{death}</div>}
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
