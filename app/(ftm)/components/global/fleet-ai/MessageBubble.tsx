"use client";

import StructuredCardRenderer from "./cards/StructuredCards";
import type { ChatMessage } from "./types/chatbot";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={[
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
            isUser
              ? "rounded-br-sm bg-slate-900 text-white"
              : message.isError
              ? "rounded-bl-sm border border-rose-200 bg-rose-50 text-rose-700"
              : "rounded-bl-sm border border-slate-200 bg-white text-slate-800",
          ].join(" ")}
        >
          {message.content}
        </div>
        {message.structuredData?.map((card, i) => (
          <StructuredCardRenderer key={`${message.id}-card-${i}`} card={card} />
        ))}
      </div>
    </div>
  );
}
