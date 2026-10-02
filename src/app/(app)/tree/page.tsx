"use client";

import { useEffect, useState } from "react";
import { TreeView } from "@/components/tree/TreeView";
import type { FamilyGraph } from "@/types";

export default function TreePage() {
  const [graph, setGraph] = useState<FamilyGraph | null>(null);

  useEffect(() => {
    fetch("/api/graph")
      .then((res) => res.json())
      .then(setGraph);
  }, []);

  if (!graph) return <p className="pt-6 text-sm text-ink-500">Lädt…</p>;

  return <TreeView graph={graph} />;
}
