"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
    Send, 
    MessageSquare, 
    Building2, 
    User, 
    FileText, 
    Clock, 
    Loader2, 
    RefreshCw,
    X,
    Sparkles,
    History,
    Trash2,
    CheckCheck,
    Mail,
    Phone,
    MapPin,
    Tag,
    ChevronDown,
    ArrowDown,
    Package,
    Shield,
    Info,
    CornerDownLeft
} from "lucide-react";
import { Supplier } from "../../types";
import { supabase } from "../../../../lib/services/client/supabase";
import { user } from "../../../../lib/services/Class/user";
import { toast } from "sonner";
import Portal from "../../../../components/client/Portal";

interface SupplierMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: Supplier | null;
    onMessagesRead?: (supplierId: number) => void;
}

const QUICK_PROMPTS = [
    "Inquire about PO delivery schedule",
    "Request updated product pricing & catalog",
    "Confirm receipt of latest invoice",
    "Request shipment tracking details",
    "Inquire about bulk purchase discount"
];

export function SupplierMessageModal({
    isOpen,
    onClose,
    supplier,
    onMessagesRead,
}: SupplierMessageModalProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [selectedPo, setSelectedPo] = useState<string>("");
    const [visibleMessageLimit, setVisibleMessageLimit] = useState<number>(25);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [showSupplierDetails, setShowSupplierDetails] = useState(false);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const currentUserName = user.getName() || "Procurement Officer";
    const currentUserEmail = user.getEmail();
    const currentUserRole = user.getRole();
    const currentUserId = user.getUserId();

    const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(supplier);

    useEffect(() => {
        setActiveSupplier(supplier);
        if (supplier?.name) {
            const cleanName = supplier.name.split(" - ")[0].trim();
            supabase
                .from("suppliers")
                .select("*")
                .or(`name.ilike.%${cleanName}%,name.ilike.%${supplier.name.trim()}%`)
                .limit(1)
                .maybeSingle()
                .then(({ data }) => {
                    if (data && data.id) {
                        setActiveSupplier(data as Supplier);
                    }
                });
        }
    }, [supplier?.id, supplier?.name, isOpen]);

    // Reset visible limit on supplier or modal open change
    useEffect(() => {
        setVisibleMessageLimit(25);
        setSelectedPo("");
        setInputText("");
        setShowSupplierDetails(false);
    }, [activeSupplier?.id, supplier?.id, isOpen]);

    const hasMoreMessages = messages.length > visibleMessageLimit;
    const hiddenCount = Math.max(0, messages.length - visibleMessageLimit);

    const displayedMessages = useMemo(() => {
        if (messages.length <= visibleMessageLimit) {
            return messages;
        }
        return messages.slice(messages.length - visibleMessageLimit);
    }, [messages, visibleMessageLimit]);

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
        setShowScrollBottom(!isNearBottom);
    };

    // Filter messages to private thread between current logged-in staff and supplier
    const isMessageInMyThread = (msg: any, allMsgs?: any[]) => {
        if (!msg) return false;
        const myId = currentUserId?.trim();
        const myEmail = currentUserEmail?.toLowerCase().trim();
        const myName = currentUserName?.toLowerCase().trim();

        if (msg.sender_type === "internal") {
            return Boolean(
                (myId && msg.sender_id === myId) ||
                (myEmail && msg.sender_email?.toLowerCase().trim() === myEmail) ||
                (myName && msg.sender_name?.toLowerCase().trim() === myName)
            );
        }

        if (msg.sender_type === "supplier") {
            if (Array.isArray(msg.attachments)) {
                const target = msg.attachments.find(
                    (a: any) => a && (a.type === "target_recipient" || a.recipient_id || a.recipient_email || a.staff_id || a.staff_email)
                );
                if (target) {
                    const targetId = target.recipient_id || target.staff_id;
                    const targetEmail = (target.recipient_email || target.staff_email || "").toLowerCase().trim();
                    const targetName = (target.recipient_name || target.staff_name || "").toLowerCase().trim();

                    return Boolean(
                        (myId && targetId === myId) ||
                        (myEmail && targetEmail === myEmail) ||
                        (myName && targetName === myName)
                    );
                }
            }

            // Fallback for legacy messages
            const pool = allMsgs || messages;
            if (pool && pool.length > 0) {
                const internalSenders = pool
                    .filter((m: any) => m.sender_type === "internal")
                    .map((m: any) => m.sender_email?.toLowerCase().trim() || m.sender_name?.toLowerCase().trim());
                const uniqueInternalSenders = Array.from(new Set(internalSenders));
                if (uniqueInternalSenders.length <= 1) {
                    if (uniqueInternalSenders.length === 0) return true;
                    const sender = uniqueInternalSenders[0];
                    return Boolean((myEmail && sender === myEmail) || (myName && sender === myName));
                }
            }
            return false;
        }

        return false;
    };

    // Load messages & purchase orders for this supplier
    const fetchChatData = async (showLoading = true) => {
        const currentSupp = activeSupplier || supplier;
        if (!currentSupp || !currentSupp.id) return;
        if (showLoading) setIsLoading(true);

        try {
            // Fetch POs for tagging
            const { data: pos } = await supabase
                .from("purchase_orders")
                .select("id, po_number, status, total_amount")
                .eq("supplier_id", currentSupp.id)
                .order("created_at", { ascending: false });

            setPurchaseOrders(pos || []);

            // Fetch message history
            const { data: msgs, error } = await supabase
                .from("messages")
                .select("*")
                .eq("supplier_id", currentSupp.id)
                .order("created_at", { ascending: true });

            if (!error && msgs) {
                const threadMsgs = msgs.filter((m: any) => isMessageInMyThread(m, msgs));
                setMessages(threadMsgs);

                // Automatically mark unread messages from this supplier in this thread as read
                const unreadInThread = threadMsgs.filter((m: any) => m.sender_type === "supplier" && !m.is_read);
                if (unreadInThread.length > 0) {
                    onMessagesRead?.(currentSupp.id);
                    supabase
                        .from("messages")
                        .update({ is_read: true })
                        .in("id", unreadInThread.map((m: any) => m.id))
                        .then();
                }
            } else {
                setMessages([]);
            }
        } catch (err) {
            console.error("Error loading chat history:", err);
            setMessages([]);
        } finally {
            if (showLoading) setIsLoading(false);
            setTimeout(() => scrollToBottom("auto"), 100);
        }
    };

    useEffect(() => {
        const currentSupp = activeSupplier || supplier;
        if (!isOpen || !currentSupp || !currentSupp.id) return;

        fetchChatData(true);

        // Realtime subscription (INSERT, UPDATE with filter, and unfiltered DELETE)
        const channel = supabase
            .channel(`supplier_chat_${currentSupp.id}_${Date.now()}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `supplier_id=eq.${currentSupp.id}`,
                },
                (payload) => {
                    if (payload.new) {
                        const newMsg = payload.new;
                        if (!isMessageInMyThread(newMsg)) return;

                        if (newMsg.sender_type === "supplier" && !newMsg.is_read) {
                            onMessagesRead?.(currentSupp.id);
                            supabase
                                .from("messages")
                                .update({ is_read: true })
                                .eq("id", newMsg.id)
                                .then();
                        }
                        setMessages((prev) => {
                            if (prev.some((m) => m.id === newMsg.id)) return prev;
                            return [...prev, { ...newMsg, is_read: true }];
                        });
                        setTimeout(() => scrollToBottom("smooth"), 50);
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "messages",
                    filter: `supplier_id=eq.${currentSupp.id}`,
                },
                (payload) => {
                    if (payload.new) {
                        setMessages((prev) =>
                            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
                        );
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "messages",
                },
                (payload) => {
                    if (payload.old && payload.old.id) {
                        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, activeSupplier?.id, supplier?.id, currentUserEmail, currentUserId]);

    // Send Message
    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const currentSupp = activeSupplier || supplier;
        if (!inputText.trim() || !currentSupp || !currentSupp.id || isSending) return;

        setIsSending(true);
        const text = inputText.trim();
        setInputText("");

        const tempId = `temp_${Date.now()}`;
        const recipientMetadata = {
            type: "target_recipient",
            recipient_id: currentSupp.id,
            recipient_name: currentSupp.name,
            recipient_email: currentSupp.email,
            staff_id: currentUserId || null,
            staff_email: currentUserEmail || null,
            staff_name: currentUserName || null,
            staff_role: currentUserRole || null,
        };

        const newMsg = {
            id: tempId,
            supplier_id: currentSupp.id,
            supplier_name: currentSupp.name,
            purchase_order_id: selectedPo || null,
            sender_type: "internal",
            sender_id: currentUserId || null,
            sender_name: currentUserName || "Supply Chain Staff",
            sender_email: currentUserEmail || "staff@airship.com",
            sender_role: currentUserRole || "Purchase Officer",
            role: currentUserRole || "Purchase Officer",
            message: text,
            attachments: [recipientMetadata],
            is_read: false,
            created_at: new Date().toISOString(),
        };

        // Optimistically render
        setMessages((prev) => [...prev, newMsg]);
        setTimeout(() => scrollToBottom("smooth"), 50);

        try {
            let data: any = null;
            let error: any = null;

            // Attempt direct Supabase insert first
            const directRes = await supabase
                .from("messages")
                .insert({
                    supplier_id: newMsg.supplier_id,
                    purchase_order_id: newMsg.purchase_order_id,
                    sender_type: newMsg.sender_type,
                    sender_id: newMsg.sender_id,
                    sender_name: newMsg.sender_name,
                    sender_email: newMsg.sender_email,
                    sender_role: newMsg.sender_role,
                    role: newMsg.role,
                    message: newMsg.message,
                    attachments: newMsg.attachments,
                    is_read: false,
                    created_at: newMsg.created_at,
                })
                .select()
                .single();

            if (directRes.error) {
                // If RLS or client error, fallback seamlessly to backend API
                console.warn("Direct Supabase insert failed, attempting /api/messages fallback:", directRes.error);
                const apiRes = await fetch("/api/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newMsg),
                });
                const apiJson = await apiRes.json();
                if (!apiJson.success) {
                    throw new Error(apiJson.error || directRes.error.message);
                }
                data = apiJson.data;
            } else {
                data = directRes.data;
            }

            if (data) {
                setMessages((prev) => 
                    prev.map((m) => (m.id === tempId ? data : m))
                );
            }
        } catch (err: any) {
            console.error("Error sending message:", err);
            toast.error("Failed to send message: " + (err.message || "Network error"));
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
        } finally {
            setIsSending(false);
            setTimeout(() => scrollToBottom("smooth"), 100);
        }
    };

    // Keyboard shortcut for Enter to send
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Delete message
    const handleDeleteMessage = async (msgId: string) => {
        setDeletingId(msgId);
        const previousMessages = messages;
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        try {
            const { error } = await supabase
                .from("messages")
                .delete()
                .eq("id", msgId);
            if (error) {
                // Try API fallback
                const apiRes = await fetch(`/api/messages?id=${encodeURIComponent(msgId)}`, {
                    method: "DELETE",
                });
                const apiJson = await apiRes.json();
                if (!apiJson.success) throw new Error(apiJson.error || error.message);
            }
            toast.success("Message deleted");
        } catch (err: any) {
            console.error("Failed to delete message:", err);
            toast.error("Failed to delete message");
            setMessages(previousMessages);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (isoString?: string) => {
        if (!isoString) return "";
        const d = new Date(isoString);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return "Today";
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return "";
        return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const getRoleBadge = (role?: string, isMe?: boolean) => {
        const r = (role || "").toUpperCase();
        if (isMe) {
            return {
                label: "You (" + (currentUserRole || role || "Staff") + ")",
                className: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/25",
                avatarBg: "bg-pink-500 text-white"
            };
        }
        if (r.includes("EXEC")) {
            return {
                label: "Executive",
                className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25",
                avatarBg: "bg-amber-500 text-white"
            };
        }
        if (r.includes("ADMIN")) {
            return {
                label: "Admin",
                className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25",
                avatarBg: "bg-indigo-500 text-white"
            };
        }
        if (r.includes("PURCHASE OFFICER") || r.includes("PURCHASE_OFFICER") || r.includes("MANAGER")) {
            return {
                label: "Purchase Officer",
                className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25",
                avatarBg: "bg-purple-500 text-white"
            };
        }
        if (r.includes("SUPPLIER")) {
            return {
                label: "Supplier",
                className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
                avatarBg: "bg-emerald-600 text-white"
            };
        }
        return {
            label: role || "Staff",
            className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25",
            avatarBg: "bg-blue-500 text-white"
        };
    };

    const getInitials = (name?: string) => {
        if (!name) return "SC";
        const parts = name.trim().split(" ");
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    if (!isOpen || !supplier) return null;
    const displaySupplier = activeSupplier || supplier;

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
                {/* Backdrop */}
                <div 
                    className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md transition-opacity"
                    onClick={onClose}
                />

                {/* Main Modal Shell */}
                <div className="relative bg-[#f0f3f8] dark:bg-[#1e2130] rounded-[28px] max-w-4xl w-full h-[700px] max-h-[94vh] flex flex-col border border-slate-200/80 dark:border-white/[0.12] shadow-none z-10 overflow-hidden">
                    
                    {/* Header */}
                    <div className="p-4 sm:px-6 bg-[#ebf0f7]/95 dark:bg-[#1e2130]/95 border-b border-slate-200/60 dark:border-white/[0.08] flex items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#25283b] text-pink-600 dark:text-pink-400 border border-pink-500/30 flex items-center justify-center shrink-0 shadow-[4px_4px_10px_#c2cad6,-4px_-4px_10px_#ffffff] dark:shadow-[4px_4px_10px_#11131c,-3px_-3px_8px_#31354e]">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <span 
                                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#ebf0f7] dark:border-[#1e2130] ${
                                        displaySupplier.is_active ? "bg-emerald-500" : "bg-slate-400"
                                    }`} 
                                    title={displaySupplier.is_active ? "Active Supplier" : "Inactive Supplier"}
                                />
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg truncate tracking-tight">
                                        {displaySupplier.name}
                                    </h3>
                                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/90 dark:bg-[#25283b] text-slate-600 dark:text-slate-200 border border-slate-300/60 dark:border-white/[0.08]">
                                        SUP-{String(displaySupplier.id).padStart(3, "0")}
                                    </span>
                                    {displaySupplier.category && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                            {displaySupplier.category}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium flex-wrap">
                                    {displaySupplier.contact_person && (
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3 text-pink-500/70 shrink-0" />
                                            <span className="truncate">{displaySupplier.contact_person}</span>
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-pink-500/70 shrink-0" />
                                        <span className="truncate">{displaySupplier.email}</span>
                                    </span>
                                    {displaySupplier.phone && (
                                        <span className="hidden md:flex items-center gap-1">
                                            <Phone className="w-3 h-3 text-pink-500/70 shrink-0" />
                                            <span>{displaySupplier.phone}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Toggle Supplier Info Card */}
                            <button
                                type="button"
                                onClick={() => setShowSupplierDetails((prev) => !prev)}
                                title="Toggle supplier details"
                                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                                    showSupplierDetails
                                        ? "bg-pink-500 text-white border-pink-600 shadow-[0_2px_8px_rgba(236,72,153,0.35)]"
                                        : "bg-[#f0f3f8] dark:bg-[#25283b] text-slate-500 hover:text-pink-600 dark:hover:text-pink-400 border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_7px_#11131c,-2px_-2px_6px_#31354e]"
                                }`}
                            >
                                <Info className="w-4 h-4" />
                            </button>

                            {/* Refresh Button */}
                            <button
                                type="button"
                                onClick={() => fetchChatData(false)}
                                title="Refresh conversation"
                                className="w-9 h-9 rounded-xl bg-[#f0f3f8] dark:bg-[#25283b] text-slate-500 hover:text-pink-600 dark:hover:text-pink-400 flex items-center justify-center border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_7px_#11131c,-2px_-2px_6px_#31354e] active:scale-95 transition-all cursor-pointer"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-pink-500" : ""}`} />
                            </button>

                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={onClose}
                                title="Close modal"
                                className="w-9 h-9 rounded-xl bg-[#f0f3f8] dark:bg-[#25283b] text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_7px_#11131c,-2px_-2px_6px_#31354e] active:scale-95 transition-all cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Expandable Supplier Quick Info Drawer */}
                    {showSupplierDetails && (
                        <div className="p-3.5 sm:px-6 bg-[#ebf0f7]/90 dark:bg-[#151722]/95 border-b border-slate-200/60 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in slide-in-from-top-2 duration-150">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <MapPin className="w-4 h-4 text-pink-500 shrink-0" />
                                <span className="truncate">{displaySupplier.location || "Location not set"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Package className="w-4 h-4 text-pink-500 shrink-0" />
                                <span className="truncate">{displaySupplier.products || "No product catalog listed"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Shield className="w-4 h-4 text-pink-500 shrink-0" />
                                <span>Status: <b>{displaySupplier.is_active ? "Verified Active" : "Inactive"}</b></span>
                            </div>
                        </div>
                    )}

                    {/* PO Selector Subheader */}
                    {purchaseOrders.length > 0 && (
                        <div className="px-4 sm:px-6 py-2 bg-[#ebf0f7]/70 dark:bg-[#151722]/80 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center gap-2 text-xs">
                            <Tag className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                            <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider shrink-0">
                                Reference PO:
                            </span>
                            <div className="relative flex-1 max-w-sm">
                                <select
                                    value={selectedPo}
                                    onChange={(e) => setSelectedPo(e.target.value)}
                                    className="w-full py-1.5 pl-2.5 pr-7 bg-[#f0f3f8] dark:bg-[#1e2130] border border-white/80 dark:border-white/[0.08] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)] dark:shadow-[inset_2px_2px_5px_#0b0d13,inset_-2px_-2px_5px_#25293d] focus:outline-hidden appearance-none cursor-pointer"
                                >
                                    <option value="" className="dark:bg-[#1e2130] dark:text-slate-300">No PO reference (General discussion)</option>
                                    {purchaseOrders.map((po) => (
                                        <option key={po.id} value={po.po_number} className="dark:bg-[#1e2130] dark:text-slate-200">
                                            PO-{po.po_number} • {po.status} • ${(po.total_amount || 0).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            {selectedPo && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedPo("")}
                                    className="text-[10px] text-pink-600 dark:text-pink-400 font-bold hover:underline cursor-pointer ml-1"
                                >
                                    Clear tag
                                </button>
                            )}
                        </div>
                    )}

                    {/* Messages Body Container */}
                    <div 
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="relative flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#f0f3f8]/50 dark:bg-[#161824]"
                    >
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                                <p className="text-xs font-bold text-slate-400">Loading conversation history...</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                                <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#1e2130] text-pink-500 flex items-center justify-center shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_#0b0d13,inset_-2px_-2px_5px_#25293d]">
                                    <MessageSquare className="w-8 h-8" />
                                </div>
                                <div className="max-w-md">
                                    <h4 className="font-black text-slate-800 dark:text-slate-100 text-base mb-1">
                                        No messages with {supplier.name} yet
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Send a direct message regarding purchase orders, deliveries, specifications, or contracts.
                                    </p>
                                </div>

                                {/* Suggested Quick Prompts */}
                                <div className="w-full max-w-lg pt-2">
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                                        Suggested Inquiries:
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                                        {QUICK_PROMPTS.map((prompt, pIdx) => (
                                            <button
                                                key={pIdx}
                                                type="button"
                                                onClick={() => {
                                                    setInputText(prompt);
                                                    textareaRef.current?.focus();
                                                }}
                                                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[#ebf0f7] dark:bg-[#25283b] hover:bg-white dark:hover:bg-[#2d3148] text-slate-700 dark:text-slate-200 border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.2),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_7px_#11131c,-2px_-2px_6px_#31354e] transition-all flex items-center gap-2 cursor-pointer text-left group"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-pink-500 shrink-0 group-hover:scale-110 transition-transform" />
                                                <span className="truncate">{prompt}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {hasMoreMessages && (
                                    <div className="flex justify-center pb-2 pt-1 sticky top-0 z-10">
                                        <button
                                            type="button"
                                            onClick={() => setVisibleMessageLimit((prev) => prev + 25)}
                                            className="px-4 py-1.5 rounded-full text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7]/90 dark:bg-[#25283b]/90 backdrop-blur-sm border border-pink-500/25 shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_7px_#11131c,-2px_-2px_6px_#31354e] hover:bg-white dark:hover:bg-[#2d3148] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <History className="w-3.5 h-3.5 text-pink-500" />
                                            <span>Load earlier messages ({hiddenCount} remaining)</span>
                                        </button>
                                    </div>
                                )}

                                {displayedMessages.map((msg, index) => {
                                    const isInternal = msg.sender_type === "internal";
                                    const isMyMessage = Boolean(
                                        (currentUserId && msg.sender_id === currentUserId) ||
                                        (currentUserEmail && msg.sender_email?.toLowerCase() === currentUserEmail.toLowerCase()) ||
                                        (currentUserName && msg.sender_name?.toLowerCase() === currentUserName.toLowerCase() && isInternal)
                                    );

                                    const showDate =
                                        index === 0 ||
                                        formatDate(msg.created_at) !== formatDate(displayedMessages[index - 1].created_at);
                                    
                                    const displayRole = msg.sender_role || msg.role || (isInternal ? "Staff" : "Supplier");
                                    const roleBadge = getRoleBadge(displayRole, isMyMessage);
                                    const senderDisplayName = isMyMessage 
                                        ? `You (${msg.sender_name || currentUserName})` 
                                        : msg.sender_name || (isInternal ? "Staff" : supplier.name);
                                    const senderInitials = getInitials(msg.sender_name || (isMyMessage ? currentUserName : supplier.name));

                                    return (
                                        <div key={msg.id || index} className="space-y-1.5 group/msg">
                                            {showDate && (
                                                <div className="flex items-center justify-center my-3">
                                                    <span className="px-3.5 py-1 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#151722] border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)] dark:shadow-[inset_2px_2px_4px_#0b0d13]">
                                                        {formatDate(msg.created_at)}
                                                    </span>
                                                </div>
                                            )}

                                            <div className={`flex items-start gap-2.5 ${isMyMessage ? "flex-row-reverse" : "flex-row"}`}>
                                                {/* Sender Avatar */}
                                                <div 
                                                    className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black shadow-xs ${
                                                        isMyMessage 
                                                            ? "bg-pink-500 text-white shadow-[0_2px_6px_rgba(236,72,153,0.3)]" 
                                                            : isInternal
                                                                ? `${roleBadge.avatarBg} shadow-xs`
                                                                : "bg-emerald-600 text-white shadow-xs"
                                                    }`}
                                                >
                                                    {senderInitials}
                                                </div>

                                                <div className={`flex flex-col max-w-[85%] sm:max-w-lg ${isMyMessage ? "items-end" : "items-start"}`}>
                                                    {/* Meta Info */}
                                                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-medium text-slate-400 flex-wrap">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                                            {senderDisplayName}
                                                        </span>
                                                        <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${roleBadge.className}`}>
                                                            {roleBadge.label}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{formatTime(msg.created_at)}</span>
                                                    </div>

                                                    {/* Message Bubble + Action Button */}
                                                    <div className={`relative flex items-center gap-2 group/bubble max-w-full ${isMyMessage ? "flex-row-reverse" : "flex-row"}`}>
                                                        <div
                                                            className={`rounded-2xl p-3.5 text-xs font-medium space-y-1.5 transition-all ${
                                                                isMyMessage
                                                                    ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-[0_3px_12px_rgba(236,72,153,0.3)] rounded-tr-xs"
                                                                    : isInternal
                                                                        ? "bg-[#edf2fb] dark:bg-[#1e2235] text-slate-800 dark:text-slate-100 border border-indigo-200/80 dark:border-indigo-900/60 shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_#11131c] rounded-tl-xs"
                                                                        : "bg-[#f0f3f8] dark:bg-[#25283b] text-slate-800 dark:text-slate-100 border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_#11131c,-2px_-2px_6px_#31354e] rounded-tl-xs"
                                                            }`}
                                                        >
                                                            {msg.purchase_order_id && (
                                                                <div className={`mb-1 px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                                                                    isMyMessage 
                                                                        ? "bg-white/20 text-white" 
                                                                        : isInternal
                                                                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                                                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                                                }`}>
                                                                    <FileText className="w-3 h-3" />
                                                                    <span>Ref: PO-{msg.purchase_order_id}</span>
                                                                </div>
                                                            )}
                                                            <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.message}</p>
                                                            
                                                            {/* Delivery receipt indicator */}
                                                            {isMyMessage && (
                                                                <div className="flex items-center justify-end gap-1 pt-0.5 text-[9px] text-white/80">
                                                                    <CheckCheck className="w-3 h-3" />
                                                                    <span>Sent</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Delete own message button on hover */}
                                                        {isMyMessage && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                disabled={deletingId === msg.id}
                                                                className="opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-[#f0f3f8] dark:bg-[#25283b] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_5px_#11131c] cursor-pointer shrink-0 active:scale-90"
                                                                title="Delete message"
                                                            >
                                                                {deletingId === msg.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                                                ) : (
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                        <div ref={messagesEndRef} />

                        {/* Floating Jump to Bottom Button */}
                        {showScrollBottom && (
                            <button
                                type="button"
                                onClick={() => scrollToBottom("smooth")}
                                className="fixed bottom-24 right-8 z-20 px-3 py-1.5 rounded-full bg-pink-500 text-white text-xs font-bold shadow-[0_4px_14px_rgba(236,72,153,0.4)] flex items-center gap-1.5 hover:bg-pink-600 active:scale-95 transition-all cursor-pointer animate-in fade-in"
                            >
                                <ArrowDown className="w-3.5 h-3.5" />
                                <span>Jump to latest</span>
                            </button>
                        )}
                    </div>

                    {/* Input Footer */}
                    <div className="p-3.5 sm:p-4 bg-[#ebf0f7] dark:bg-[#1e2130] border-t border-slate-200/60 dark:border-white/[0.08] shadow-sm">
                        <form 
                            onSubmit={handleSendMessage} 
                            className="flex items-end gap-2.5"
                        >
                            <div className="relative flex-1">
                                <textarea
                                    ref={textareaRef}
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={isSending}
                                    rows={1}
                                    placeholder={`Message ${supplier.name}... (Enter to send, Shift+Enter for newline)`}
                                    className="w-full py-2.5 pl-4 pr-10 bg-[#f0f3f8] dark:bg-[#151722] border border-white/80 dark:border-white/[0.08] rounded-2xl text-xs font-medium text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-pink-500/40 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_#0b0d13,inset_-2px_-2px_6px_#25293d] disabled:opacity-60 resize-none max-h-24 min-h-[42px]"
                                />
                                <div className="absolute right-3 bottom-2.5 text-slate-400 pointer-events-none">
                                    <CornerDownLeft className="w-3.5 h-3.5 opacity-50" />
                                </div>
                            </div>
                            
                            <button
                                type="submit"
                                disabled={isSending || !inputText.trim()}
                                className="h-[42px] px-5 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 active:scale-95 text-white text-xs font-bold shadow-[0_3px_10px_rgba(236,72,153,0.35)] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Sending</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Send</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
