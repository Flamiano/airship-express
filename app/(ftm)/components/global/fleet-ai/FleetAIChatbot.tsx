"use client";

import { Bot } from "lucide-react";
import { useFleetAI } from "./hooks/useFleetAI";
import ChatWindow from "./ChatWindow";

export default function FleetAIChatbot() {
  const {
    isEligible,
    isOpen,
    open,
    close,
    messages,
    sendMessage,
    isSending,
    robotState,
    quickActions,
    greeting,
  } = useFleetAI();

  if (!isEligible) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-end bg-black/20 backdrop-blur-[1px] sm:inset-auto sm:bottom-6 sm:right-6 sm:bg-transparent sm:backdrop-blur-0">
          <ChatWindow
            robotState={robotState}
            greeting={greeting}
            messages={messages}
            isSending={isSending}
            quickActions={quickActions}
            onSend={sendMessage}
            onClose={close}
          />
        </div>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={open}
          aria-label="Open Fleet AI Assistant"
          className="fixed bottom-6 right-6 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl shadow-slate-900/20 transition hover:scale-105 hover:bg-slate-800 active:scale-95"
        >
          <Bot size={24} />
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" aria-hidden />
        </button>
      )}
    </>
  );
}
