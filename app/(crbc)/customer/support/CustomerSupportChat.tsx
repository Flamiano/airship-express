"use client";

import { useRef, useEffect, useState } from "react";
import { Send, Paperclip, CheckCheck, Check, Clock, Headphones } from "lucide-react";
import { PageHeader } from "../../components/customer/PortalUI";
import { useChat } from "../../hooks/useChat";
import Image from "next/image";

const QUICK_REPLIES = [
  "What are your operating hours?",
  "Are you open on weekends?",
  "Where is your branch located?",
];

interface Props {
  userId: string;
  displayName: string;
}

export function CustomerSupportChat({ userId, displayName }: Props) {
  const { messages, loading, error, send, sendWithAttachment, markAsRead } = useChat({
    conversationId: userId,
    senderId: userId,
    senderRole: "customer",
  });

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(text?: string) {
    const body = (text ?? input).trim();
    if (!body) return;
    send(body);
    setInput("");
  }

  async function handleAttachmentUpload(file: File) {
    const { createClient } = await import("@/app/(crbc)/library/supabase/client");
    const supabase = createClient();

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `chat/${userId}/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from("chat-attachments")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      return;
    }

    const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(data.path);
    const isImage = file.type.startsWith("image/");

    await sendWithAttachment(input.trim() || (isImage ? "Image" : "📎 File"), {
      url: urlData.publicUrl,
      type: isImage ? "image" : "file",
      name: file.name,
      size: file.size,
    });
    setInput("");
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleAttachmentUpload(file);
    e.target.value = "";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6">
      <PageHeader
        title="Customer Service Chat"
        description="Send us a message. Our support team will respond shortly."
      />

      <div className="rounded-lg border border-line bg-background overflow-hidden flex flex-col" style={{ height: "600px" }}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <Headphones size={14} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Airship Express Support</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-xs text-muted">Online · Typically replies in minutes</p>
              </div>
            </div>
          </div>
          {/* Unread count + mark as read */}
          {(() => {
            const unreadCount = messages.filter(
              (m) => m.sender_role === "agent" && !m.read_at && !m.id.startsWith("optimistic-")
            ).length;
            if (unreadCount === 0) return null;
            return (
              <button
                onClick={markAsRead}
                className="px-2.5 py-1 text-xs font-medium text-muted bg-line/30 hover:bg-line/50 rounded-lg transition-colors flex items-center gap-1.5"
                title="Mark as read"
              >
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
                Mark as read
              </button>
            );
          })()}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-5 py-4 space-y-4">
          {loading && (
            <div className="flex justify-center">
              <span className="text-[11px] text-muted bg-line/40 px-3 py-1 rounded-full">Loading messages…</span>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex justify-center">
              <span className="text-[11px] text-muted bg-line/40 px-3 py-1 rounded-full">
                You are connected to Airship Express Support. An agent will be with you shortly.
              </span>
            </div>
          )}

          {messages.map((msg) => {
            const isCustomer = msg.sender_role === "customer";
            const isOptimistic = msg.id.startsWith("optimistic-");
            const isRead = msg.read_at && !isOptimistic;
            return (
              <div key={msg.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"} gap-2`}>
                {!isCustomer && (
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-1">
                    <Headphones size={11} className="text-accent" />
                  </div>
                )}
                <div className="max-w-[72%] space-y-1">
                  {!isCustomer && (
                    <p className="text-[11px] text-muted font-medium px-1">Support Agent</p>
                  )}
                  {/* Attachment */}
                  {msg.attachment && (
                    <div className="mb-1.5">
                      {msg.attachment.type === "image" ? (
                      <a
                        href={msg.attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Image
                          src={msg.attachment.url}
                          alt={msg.attachment.name}
                          width={320}
                          height={200}
                          unoptimized
                          className="max-w-xs rounded-lg cursor-zoom-in object-contain"
                          style={{
                            width: "auto",
                            height: "auto",
                            maxHeight: "200px",
                          }}
                        />
                      </a>
                      ) : (
                        <a
                          href={msg.attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-xs hover:bg-white/20 transition-colors"
                        >
                          <span className="text-base">📎</span>
                          <span className="truncate max-w-[150px]">{msg.attachment.name}</span>
                          <span className="text-muted/70">
                            {(msg.attachment.size / 1024).toFixed(1)} KB
                          </span>
                        </a>
                      )}
                    </div>
                  )}
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isCustomer
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-line/40 text-foreground rounded-bl-sm"
                  }`}>
                    {msg.text}
                  </div>
                  <div className={`flex items-center gap-1 px-1 ${isCustomer ? "justify-end" : "justify-start"}`}>
                    <span className="text-[10px] text-muted">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isCustomer && (
                      isOptimistic
                        ? <Clock size={10} className="text-muted" />
                        : isRead
                        ? <CheckCheck size={11} className="text-emerald-500" />
                        : <Check size={11} className="text-accent" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {error && (
            <div className="flex justify-center">
              <span className="text-[11px] text-red-500 bg-red-50 dark:bg-red-950/40 px-3 py-1 rounded-full">
                Failed to send. Please try again.
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        <div className="px-4 py-2 border-t border-line flex gap-2 overflow-x-auto scrollbar-none shrink-0">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="shrink-0 text-[11px] px-3 py-1.5 rounded-full border border-line text-muted hover:text-foreground hover:border-foreground/30 hover:bg-line/30 transition-colors whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-line flex flex-col gap-2 shrink-0">
          {/* Attachment button row */}
          <div className="flex items-center gap-2">
            <label className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-line/50 transition-colors cursor-pointer shrink-0" title="Attach file">
              <Paperclip size={15} />
              <input
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
                className="sr-only"
                aria-label="Attach file"
              />
            </label>
          </div>
          {/* Input row */}
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type your message… (Enter to send)"
              rows={2}
              className="flex-1 resize-none px-3 py-2 text-sm bg-background border border-line rounded-xl outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 placeholder:text-muted"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
