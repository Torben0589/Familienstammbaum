import { cn } from "@/lib/utils";

const genderStyles: Record<string, string> = {
  MALE: "bg-sky-100 text-sky-700",
  FEMALE: "bg-rose-100 text-rose-700",
  OTHER: "bg-violet-100 text-violet-700",
  UNKNOWN: "bg-ink-900/5 text-ink-500"
};

const genderLabel: Record<string, string> = {
  MALE: "männlich",
  FEMALE: "weiblich",
  OTHER: "divers",
  UNKNOWN: "unbekannt"
};

export function GenderBadge({ gender }: { gender: string }) {
  return (
    <span className={cn("inline-block text-xs font-medium px-2.5 py-1 rounded-full", genderStyles[gender])}>
      {genderLabel[gender] ?? gender}
    </span>
  );
}
