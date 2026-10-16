"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Search, Send, Inbox, X, Menu, MessageSquare, Paperclip, CheckCheck, Check,
  AlertTriangle, Shield, Zap, Loader2, HelpCircle,
} from "lucide-react";
import type { Customers } from "../../../types/customer";
import { useChat } from "../../../hooks/useChat";
import Image from "next/image";


const MESSAGES_TABLE = "chat_messages";     // table that useChat reads from
const CONVERSATION_COLUMN = "conversation_id"; // column holding customer.auth_user_id
const ML_API_URL = "https://ml-experiments-vert.vercel.app/api/predict";
const STORAGE_KEY = "crbc-conversation-classifications";
const BULK_CONCURRENCY = 4;                 // parallel ML requests
const BULK_REFRESH_MS = 30 * 1000;      // re-check for new messages / new PHT day


type MLLabel = "urgent" | "not_urgent" | "spam" | "uncertain" | null;

interface MLResponse {
  label: MLLabel;
  predicted_label: MLLabel;
  needs_review: boolean;
  confidence: number;
  scores: Record<string, number>;
  message: string;
}

interface ConversationClassification {
  conversationId: string;
  date: string; // YYYY-MM-DD in PHT
  label: MLLabel;
  confidence: number;
  scores: Record<string, number>;
  messageCount: number; // customer messages (today, PHT) that were classified
  classifiedAt: string; // ISO timestamp
}

interface ClassifiableMessage {
  sender_role: string;
  text: string;
  attachment?: unknown;
  created_at: string;
}

type MessageRow = ClassifiableMessage & Record<string, unknown>;

type FilterLabel = "all" | "urgent" | "not_urgent" | "spam" | "uncertain";

function getLabelColor(label: MLLabel): string {
  switch (label) {
    case "urgent": return "bg-red-500 text-white";
    case "not_urgent": return "bg-emerald-500 text-white";
    case "spam": return "bg-amber-500 text-white";
    case "uncertain": return "bg-violet-500 text-white";
    default: return "bg-foreground/10 text-foreground/40";
  }
}

function getLabelIcon(label: MLLabel) {
  switch (label) {
    case "urgent": return <Zap size={9} className="shrink-0" />;
    case "not_urgent": return <Shield size={9} className="shrink-0" />;
    case "spam": return <AlertTriangle size={9} className="shrink-0" />;
    case "uncertain": return <HelpCircle size={9} className="shrink-0" />;
    default: return null;
  }
}

function getLabelText(label: MLLabel): string {
  switch (label) {
    case "urgent": return "Urgent";
    case "not_urgent": return "Not Urgent";
    case "spam": return "Spam";
    case "uncertain": return "Uncertain";
    default: return "—";
  }
}


const phtFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }); // YYYY-MM-DD

function getPHTDate(): string {
  return phtFormatter.format(new Date());
}

function getPHTDateFromTimestamp(timestamp: string): string {
  return phtFormatter.format(new Date(timestamp));
}

/** Join all customer text messages sent today (12:00 AM PHT onward). */
function buildConversationText(messages: ClassifiableMessage[]): { text: string; count: number } {
  const today = getPHTDate();
  const todays = messages.filter(
    (m) =>
      m.sender_role === "customer" &&
      m.text?.trim() &&
      !m.attachment &&
      getPHTDateFromTimestamp(m.created_at) === today
  );
  return {
    text: todays.map((m) => m.text.trim()).join(" \n "),
    count: todays.length,
  };
}


/**
 * One query: today's (12:00 AM PHT onward) customer messages for the given conversations,
 * grouped by conversation id. Throws on Supabase errors.
 */
