"use client";

import { X } from "lucide-react";
import RobotStatus from "./RobotStatus";
import type { RobotState } from "./types/chatbot";

export default function ChatHeader({ state, onClose }: { state: RobotState; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          🤖
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900">Fleet AI Assistant</p>
          <RobotStatus state={state} />
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Close Fleet AI assistant"
        className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={18} />
      </button>
    </div>
  );
}
