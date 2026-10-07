"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { computeTreeLayout } from "@/lib/treeLayout";
import { initials } from "@/lib/utils";
import { PersonPicker } from "@/components/people/PersonPicker";
import { FamilyStatisticsPanel } from "@/components/family/FamilyStatisticsPanel";
import { RelationshipCalculator } from "@/components/family/RelationshipCalculator";
import type { CoupleDTO, FamilyGraph, PartnershipType, PersonDTO, TreeNode } from "@/types";

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

// ---------------------------------------------------------------------------
// Partnerschafts-Symbole (auf der Partnerlinie zwischen zwei Kacheln)
//   Verheiratet   = zwei ineinander verschlungene Ringe, durchgezogene Linie
//   Partnerschaft = Herz, durchgezogene Linie
//   Getrennt      = zwei getrennte Ringe, gepunktete Linie
//   Geschieden    = zwei Ringe mit rotem Schrägstrich, gestrichelte Linie
// Ohne gespeicherte Partnerschaft (Typ unbekannt) bleibt die Linie wie bisher ohne Symbol.
// ---------------------------------------------------------------------------
const PARTNER_STYLE: Record<
  PartnershipType,
  { label: string; stroke: string; dash?: string; opacity: number }
> = {
  MARRIED: { label: "Verheiratet", stroke: "#ffb347", opacity: 0.6 },
  PARTNERED: { label: "Partnerschaft", stroke: "#ffb347", opacity: 0.6 },
  SEPARATED: { label: "Getrennt", stroke: "#94a3b8", dash: "1 7", opacity: 0.9 },
  DIVORCED: { label: "Geschieden", stroke: "#94a3b8", dash: "8 6", opacity: 0.9 }
};
const PARTNER_TYPES_ORDER: PartnershipType[] = ["MARRIED", "PARTNERED", "SEPARATED", "DIVORCED"];
/** Ist die Lücke zwischen zwei Partnerkacheln kleiner, wird kein Symbol gezeichnet. */
const SYMBOL_MIN_GAP = 24;
const SYMBOL_MAX_SIZE = 28;

// Herz (Material-Icon, 24x24).
const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

