import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Formatiert ein gespeichertes Datum (oft nur Jahr oder "ca. 1920") für die Anzeige.
export function formatFuzzyDate(value?: string | null): string {
  if (!value) return "unbekannt";
  return value;
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function initials(p: { firstName: string; lastName: string }): string {
  return `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase();
}

export function lifeSpan(p: { birthDate?: string | null; deathDate?: string | null }): string {
  const birth = p.birthDate ?? "?";
  if (p.deathDate) return `${birth} – ${p.deathDate}`;
  return `* ${birth}`;
}

export function yearOf(value?: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}
