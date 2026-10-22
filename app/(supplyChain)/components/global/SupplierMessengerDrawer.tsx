"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
    MessageSquare, 
    Send, 
    Search, 
    Building2, 
    User, 
    X, 
    ArrowLeft,
    FileText, 
    Clock, 
    Loader2, 
    CheckCheck,
    Minimize2,
    Maximize2,
    Sparkles,
    ShieldCheck,
    Trash2
} from "lucide-react";
import { supabase } from "../../lib/services/client/supabase";
import { user } from "../../lib/services/Class/user";
import { toast } from "sonner";
import Portal from "../client/Portal";
import { SearchableDropdown, SearchableDropdownOption } from "../ui/SearchableDropdown";
import { useConfirm } from "../ui/ConfirmModal";

interface SupplierMessengerDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    initialSupplierId?: number | null;
}

export function SupplierMessengerDrawer({
    isOpen,
    onClose,
    initialSupplierId,
}: SupplierMessengerDrawerProps) {
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [selectedPo, setSelectedPo] = useState<string>("");
    const [activeMobileView, setActiveMobileView] = useState<"list" | "chat">("list");

    const { confirm } = useConfirm();
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const currentUserName = user.getName() || "Procurement Staff";
    const currentUserEmail = user.getEmail();
    const currentUserRole = user.getRole();
    const currentUserId = user.getUserId();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load supplier list
    useEffect(() => {
        if (!isOpen) return;

        const loadSuppliers = async () => {
            setIsLoadingSuppliers(true);
            try {
                const { data, error } = await supabase
                    .from("suppliers")
                    .select("id, name, email, contact_person, category, is_active")
                    .order("name", { ascending: true });

                if (!error && data) {
                    setSuppliers(data);
                    if (initialSupplierId) {
                        const match = data.find((s) => s.id === initialSupplierId);
                        if (match) {
                            setSelectedSupplier(match);
                            setActiveMobileView("chat");
                        } else if (data.length > 0) {
                            setSelectedSupplier(data[0]);
                        }
                    } else if (data.length > 0 && !selectedSupplier) {
                        setSelectedSupplier(data[0]);
                    }
                }
            } catch (err) {
                console.error("Error loading suppliers for chat:", err);
            } finally {
                setIsLoadingSuppliers(false);
            }
        };

        loadSuppliers();
    }, [isOpen, initialSupplierId]);

    // Load messages when selected supplier changes
    useEffect(() => {
        if (!isOpen || !selectedSupplier) return;

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

        const loadChat = async () => {
            setIsLoadingMessages(true);
            try {
                // Fetch POs
                const { data: pos } = await supabase
                    .from("purchase_orders")
                    .select("id, po_number, status, total_amount")
                    .eq("supplier_id", selectedSupplier.id)
                    .order("created_at", { ascending: false });

                setPurchaseOrders(pos || []);

                // Fetch Messages
                const { data: msgs } = await supabase
                    .from("messages")
                    .select("*")
                    .eq("supplier_id", selectedSupplier.id)
                    .order("created_at", { ascending: true });

                if (msgs) {
                    const threadMsgs = msgs.filter((m: any) => isMessageInMyThread(m, msgs));
                    setMessages(threadMsgs);
                } else {
                    setMessages([]);
                }
            } catch (err) {
                console.error("Error loading chat:", err);
                setMessages([]);
            } finally {
                setIsLoadingMessages(false);
                setTimeout(scrollToBottom, 100);
            }
        };

        loadChat();

        // Subscribe to live messages
        const channel = supabase
            .channel(`dock_chat_${selectedSupplier.id}_${Date.now()}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `supplier_id=eq.${selectedSupplier.id}`,
                },
                (payload) => {
                    if (!payload.new?.id) return;
                    if (!isMessageInMyThread(payload.new)) return;

                    if (payload.new.sender_type === "supplier" && !payload.new.is_read) {
                        supabase
                            .from("messages")
                            .update({ is_read: true })
                            .eq("id", payload.new.id)
                            .then();
                    }
                    setMessages((prev) => {
                        if (prev.some((m) => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new];
                    });
                    setTimeout(scrollToBottom, 50);
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "messages",
                    filter: `supplier_id=eq.${selectedSupplier.id}`,
                },
                (payload) => {
                    if (!payload.new?.id) return;
                    setMessages((prev) =>
                        prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
                    );
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
                    if (!payload.old?.id) return;
                    setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, selectedSupplier, currentUserEmail, currentUserId]);

    // Send Message
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedSupplier) return;

        setIsSending(true);
        const text = inputText.trim();
        setInputText("");

        try {
            const recipientMetadata = {
                type: "target_recipient",
                recipient_id: selectedSupplier.id,
                recipient_name: selectedSupplier.name,
                recipient_email: selectedSupplier.email,
                staff_id: currentUserId || null,
                staff_email: currentUserEmail || null,
                staff_name: currentUserName || null,
                staff_role: currentUserRole || null,
            };

            const newMsg = {
                supplier_id: selectedSupplier.id,
                purchase_order_id: selectedPo || null,
                sender_type: "internal",
                sender_id: currentUserId || null,
                sender_name: currentUserName || "Supply Chain Staff",
                sender_email: currentUserEmail || "staff@airship.com",
                sender_role: currentUserRole || "Manager",
                role: currentUserRole || "Manager",
                message: text,
                is_read: false,
                attachments: [recipientMetadata],
                created_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from("messages")
                .insert(newMsg)
                .select()
                .single();

            if (error) {
                toast.error("Failed to send message: " + error.message);
            } else if (data) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === data.id)) return prev;
                    return [...prev, data];
                });
            }

            setTimeout(scrollToBottom, 50);
        } catch (err: any) {
            toast.error("Failed to send message: " + err.message);
        } finally {
            setIsSending(false);
        }
    };

    // Delete Message
    const handleDeleteMessage = async (msgId: string) => {
        const targetMsg = messages.find((m) => m.id === msgId);
        if (targetMsg && targetMsg.sender_type !== 'internal') {
            toast.error("You can only delete messages you sent.");
            return;
        }

        const confirmed = await confirm({
            title: "Delete Message",
            message: "Are you sure you want to delete this message? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed) return;

        setIsDeletingId(msgId);
        try {
            // Optimistic update
            setMessages((prev) => prev.filter((m) => m.id !== msgId));

            const { error } = await supabase
                .from("messages")
                .delete()
                .eq("id", msgId);

            if (error) {
                toast.error("Failed to delete message: " + error.message);
                // Re-sync messages on error
                if (selectedSupplier) {
                    const { data: msgs } = await supabase
                        .from("messages")
                        .select("*")
                        .eq("supplier_id", selectedSupplier.id)
                        .order("created_at", { ascending: true });
                    if (msgs) setMessages(msgs);
                }
            } else {
                toast.success("Message deleted");
            }
        } catch (err: any) {
            toast.error("Error deleting message: " + err.message);
        } finally {
            setIsDeletingId(null);
        }
    };

    const filteredSuppliers = suppliers.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const poOptions: SearchableDropdownOption[] = useMemo(() => {
        return purchaseOrders.map((po) => ({
            value: po.po_number,
            label: `PO #${po.po_number}`,
            subLabel: po.status ? `Status: ${po.status}${po.total_amount ? ` • ₱${Number(po.total_amount).toLocaleString()}` : ''}` : undefined,
            icon: 'fas fa-file-invoice',
        }));
    }, [purchaseOrders]);

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
                <div 
                    className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={onClose}
                />

                <div className="relative bg-[#ebf0f7] dark:bg-[#161a23] rounded-t-3xl sm:rounded-3xl max-w-4xl w-full h-[92vh] sm:h-[680px] max-h-[96vh] flex border border-slate-200/80 dark:border-white/[0.08] shadow-none animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 z-10 overflow-hidden">
                    
                    {/* Left Panel: Supplier Conversation List */}
                    <div className={`w-full md:w-80 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col bg-[#eef3f9]/80 dark:bg-[#14161f] shrink-0 ${
                        activeMobileView === "chat" && selectedSupplier ? "hidden md:flex" : "flex"
                    }`}>
                        {/* Header */}
                        <div className="p-3.5 sm:p-4 border-b border-slate-200/60 dark:border-slate-800/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#ffe6f0] to-[#ffd1e3] dark:from-[#341427] dark:to-[#4a1c38] border border-pink-300/80 dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 shadow-none shrink-0">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight truncate">
                                        Supplier Messages
                                    </h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">Internal Channel</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="md:hidden w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#1a1b26] text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 flex items-center justify-center border border-white/80 dark:border-white/[0.06] transition-all cursor-pointer shrink-0 ml-2"
                                title="Close Messenger"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Neumorphic Inset Search */}
                        <div className="p-3 border-b border-slate-200/60 dark:border-slate-800/70">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search supplier partner..."
                                    className="w-full py-2 pl-9 pr-3.5 bg-[#ebf0f7] dark:bg-[#11121a] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.04)] transition-all"
                                />
                            </div>
                        </div>

                        {/* Supplier List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                            {isLoadingSuppliers ? (
                                <div className="py-10 text-center">
                                    <Loader2 className="w-5 h-5 text-pink-500 animate-spin mx-auto mb-2" />
                                    <span className="text-xs text-slate-400 font-medium">Loading partners...</span>
                                </div>
                            ) : filteredSuppliers.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400">
                                    No matching suppliers found.
                                </div>
                            ) : (
                                filteredSuppliers.map((sup) => {
                                    const isSelected = selectedSupplier?.id === sup.id;
                                    return (
                                        <button
                                            key={sup.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedSupplier(sup);
                                                setActiveMobileView("chat");
                                            }}
                                            className={`w-full p-2.5 rounded-2xl text-left transition-all flex items-center gap-3 cursor-pointer ${
                                                isSelected
                                                    ? "bg-[#ffe6f0]/90 dark:bg-[#341427]/90 border border-pink-300/80 dark:border-[#67224c] shadow-[inset_2px_2px_5px_rgba(244,63,94,0.15),0_2px_6px_rgba(244,63,94,0.12)] text-pink-700 dark:text-pink-300"
                                                    : "bg-[#f0f3f8] dark:bg-[#181923] border border-white/70 dark:border-white/[0.04] hover:bg-[#e6ecf4] dark:hover:bg-[#1e202d] text-slate-700 dark:text-slate-200 shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)]"
                                            }`}
                                        >
                                            <div className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 transition-colors ${
                                                isSelected
                                                    ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white shadow-sm"
                                                    : "bg-[#ebf0f7] dark:bg-[#14151e] text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]"
                                            }`}>
                                                {sup.name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-bold text-xs truncate">
                                                        {sup.name}
                                                    </h4>
                                                </div>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                    {sup.contact_person || sup.category || "Supplier Partner"}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Conversation View */}
                    <div className={`flex-1 flex flex-col bg-[#ebf0f7]/70 dark:bg-[#161a23] min-w-0 ${
                        activeMobileView === "list" ? "hidden md:flex" : "flex"
                    }`}>
                        {selectedSupplier ? (
                            <>
                                {/* Conversation Header */}
                                <div className="p-3 sm:p-4 bg-[#f0f3f8]/90 dark:bg-[#181924]/90 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between shadow-none">
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => setActiveMobileView("list")}
                                            className="md:hidden w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151e] text-slate-600 dark:text-slate-300 hover:text-pink-600 flex items-center justify-center border border-slate-200/70 dark:border-slate-700 shrink-0 cursor-pointer"
                                            title="Back to partner list"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                        </button>
                                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#ffe6f0] to-[#ffd1e3] dark:from-[#341427] dark:to-[#4a1c38] border border-pink-300/80 dark:border-[#67224c] text-pink-600 dark:text-pink-300 flex items-center justify-center shrink-0">
                                            <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm tracking-tight truncate">
                                                {selectedSupplier.name}
                                            </h3>
                                            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                {selectedSupplier.contact_person ? `${selectedSupplier.contact_person} • ` : ''}{selectedSupplier.email}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#1a1b26] text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 flex items-center justify-center border border-white/80 dark:border-white/[0.06] transition-all cursor-pointer shrink-0 ml-2"
                                        title="Close Messenger"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* PO Tag selector */}
                                {purchaseOrders.length > 0 && (
                                    <div className="px-3 sm:px-4 py-2 bg-[#eaf0f7]/90 dark:bg-[#13141d] border-b border-slate-200/60 dark:border-slate-800/80 flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 text-xs relative z-30">
                                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
                                            <FileText className="w-3.5 h-3.5 text-pink-500" />
                                            Reference PO:
                                        </span>
                                        <div className="flex-1 sm:w-64 min-w-[160px]">
                                            <SearchableDropdown
                                                value={selectedPo}
                                                onChange={(val) => setSelectedPo(val || '')}
                                                options={poOptions}
                                                placeholder="None (General Inquiry)"
                                                allOptionLabel="None (General Inquiry)"
                                                searchPlaceholder="Search PO #..."
                                                icon="fas fa-file-invoice"
                                                emptyValue=""
                                                className="w-full"
                                                tone="pink"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Messages Area */}
                                <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3.5 custom-scrollbar">
                                    {isLoadingMessages ? (
                                        <div className="h-full flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                            <div className="w-14 h-14 rounded-2xl bg-[#ebf0f7] dark:bg-[#1a1b26] text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                                                <MessageSquare className="w-7 h-7 text-pink-500/70 dark:text-pink-400/60" />
                                            </div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                                No messages yet with {selectedSupplier.name}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                                                Type below to send a message directly to their portal.
                                            </p>
                                        </div>
                                    ) : (
                                        messages.map((msg, index) => {
                                            const isInternal = msg.sender_type === "internal";
                                            const isMyMessage = Boolean(
                                                isInternal && (
                                                    (currentUserId && msg.sender_id === currentUserId) ||
                                                    (currentUserEmail && msg.sender_email?.toLowerCase() === currentUserEmail.toLowerCase()) ||
                                                    (currentUserName && msg.sender_name?.toLowerCase() === currentUserName.toLowerCase())
                                                )
                                            );

                                            return (
                                                <div
                                                    key={`${msg.id || 'msg'}-${index}`}
                                                    className={`flex flex-col group/msg ${isMyMessage ? "items-end" : "items-start"}`}
                                                >
                                                    <div className="flex items-center gap-1.5 mb-1 px-1.5 text-[10px] text-slate-400">
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                            {isMyMessage ? (
                                                                `You (${currentUserRole || msg.sender_role || "Staff"})`
                                                            ) : isInternal ? (
                                                                <>
                                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                                    {msg.sender_name || "Staff"} ({msg.sender_role || "Staff"})
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Building2 className="w-3 h-3 text-emerald-500 inline" />
                                                                    {msg.sender_name || selectedSupplier.name}
                                                                </>
                                                            )}
                                                        </span>
                                                        <span>•</span>
                                                        <span>
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    </div>

                                                    <div className={`flex items-center gap-1.5 max-w-[92%] sm:max-w-[86%] ${isMyMessage ? "flex-row" : "flex-row-reverse"}`}>
                                                        {/* Delete Action on hover - ONLY for sender's own messages */}
                                                        {isMyMessage && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                disabled={isDeletingId === msg.id}
                                                                className="opacity-0 group-hover/msg:opacity-100 p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                                                                title="Delete my message"
                                                            >
                                                                {isDeletingId === msg.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                                                ) : (
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        )}

                                                        <div
                                                            className={`rounded-2xl p-3 sm:p-3.5 text-xs leading-relaxed ${
                                                                isMyMessage
                                                                    ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white rounded-br-none border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)] font-medium"
                                                                    : isInternal
                                                                        ? "bg-[#edf2fb] dark:bg-[#191c28] text-slate-800 dark:text-slate-100 border border-indigo-200/80 dark:border-indigo-900/60 rounded-bl-none shadow-[3px_3px_8px_rgba(166,175,195,0.35),-3px_-3px_8px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.03)]"
                                                                        : "bg-[#f0f3f8] dark:bg-[#1d1f2b] text-slate-800 dark:text-slate-200 border border-white/80 dark:border-white/[0.06] rounded-bl-none shadow-[3px_3px_8px_rgba(166,175,195,0.35),-3px_-3px_8px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.03)]"
                                                            }`}
                                                        >
                                                            {msg.purchase_order_id && (
                                                                <div className={`mb-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                                                                    isMyMessage 
                                                                        ? "bg-pink-700/50 text-pink-100 border border-pink-300/30" 
                                                                        : isInternal
                                                                            ? "bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60"
                                                                            : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                                                }`}>
                                                                    <FileText className="w-3 h-3" />
                                                                    <span>PO #{msg.purchase_order_id}</span>
                                                                </div>
                                                            )}
                                                            <p className="whitespace-pre-wrap">{msg.message}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Send Input Form */}
                                <form onSubmit={handleSend} className="p-2.5 sm:p-4 bg-[#f0f3f8]/95 dark:bg-[#171823]/95 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center gap-2 sm:gap-2.5">
                                    <div className="relative flex-1 min-w-0">
                                        <input
                                            type="text"
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            placeholder={`Message ${selectedSupplier.name}...`}
                                            className="w-full py-2 sm:py-2.5 px-3 sm:px-4 bg-[#ebf0f7] dark:bg-[#11121a] border border-slate-200/70 dark:border-slate-800 rounded-2xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.7),inset_-1px_-1px_4px_rgba(255,255,255,0.04)] transition-all"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSending || !inputText.trim()}
                                        className="py-2 sm:py-2.5 px-3.5 sm:px-5 rounded-2xl bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white text-xs font-bold border border-pink-400/80 shadow-[3px_3px_8px_rgba(236,72,153,0.4),-2px_-2px_6px_rgba(255,255,255,0.5),inset_0_1px_1px_rgba(255,255,255,0.6)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                    >
                                        {isSending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="w-3.5 h-3.5" />
                                                <span>Send</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-center p-6">
                                <p className="text-xs text-slate-400 font-semibold">
                                    Select a supplier from the list to begin messaging.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}
