"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import type { ChatMessage } from "./types/chatbot";

export default function MessageList({
  messages,
  greeting,
  isSending,
}: {
  messages: ChatMessage[];
  greeting: string;
  isSending: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isSending]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm">
          {greeting}
        </div>
      </div>

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isSending && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
