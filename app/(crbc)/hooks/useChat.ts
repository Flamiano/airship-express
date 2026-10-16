"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "../library/supabase/client";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "customer" | "agent";
  text: string;
  created_at: string;
  read_at?: string | null;
  /** Optional attachment metadata */
  attachment?: {
    url: string;
    type: "image" | "file";
    name: string;
    size: number;
  } | null;
}

interface UseChatOptions {
  conversationId: string | null;
  senderId: string;
  senderRole: "customer" | "agent";
}

export function useChat({ conversationId, senderId, senderRole }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [prevConversationId, setPrevConversationId] = useState<string | null>(conversationId);
const [supabase] = useState(() => createClient());
  if (prevConversationId !== conversationId) {
    setPrevConversationId(conversationId);
    setMessages([]);
    setError(null);
    setLoadedFor(null);
  }

  const loading = conversationId !== null && loadedFor !== conversationId;

  // Initial load: setState only happens inside the async callback.
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;

    supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setMessages((data as ChatMessage[]) ?? []);
        setLoadedFor(conversationId);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, supabase]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            // Replace matching optimistic message
            const withoutOptimistic = prev.filter(
              (m) => !(m.id.startsWith("optimistic-") && m.text === msg.text && m.sender_id === msg.sender_id)
            );
            return [...withoutOptimistic, msg];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? msg : m))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, supabase]);

  const send = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim() || !conversationId) return;

      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: senderRole,
        text: text.trim(),
        created_at: new Date().toISOString(),
        attachment: null,
      };
      setMessages((prev) => [...prev, optimistic]);

      const { error: err } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: senderRole,
        text: text.trim(),
      });

      if (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(err.message);
      }
    },
    [conversationId, senderId, senderRole, supabase]
  );

  // Send message with attachment
  const sendWithAttachment = useCallback(
    async (
      text: string,
      attachment: { url: string; type: "image" | "file"; name: string; size: number }
    ): Promise<void> => {
      if (!conversationId) return;

      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: senderRole,
        text: text.trim(),
        created_at: new Date().toISOString(),
        attachment,
      };
      setMessages((prev) => [...prev, optimistic]);

      const { error: err } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: senderRole,
        text: text.trim(),
        attachment,
      });

      if (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(err.message);
      }
    },
    [conversationId, senderId, senderRole, supabase]
  );

  // Mark all unread messages from the other party as read
  const markAsRead = useCallback(async (): Promise<void> => {
    if (!conversationId) return;

    // Determine which role's messages we should mark as read
    // Staff reads customer messages; customer reads agent messages
    const targetSenderRole = senderRole === "agent" ? "customer" : "agent";

    const { error: err } = await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("sender_role", targetSenderRole)
      .is("read_at", null);

    if (err) {
      console.error("Failed to mark messages as read:", err);
    }
  }, [conversationId, senderRole, supabase]);

  // Auto-mark as read when messages load or new messages arrive
  useEffect(() => {
    if (!conversationId || loading) return;
    // Small delay to let messages settle
    const timer = setTimeout(() => {
      markAsRead();
    }, 500);
    return () => clearTimeout(timer);
  }, [conversationId, loading, markAsRead]);

  return { messages, loading, error, send, sendWithAttachment, markAsRead };
}