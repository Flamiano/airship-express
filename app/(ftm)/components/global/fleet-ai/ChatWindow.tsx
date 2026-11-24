"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import QuickActions from "./QuickActions";
import type { ChatMessage, QuickAction, RobotState } from "./types/chatbot";

// The 3D robot pulls in three.js / R3F - keep it out of the main bundle and
// never render it on the server.
const RobotScene = dynamic(() => import("./RobotScene"), { ssr: false, loading: () => <div className="h-full w-full" /> });

interface ChatWindowProps {
  robotState: RobotState;
  greeting: string;
  messages: ChatMessage[];
  isSending: boolean;
  quickActions: QuickAction[];
  onSend: (text: string) => void;
  onClose: () => void;
}

export default function ChatWindow({
  robotState,
  greeting,
  messages,
  isSending,
  quickActions,
  onSend,
  onClose,
}: ChatWindowProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fleet AI Assistant"
      className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-[640px] sm:w-[400px] sm:rounded-3xl sm:border sm:border-slate-200"
    >
      <ChatHeader state={robotState} onClose={onClose} />

      <div className="h-40 shrink-0 border-b border-slate-100 bg-gradient-to-b from-slate-100 to-white sm:h-48">
        <RobotScene state={robotState} active />
      </div>

      <MessageList messages={messages} greeting={greeting} isSending={isSending} />
      <QuickActions actions={quickActions} onSelect={onSend} disabled={isSending} />
      <ChatInput onSend={onSend} disabled={isSending} />
    </div>
  );
}