function PartnerSymbol({
  type,
  cx,
  cy,
  size
}: {
  type: PartnershipType;
  cx: number;
  cy: number;
  size: number;
}) {
  const sw = Math.max(1.4, size * 0.07);
  const backdrop = (
    <rect
      x={cx - size / 2}
      y={cy - size * 0.4}
      width={size}
      height={size * 0.8}
      rx={size * 0.4}
      fill="white"
      opacity={0.85}
    />
  );

  if (type === "MARRIED" || type === "DIVORCED") {
    const r = size * 0.27;
    const d = size * 0.19;
    const color = type === "MARRIED" ? "#d97706" : "#64748b";
    return (
      <g>
        {backdrop}
        <circle cx={cx - d} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} />
        <circle cx={cx + d} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} />
        {type === "DIVORCED" && (
          <line
            x1={cx - size * 0.3}
            y1={cy + size * 0.3}
            x2={cx + size * 0.3}
            y2={cy - size * 0.3}
            stroke="#e11d48"
            strokeWidth={sw * 1.2}
            strokeLinecap="round"
          />
        )}
      </g>
    );
  }

  if (type === "SEPARATED") {
    const r = size * 0.22;
    const d = r + size * 0.04;
    return (
      <g>
        {backdrop}
        <circle cx={cx - d} cy={cy} r={r} fill="none" stroke="#64748b" strokeWidth={sw} />
        <circle cx={cx + d} cy={cy} r={r} fill="none" stroke="#64748b" strokeWidth={sw} />
      </g>
    );
  }

  if (type === "PARTNERED") {
    const k = (size * 0.6) / 24;
    return (
      <g>
        {backdrop}
        <path
          d={HEART_PATH}
          fill="#fb7185"
          transform={`translate(${round2(cx - 12 * k)} ${round2(cy - 12 * k)}) scale(${Math.round(k * 1000) / 1000})`}
        />
      </g>
    );
  }

  return null;
}

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
  const [highlightedId, setHighlightedId] = useState<string | undefined>(undefined);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showRelationship, setShowRelationship] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
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
  const justDraggedRef = useRef(false);
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

  // Partnerschaft je Personenpaar (Schlüssel wie bei den Partnerlinien: "idA|idB", sortiert).
  // Gibt es mehrere Einträge für dasselbe Paar (z. B. erneut geheiratet), gewinnt der jüngste.
  const coupleByPair = useMemo(() => {
    const map = new Map<string, CoupleDTO>();
    for (const c of graph.couples) {
      const key = [c.parent1Id, c.parent2Id].sort().join("|");
      const existing = map.get(key);
      if (!existing || (c.startDate ?? "") >= (existing.startDate ?? "")) map.set(key, c);
    }
    return map;
  }, [graph.couples]);

  // Legende: nur die Arten, die im Baum tatsächlich vorkommen.
  const legendTypes = useMemo(() => {
    const present = new Set<string>();
    for (const l of partnerLines) {
      const type = coupleByPair.get(l.key)?.type;
      if (type) present.add(type);
    }
    return PARTNER_TYPES_ORDER.filter((t) => present.has(t));
  }, [partnerLines, coupleByPair]);

  function posOf(personId: string) {
    const n = nodeByPerson.get(personId);
    if (!n) return { x: 0, y: 0 };
    return {
      x: n.column * COL_WIDTH,
      y: (n.generation - minGen) * ROW_HEIGHT
    };
  }

  useEffect(() => {
    if (!highlightedId) return;
    const viewport = viewportRef.current;
    const pos = posOf(highlightedId);
    if (!viewport || !nodeByPerson.has(highlightedId)) return;
    const nextScale = Math.max(scale, 0.75);
    setScale(nextScale);
    setPan({
      x: viewport.clientWidth / (2 * nextScale) - pos.x - CARD_WIDTH / 2,
      y: viewport.clientHeight / (2 * nextScale) - pos.y - CARD_HEIGHT / 2
    });
  }, [highlightedId, nodeByPerson]);

  function selectSearchPerson(person: PersonDTO) {
    setRootId(person.id);
    setHighlightedId(person.id);
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

    justDraggedRef.current = false;
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
      justDraggedRef.current = true;
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
    dragState.current = null;

    // Den nach einem echten Ziehen erzeugten Klick kurz blockieren.
    if (justDraggedRef.current) {
      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 300);
    }
  }

  function onTreeClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (justDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Tipp auf eine Kachel: direkt beim Loslassen per harter Navigation öffnen.
  // (router.push reagiert auf dem iPhone hier nicht zuverlässig.)
  function onPersonPointerUp(
    e: React.PointerEvent<HTMLAnchorElement>,
    personId: string
  ) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== e.pointerId || drag.moved) return;
    e.preventDefault();
    window.location.assign(`/people/${personId}/edit`);
  }

  // Der normale Link-Klick wird unterdrückt, damit nicht doppelt navigiert wird.
  function onPersonClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (justDraggedRef.current) return;
    window.location.assign(e.currentTarget.getAttribute("href") ?? "/");
  }

  return (
    <div className="pt-4 md:pt-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Stammbaum</h1>
          <p className="text-ink-500 mt-1 text-sm">
            Ziehen zum Verschieben, Mausrad zum Zoomen. Tippe auf eine Person zum Bearbeiten.
          </p>
          {legendTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-ink-500">
              {legendTypes.map((t) => (
                <span key={t} className="inline-flex items-center gap-1">
                  <svg width={34} height={24} viewBox="0 0 34 24" aria-hidden="true">
                    <PartnerSymbol type={t} cx={17} cy={12} size={28} />
                  </svg>
                  {PARTNER_STYLE[t].label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="w-64">
            <PersonPicker
              placeholder="Person auswählen…"
              onSelect={selectSearchPerson}
            />
          </div>

          {rootId && (
            <button className="glow-button-secondary !py-2 !px-3 text-sm" onClick={() => { setRootId(undefined); setHighlightedId(undefined); }}>
              Zurücksetzen
            </button>
          )}

          <button className="glow-button-secondary !py-2 !px-3 text-sm" onClick={() => setScale((s) => Math.min(2, s + 0.15))}>
            ➕
          </button>

          <button className="glow-button-secondary !py-2 !px-3 text-sm" onClick={() => setScale((s) => Math.max(0.35, s - 0.15))}>
            ➖
          </button>
          <button className="glow-button-secondary !py-2 !px-3 text-sm" onClick={() => setShowStatistics((v) => !v)}>
            Statistik
          </button>
          <button className="glow-button-secondary !py-2 !px-3 text-sm" onClick={() => setShowRelationship((v) => !v)}>
            Verwandtschaft
          </button>
        </div>
      </div>

      {showStatistics && <div className="glass-card p-4"><h2 className="text-lg font-semibold text-ink-900 mb-3">Familienstatistik</h2><FamilyStatisticsPanel graph={graph} nodes={nodes} /></div>}
      {showRelationship && <div className="glass-card p-4"><h2 className="text-lg font-semibold text-ink-900 mb-3">Verwandtschaftsrechner</h2><RelationshipCalculator graph={graph} /></div>}

      {nodes.length === 0 ? (
        <div className="glass-card p-10 text-center text-ink-500">
          Noch keine Personen vorhanden. Lege zuerst Personen unter „Personen“ an.
        </div>
      ) : (
        <div
          ref={viewportRef}
          className="glass-card relative select-none"
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
              {partnerLines.map((l) => {
                const type = coupleByPair.get(l.key)?.type;
                const style = type ? PARTNER_STYLE[type] : undefined;
                return (
                  <line
                    key={l.key}
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke={style?.stroke ?? "#ffb347"}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={style?.dash}
                    opacity={style?.opacity ?? 0.6}
                  />
                );
              })}

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

              {/* Partnerschafts-Symbole: mittig über der Partnerlinie, damit die Kinderlinie frei bleibt. */}
              {partnerLines.map((l) => {
                const type = coupleByPair.get(l.key)?.type;
                if (!type || !PARTNER_STYLE[type]) return null;
                const gap = l.x2 - l.x1;
                if (gap < SYMBOL_MIN_GAP) return null;
                const size = Math.min(SYMBOL_MAX_SIZE, gap - 8);
                return (
                  <PartnerSymbol
                    key={`${l.key}-symbol`}
                    type={type}
                    cx={(l.x1 + l.x2) / 2}
                    cy={(l.y1 + l.y2) / 2 - size * 0.45 - 4}
                    size={size}
                  />
                );
              })}
            </svg>

            {nodes.map((n) => {
              const pos = posOf(n.person.id);
              const birth = formatCardDate(n.person.birthDate);
              const death = formatCardDate(n.person.deathDate);
              return (
                <Link
                  key={n.person.id}
                  href={`/people/${n.person.id}/edit`}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none"
                  }}
                  onPointerUp={(e) => onPersonPointerUp(e, n.person.id)}
                  onClick={onPersonClick}
                  onDragStart={(e) => e.preventDefault()}
                  className={`glass-card !rounded-2xl !p-3 flex items-center gap-2.5 hover:shadow-glow-lg transition-all ring-2 ${genderRing[n.person.gender] ?? ""} ${highlightedId === n.person.id ? "ring-4 ring-amber-400 shadow-glow-lg scale-105 z-10" : ""}`}
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
