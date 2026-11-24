import { useCallback, useRef, useState } from "react";
import { sendChatMessage, FleetAIError } from "../services/chatbotService";
import { toStructuredCards } from "../utils/formatResponse";
import type { ChatMessage, RobotState } from "../types/chatbot";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(page: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [robotState, setRobotState] = useState<RobotState>("idle");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const pushMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      setError(null);
      pushMessage({ id: makeId(), role: "user", content: trimmed, createdAt: new Date().toISOString() });
      setIsSending(true);
      setRobotState("thinking");

      try {
        const response = await sendChatMessage({
          message: trimmed,
          conversationId: conversationIdRef.current,
          page,
        });

        if (response.conversationId) conversationIdRef.current = response.conversationId;

        const cards = toStructuredCards(response);
        const failed = Boolean(response.error);

        setRobotState(failed ? "error" : "speaking");
        pushMessage({
          id: makeId(),
          role: "assistant",
          content: response.reply,
          createdAt: new Date().toISOString(),
          structuredData: cards.length ? cards : undefined,
          isError: failed,
        });

        window.setTimeout(() => setRobotState(failed ? "error" : "success"), 900);
        window.setTimeout(() => setRobotState("idle"), 2400);
      } catch (err) {
        const message =
          err instanceof FleetAIError ? err.message : "Sorry, I couldn't retrieve the current fleet data. Please try again.";
        setError(message);
        setRobotState("error");
        pushMessage({ id: makeId(), role: "assistant", content: message, createdAt: new Date().toISOString(), isError: true });
        window.setTimeout(() => setRobotState("idle"), 2400);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, page, pushMessage]
  );

  const reset = useCallback(() => {
    setMessages([]);
    conversationIdRef.current = null;
    setError(null);
    setRobotState("idle");
  }, []);

  return { messages, sendMessage, isSending, robotState, setRobotState, error, reset };
}
