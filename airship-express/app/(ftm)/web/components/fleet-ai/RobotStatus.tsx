"use client";

import { useRobotAnimation } from "./hooks/useRobotAnimation";
import type { RobotState } from "./types/chatbot";

export default function RobotStatus({ state }: { state: RobotState }) {
  const visual = useRobotAnimation(state);
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: visual.ledColor, boxShadow: `0 0 5px ${visual.ledColor}` }}
        aria-hidden
      />
      {visual.label}
    </p>
  );
}
