"use client";

import { useMask } from "../lib/MaskContext";

const filters = ["January 2026", "Asset", "Cost Type", "Location"];

export default function ControlsRow() {
  const { showValues, toggle } = useMask();

  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex items-center gap-2">
        {filters.map((f) => (
          <button key={f} className="px-3 py-1 rounded-md bg-surface-container-low text-label-sm text-secondary">
            {f}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          aria-pressed={showValues}
          onClick={toggle}
          title={showValues ? "Hide values" : "Show values"}
          className="p-1.5 rounded-md hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-[10px]">{showValues ? "visibility" : "visibility_off"}</span>
        </button>
      </div>
    </div>
  );
}
