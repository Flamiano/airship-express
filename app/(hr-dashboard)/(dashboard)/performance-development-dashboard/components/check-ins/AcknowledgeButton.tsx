"use client";

import { CheckCircle2 } from "lucide-react";

type Props = {
  acknowledged: boolean;
  acknowledging: boolean;
  onAcknowledge: () => void;
};

/**
 * Renders the employee-side acknowledgment action. When acknowledged, it shows
 * a static confirmed state (repeated clicks are impossible client-side; the
 * server additionally returns an idempotent result).
 */
export function AcknowledgeButton({
  acknowledged,
  acknowledging,
  onAcknowledge,
}: Props) {
  if (acknowledged) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={15} strokeWidth={2} />
        Acknowledged
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onAcknowledge}
      disabled={acknowledging}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[13px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
    >
      <CheckCircle2 size={15} strokeWidth={2} />
      {acknowledging ? "Acknowledging..." : "Acknowledge"}
    </button>
  );
}