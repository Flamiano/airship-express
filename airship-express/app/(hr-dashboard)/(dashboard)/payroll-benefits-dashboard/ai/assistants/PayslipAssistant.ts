"use client";

import { streamChat } from "../providers/client";
import type {
  ChatMessage,
  PayrollContext,
  MessageAttachment,
} from "../shared/types";
import { generateId } from "../shared/utils";

interface SendMessageOptions {
  history: ChatMessage[];
  userMessage: string;
  context?: PayrollContext;
  employeeId?: string;
  onChunk?: (delta: string) => void;
  onAttachment?: (attachment: MessageAttachment) => void;
  onDone?: (fullText: string) => void;
  onError?: (err: Error) => void;
}

export async function sendChatMessage(
  opts: SendMessageOptions
): Promise<string> {
  const {
    history,
    userMessage,
    context,
    employeeId,
    onChunk,
    onAttachment,
    onDone,
    onError,
  } = opts;

  const messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [];

  for (const msg of history.slice(-10)) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: userMessage });

  let fullText = "";

  try {
    for await (const chunk of streamChat({
      messages,
      temperature: 0.5,
      maxTokens: 1200,
      context,
      employeeId,
    })) {
      if (chunk.attachment) onAttachment?.(chunk.attachment);
      if (chunk.delta) {
        fullText += chunk.delta;
        onChunk?.(chunk.delta);
      }
      if (chunk.done) break;
    }
    onDone?.(fullText);
    return fullText;
  } catch (err: any) {
    onError?.(err);
    throw err;
  }
}

export function createMessage(
  role: ChatMessage["role"],
  content: string
): ChatMessage {
  return {
    id: generateId("chat"),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}
