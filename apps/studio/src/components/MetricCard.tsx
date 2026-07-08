import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "green" | "yellow" | "red" | "violet";
}

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  blue: "border-breach-blue/45 text-breach-blue",
  green: "border-breach-green/45 text-breach-green",
  yellow: "border-breach-yellow/45 text-breach-yellow",
  red: "border-breach-red/45 text-breach-red",
  violet: "border-breach-violet/45 text-breach-violet",
};

export function MetricCard({ detail, icon: Icon, label, tone = "blue", value }: MetricCardProps) {
  return (
    <section className={`min-w-0 rounded-lg border bg-panel-2 p-4 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon aria-hidden="true" className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="mt-3 break-all text-2xl font-bold text-ink sm:text-3xl">{value}</div>
      <p className="mt-1 text-sm leading-5 text-muted">{detail}</p>
    </section>
  );
}
