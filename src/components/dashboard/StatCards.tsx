import { Card } from "@/components/ui/Card";

interface Stat {
  label: string;
  value: string | number;
  icon: string;
  glow: "amber" | "teal" | "lavender";
}

const glowClass: Record<Stat["glow"], string> = {
  amber: "shadow-glow",
  teal: "shadow-glow-teal",
  lavender: "shadow-glow-lg"
};

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label} className={`!p-5 ${glowClass[s.glow]}`}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">{s.icon}</div>
            <div>
              <div className="text-2xl font-semibold text-ink-900">{s.value}</div>
              <div className="text-sm text-ink-500">{s.label}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