async function fetchTodaysCustomerMessages(ids: string[]): Promise<Map<string, ClassifiableMessage[]>> {
  const { createClient } = await import("@/app/(crbc)/library/supabase/client");
  const supabase = createClient();

  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select("*")
    .in(CONVERSATION_COLUMN, ids)
    .eq("sender_role", "customer")
    .gte("created_at", `${getPHTDate()}T00:00:00+08:00`) // 12:00 AM PHT
    .limit(10000);
  if (error) throw error;

  const grouped = new Map<string, ClassifiableMessage[]>();
  for (const row of (data ?? []) as MessageRow[]) {
    const key = row[CONVERSATION_COLUMN] as string;
    const list = grouped.get(key);
    if (list) list.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

interface Props {
  staffId: string;
  customers: Customers[];
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-foreground/8 border border-foreground/10 flex items-center justify-center text-sm font-semibold text-foreground shrink-0">
      {initials(name)}
    </div>
  );
}

function ClassificationBadge({
  classification,
  analyzing,
  showConfidence = false,
  size = "sm",
}: {
  classification?: ConversationClassification;
  analyzing: boolean;
  showConfidence?: boolean;
  size?: "sm" | "md";
}) {
  const base =
    size === "md"
      ? "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full shrink-0"
      : "inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium rounded-full shrink-0";

  if (analyzing) {
    return (
      <span className={`${base} bg-foreground/10 text-foreground/50`}>
        <Loader2 size={8} className="animate-spin" />
        Analyzing…
      </span>
    );
  }

  if (!classification?.label) {
    return <span className={`${base} bg-foreground/10 text-foreground/40`}>—</span>;
  }

  return (
    <span className={`${base} ${getLabelColor(classification.label)}`}>
      {getLabelIcon(classification.label)}
      {getLabelText(classification.label)}
      {showConfidence && classification.confidence > 0 && (
        <span className="opacity-80">{(classification.confidence * 100).toFixed(0)}%</span>
      )}
    </span>
  );
}

function ChatPanel({
  customer,
  staffId,
  classification,
  analyzing,
  onClassifyConversation,
}: {
  customer: Customers;
  staffId: string;
  classification?: ConversationClassification;
  analyzing: boolean;
  onClassifyConversation: (conversationId: string, messages: ClassifiableMessage[]) => Promise<void>;
}) {
  const conversationId = customer.auth_user_id ?? null;
  const { messages, loading, error, send, sendWithAttachment, markAsRead } = useChat({
    conversationId,
    senderId: staffId,
    senderRole: "agent",
  });

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Live update for the open chat: when a new message arrives, re-classify immediately.
  // (The bulk classifier handles all the other conversations in the background.)
  useEffect(() => {
    if (!conversationId || loading) return;
    const real = messages.filter((m) => !m.id.startsWith("optimistic-"));
    onClassifyConversation(conversationId, real as unknown as ClassifiableMessage[]);
  }, [conversationId, loading, messages, onClassifyConversation]);

  function handleSend() {
    if (!input.trim()) return;
    send(input.trim());
    setInput("");
  }

  async function handleAttachmentUpload(file: File) {
    const { createClient } = await import("@/app/(crbc)/library/supabase/client");
    const supabase = createClient();

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `chat/${conversationId}/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from("chat-attachments")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      return;
    }

    const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(data.path);
    const isImage = file.type.startsWith("image/");

    await sendWithAttachment(input.trim() || (isImage ? "📷 Image" : "📎 File"), {
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
    e.target.value = ""; // allow re-selecting the same file
  }

  const unreadCount = messages.filter(
    (m) => m.sender_role === "customer" && !m.read_at && !m.id.startsWith("optimistic-")
  ).length;

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground/30">
        <p className="text-sm">This customer has no portal account — chat unavailable.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header: conversation-level ML classification + mark as read */}
      <div className="px-5 py-2.5 border-b border-foreground/10 flex items-center justify-between shrink-0">
        <div className="flex-1 min-w-0" />
        <div className="flex items-center gap-3">
          <ClassificationBadge
            classification={classification}
            analyzing={analyzing}
            showConfidence
            size="md"
          />
          {unreadCount > 0 && (
            <button
              onClick={markAsRead}
              className="px-2.5 py-1 text-xs font-medium text-foreground/70 bg-foreground/5 hover:bg-foreground/10 rounded-lg transition-colors flex items-center gap-1.5"
              title="Mark as read"
            >
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
              Mark as read
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-5 py-4 space-y-3">
        {loading && (
          <div className="flex justify-center">
            <span className="text-[11px] text-foreground/40 bg-foreground/5 px-3 py-1 rounded-full">Loading messages…</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex justify-center">
            <span className="text-[11px] text-foreground/40 bg-foreground/5 px-3 py-1 rounded-full">
              No messages yet. Send the first message to start the conversation.
            </span>
          </div>
        )}

        {messages.map((msg) => {
          const isAgent = msg.sender_role === "agent";
          const isOptimistic = msg.id.startsWith("optimistic-");
          const isRead = msg.read_at && !isOptimistic;
          return (
            <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isAgent
                    ? `bg-accent text-white rounded-br-sm ${isOptimistic ? "opacity-60" : ""}`
                    : "bg-foreground/8 text-foreground rounded-bl-sm"
                }`}
              >
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
                          style={{ width: "auto", height: "auto", maxHeight: "200px" }}
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
                        <span className="truncate max-w-37.5">{msg.attachment.name}</span>
                        <span className="text-white/50">
                          {(msg.attachment.size / 1024).toFixed(1)} KB
                        </span>
                      </a>
                    )}
                  </div>
                )}

                <p>{msg.text}</p>

                <div className="flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] ${isAgent ? "text-white/60" : "text-foreground/40"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {isAgent && !isOptimistic && (
                    <span className={`text-[10px] ${isRead ? "text-emerald-400" : "text-white/50"}`}>
                      {isRead ? <CheckCheck size={10} /> : <Check size={10} />}
                    </span>
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

      {/* Composer */}
      <div className="px-4 py-3 border-t border-foreground/10 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <label
            className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer shrink-0"
            title="Attach file"
          >
            <Paperclip size={16} className="text-foreground/60" />
            <input
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileSelect}
              className="sr-only"
              aria-label="Attach file"
            />
          </label>
        </div>
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a reply… (Enter to send)"
            rows={2}
            className="flex-1 resize-none px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded-xl outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 placeholder:text-foreground/30"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                            */
