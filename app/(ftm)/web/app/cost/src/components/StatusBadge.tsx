import type { AssetStatus } from "../lib/data";

const statusStyles: Record<
  AssetStatus,
  { bg: string; text: string; dot: string }
> = {
  "Over Budget": {
    bg: "bg-error-container",
    text: "text-on-error-container",
    dot: "bg-error",
  },
  "On Target": {
    bg: "bg-success-container",
    text: "text-secondary-fixed-dim",
    dot: "bg-green-600",
  },
  "Watch List": {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    dot: "bg-yellow-500",
  },
  "Rising Costs": {
    bg: "bg-error-container",
    text: "text-on-error-container",
    dot: "bg-error",
  },
  Optimized: {
    bg: "bg-success-container",
    text: "text-secondary-fixed-dim",
    dot: "bg-green-600",
  },
};

export default function StatusBadge({ status }: { status: AssetStatus }) {
  const style = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm ${style.bg} ${style.text} text-label-sm font-label-sm`}
    >
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
