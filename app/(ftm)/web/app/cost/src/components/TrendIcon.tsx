import type { Trend } from "../lib/data";

const iconMap: Record<Trend, string> = {
  up: "↑",
  down: "↓",
  flat: "—",
};

const colorMap: Record<Trend, string> = {
  up: "text-green-600",
  down: "text-error",
  flat: "text-secondary",
};

export default function TrendIcon({
  trend,
  colorOverride,
}: {
  trend: Trend;
  colorOverride?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined ${colorOverride ?? colorMap[trend]}`}
    >
      {iconMap[trend]}
    </span>
  );
}