/* -------------------------------------------------------------------------- */

export function CustomerCommunicationClient({ staffId, customers }: Props) {
  const [search, setSearch] = useState("");
  // Start with no chat open. The list is sorted by latest activity, so
  // defaulting to customers[0] (unsorted) opened a random row (e.g. #3).
  const [selected, setSelected] = useState<Customers | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterLabel, setFilterLabel] = useState<FilterLabel>("all");
  const [conversationClassifications, setConversationClassifications] =
    useState<Record<string, ConversationClassification>>({});
  const [classifyingConversations, setClassifyingConversations] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  // Latest customer message time per conversation (from realtime), used to re-sort the list
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({});

  // Refs keep the latest values so callbacks stay stable (no stale closures / effect loops)
  const classificationsRef = useRef<Record<string, ConversationClassification>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);
  const bulkRunningRef = useRef(false);
  const customersRef = useRef(customers);

  // Keep the ref in sync inside an effect (refs must not be written during render)
  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  /* ---------------------------- persistence ------------------------------ */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, ConversationClassification>;
        classificationsRef.current = { ...parsed, ...classificationsRef.current };
        setConversationClassifications(classificationsRef.current); // counts show instantly from cache
      }
    } catch {
      /* ignore corrupted storage */
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationClassifications));
    } catch {
      /* storage full or unavailable */
    }
  }, [conversationClassifications]);

  const saveClassification = useCallback((c: ConversationClassification) => {
    classificationsRef.current = { ...classificationsRef.current, [c.conversationId]: c };
    setConversationClassifications(classificationsRef.current);
  }, []);

  /* ------------------------- classification core ------------------------- */

  /** Classify one conversation from already-joined text. Skips if unchanged today. */
  const classifyText = useCallback(
    async (conversationId: string, text: string, count: number) => {
      if (!conversationId || inFlightRef.current.has(conversationId)) return;

      const today = getPHTDate();
      const existing = classificationsRef.current[conversationId];
      if (existing && existing.date === today && existing.messageCount === count) return;

      if (!text.trim()) {
        saveClassification({
          conversationId,
          date: today,
          label: null,
          confidence: 0,
          scores: {},
          messageCount: 0,
          classifiedAt: new Date().toISOString(),
        });
        return;
      }

      inFlightRef.current.add(conversationId);
      setClassifyingConversations((prev) => new Set(prev).add(conversationId));

      try {
        const res = await fetch(ML_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        if (!res.ok) throw new Error(`ML API responded with ${res.status}`);
        const data: MLResponse = await res.json();

        saveClassification({
          conversationId,
          date: today,
          label: data.label,
          confidence: data.confidence,
          scores: data.scores,
          messageCount: count,
          classifiedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Conversation classification failed:", e);
      } finally {
        inFlightRef.current.delete(conversationId);
        setClassifyingConversations((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
      }
    },
    [saveClassification]
  );

  /** Used by the open ChatPanel (it already has the messages in memory). */
  const classifyConversation = useCallback(
    async (conversationId: string, messages: ClassifiableMessage[]) => {
      const { text, count } = buildConversationText(messages);
      await classifyText(conversationId, text, count);
    },
    [classifyText]
  );

  /**
   * Classify EVERY conversation without opening it:
   * one query for today's (PHT) customer messages across all customers,
   * group by conversation, then call the ML API with limited concurrency.
   */
  const runBulkClassification = useCallback(async () => {
    if (bulkRunningRef.current) return;

    const ids = customersRef.current
      .map((c) => c.auth_user_id)
      .filter((id): id is string => !!id);
    if (ids.length === 0) return;

    bulkRunningRef.current = true;
    try {
      const today = getPHTDate();
      const grouped = await fetchTodaysCustomerMessages(ids);

      // Only conversations that are new / changed since the last classification
      const jobs = ids
        .map((id) => ({ id, ...buildConversationText(grouped.get(id) ?? []) }))
        .filter((job) => {
          const existing = classificationsRef.current[job.id];
          return !(existing && existing.date === today && existing.messageCount === job.count);
        });

      if (jobs.length === 0) return;

      setBulkProgress({ done: 0, total: jobs.length });
      let cursor = 0;
      let done = 0;
      const workers = Array.from({ length: Math.min(BULK_CONCURRENCY, jobs.length) }, async () => {
        while (cursor < jobs.length) {
          const job = jobs[cursor++];
          await classifyText(job.id, job.text, job.count);
          done++;
          setBulkProgress({ done, total: jobs.length });
        }
      });
      await Promise.all(workers);
    } catch (e) {
      console.error("Bulk classification failed:", e);
    } finally {
      bulkRunningRef.current = false;
      setBulkProgress(null);
    }
  }, [classifyText]);

  /** Re-fetch one conversation's messages for today and classify it. */
  const classifyConversationById = useCallback(
    async (conversationId: string) => {
      try {
        const grouped = await fetchTodaysCustomerMessages([conversationId]);
        const { text, count } = buildConversationText(grouped.get(conversationId) ?? []);
        await classifyText(conversationId, text, count);
      } catch (e) {
        console.error("Realtime classification failed:", e);
      }
    },
    [classifyText]
  );

  // Safety net: run on route load, every 30s, and when the tab becomes visible again
  // (covers the 12 AM PHT rollover and any missed realtime events)
  useEffect(() => {
    runBulkClassification();
    const timer = setInterval(runBulkClassification, BULK_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") runBulkClassification();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runBulkClassification]);

  // Realtime: the moment a customer sends a message (in ANY conversation), re-classify it.
  // Needs Realtime enabled for the messages table in Supabase.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    // Debounced so a burst of messages causes one ML call; waits if one is already running
    const schedule = (conversationId: string, delay: number) => {
      const existing = timers.get(conversationId);
      if (existing) clearTimeout(existing);
      timers.set(
        conversationId,
        setTimeout(() => {
          timers.delete(conversationId);
          if (inFlightRef.current.has(conversationId)) {
            schedule(conversationId, 1500);
            return;
          }
          void classifyConversationById(conversationId);
        }, delay)
      );
    };

    (async () => {
      const { createClient } = await import("@/app/(crbc)/library/supabase/client");
      if (cancelled) return;
      const supabase = createClient();

      const channel = supabase
        .channel("crbc-customer-messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: MESSAGES_TABLE },
          (payload) => {
            const row = payload.new as MessageRow;
            if (row.sender_role !== "customer") return;

            const conversationId = row[CONVERSATION_COLUMN] as string | undefined;
            if (!conversationId) return;
            if (!customersRef.current.some((c) => c.auth_user_id === conversationId)) return;

            setLastActivity((prev) => ({ ...prev, [conversationId]: row.created_at }));
            schedule(conversationId, 600);
          }
        )
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      timers.forEach((t) => clearTimeout(t));
    };
  }, [classifyConversationById]);

  /* ------------------------------ derived -------------------------------- */

  const counts = useMemo(() => {
    const result: Record<FilterLabel, number> = {
      all: customers.length,
      urgent: 0,
      not_urgent: 0,
      spam: 0,
      uncertain: 0,
    };
    for (const c of customers) {
      const label = conversationClassifications[c.auth_user_id ?? ""]?.label;
      if (label) result[label]++;
    }
    return result;
  }, [customers, conversationClassifications]);

  const filtered = useMemo(() => {
    let result = customers
      .filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.full_name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          c.customer_id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const activity = (c: Customers) =>
          new Date(lastActivity[c.auth_user_id ?? ""] ?? c.latest_message_at ?? c.updated_at ?? 0).getTime();
        return activity(b) - activity(a);
      });

    if (filterLabel !== "all") {
      result = result.filter(
        (c) => conversationClassifications[c.auth_user_id ?? ""]?.label === filterLabel
      );
    }

    return result;
  }, [customers, search, filterLabel, conversationClassifications, lastActivity]);

  const selectedConvId = selected?.auth_user_id ?? "";

  const filterTabs: Array<{ value: FilterLabel; label: string; icon: React.ReactNode }> = [
    { value: "all", label: "All", icon: null },
    { value: "urgent", label: "Urgent", icon: <Zap size={10} className="text-red-500" /> },
    { value: "not_urgent", label: "Not Urgent", icon: <Shield size={10} className="text-emerald-500" /> },
    { value: "spam", label: "Spam", icon: <AlertTriangle size={10} className="text-amber-500" /> },
    { value: "uncertain", label: "Uncertain", icon: <HelpCircle size={10} className="text-violet-500" /> },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden">
      {/* Conversation list */}
      <div
        className={`
        fixed inset-y-0 left-0 z-40 w-80 bg-background border-r border-foreground/10 flex flex-col
        transition-transform duration-200
        md:static md:translate-x-0 md:z-auto
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        {/* Search */}
        <div className="px-4 py-3 border-b border-foreground/10 flex items-center gap-2">
          <button className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50 placeholder:text-foreground/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs with live counts */}
        <div className="px-4 py-2 border-b border-foreground/10">
          <div className="flex flex-wrap gap-1">
            {filterTabs.map(({ value, label, icon }) => {
              const active = filterLabel === value;
              return (
                <button
                  key={value}
                  onClick={() => setFilterLabel(value)}
                  className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-accent text-white"
                      : "text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
                  }`}
                >
                  {icon}
                  {label}
                  <span
                    className={`min-w-4 px-1 rounded-full text-[10px] leading-4 text-center ${
                      active ? "bg-white/25 text-white" : "bg-foreground/10 text-foreground/60"
                    }`}
                  >
                    {counts[value]}
                  </span>
                </button>
              );
            })}
          </div>
          {bulkProgress && (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-foreground/40">
              <Loader2 size={10} className="animate-spin" />
              Analyzing conversations… {bulkProgress.done}/{bulkProgress.total}
            </p>
          )}
        </div>

        <div className="px-4 py-2 border-b border-foreground/10">
          <p className="text-[11px] text-foreground/40 font-semibold uppercase tracking-widest">
            {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none divide-y divide-foreground/5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-foreground/30 gap-2">
              <Inbox size={24} />
              <p className="text-sm">No customers found</p>
            </div>
          ) : (
            filtered.map((c) => {
              const convId = c.auth_user_id ?? "";
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelected(c);
                    setSidebarOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3.5 flex gap-3 items-start transition-colors hover:bg-foreground/5 ${
                    selected?.id === c.id ? "bg-foreground/8 border-l-2 border-l-accent" : ""
                  }`}
                >
                  <Avatar name={c.full_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{c.full_name}</p>
                      {!!c.unread_count && c.unread_count > 0 && (
                        <span className="flex items-center justify-center min-w-4.5 h-5 px-1.5 text-[10px] font-medium text-white bg-red-500 rounded-full shrink-0">
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <p className="text-xs text-foreground/50 truncate">{c.email ?? c.customer_id}</p>
                      {convId && (
                        <ClassificationBadge
                          classification={conversationClassifications[convId]}
                          analyzing={classifyingConversations.has(convId)}
                        />
                      )}
                    </div>
                    <p className="text-[11px] text-foreground/30 mt-0.5 font-mono">{c.customer_id}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="px-5 py-3.5 border-b border-foreground/10 flex items-center gap-3 shrink-0">
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-foreground/8"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={18} />
              </button>
              <Avatar name={selected.full_name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{selected.full_name}</p>
                <p className="text-xs text-foreground/50">
                  {selected.email ?? ""} · {selected.customer_id}
                </p>
              </div>
            </div>

            <ChatPanel
              key={selected.id}
              customer={selected}
              staffId={staffId}
              classification={conversationClassifications[selectedConvId]}
              analyzing={classifyingConversations.has(selectedConvId)}
              onClassifyConversation={classifyConversation}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-foreground/30 gap-3">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-foreground/8 text-foreground/60"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <MessageSquare size={32} />
            <p className="text-sm">Select a customer to start chatting</p>
          </div>
        )}
      </div>

      {/* Right: customer info panel */}
      {selected && (
        <div className="hidden lg:flex w-64 border-l border-foreground/10 flex-col gap-4 p-4 overflow-y-auto scrollbar-none shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40">Customer Info</p>
          <div className="flex flex-col items-center gap-2 py-2">
            <Avatar name={selected.full_name} />
            <p className="text-sm font-semibold text-foreground text-center">{selected.full_name}</p>
            <p className="font-mono text-[11px] text-foreground/40">{selected.customer_id}</p>
          </div>
          <div className="space-y-2 border-t border-foreground/8 pt-3">
            {[
              { label: "Email", value: selected.email ?? "—" },
              { label: "City", value: selected.city ?? "—" },
              { label: "Province", value: selected.province ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-foreground/40 uppercase tracking-wide">{label}</p>
                <p className="text-xs text-foreground mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-foreground/8 pt-3">
            <p className="text-[10px] text-foreground/40 uppercase tracking-wide mb-1">Portal Account</p>
            {selected.auth_user_id ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-foreground/40">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/20" /> No account
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}