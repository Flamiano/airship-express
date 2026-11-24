"use client";

import type { QuickAction } from "./types/chatbot";

export default function QuickActions({
  actions,
  onSelect,
  disabled,
}: {
  actions: QuickAction[];
  onSelect: (prompt: string) => void;
  disabled: boolean;
}) {
  if (actions.length === 0) return null;

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Quick Actions</p>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(action.prompt)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
