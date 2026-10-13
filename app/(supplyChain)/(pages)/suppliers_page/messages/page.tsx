"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { 
    Send, 
    MessageSquare, 
    Building2, 
    User, 
    FileText, 
    Clock, 
    Loader2, 
    RefreshCw, 
    Search, 
    Check, 
    CheckCheck, 
    Sparkles, 
    Trash2,
    RotateCcw,
    AlertCircle,
    Crown,
    Settings,
    Users,
    Calendar,
    CalendarDays,
    ChevronRight,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    History,
    Filter,
    ArrowUpRight,
    Shield,
    Lock
} from "lucide-react";
import { user } from "../../../lib/services/Class/user";
import { supabase } from "../../../lib/services/client/supabase";
import Cards from "../../../components/global/Cards";
import { CardsSkeleton } from "../../../components/ui/SkeletonLoader";
import { toast } from "sonner";

interface SupplierMessage {
    id: string;
    supplier_id: number | string;
    purchase_order_id?: string | null;
    sender_type: "supplier" | "internal";
    sender_id?: string | null;
    sender_name: string;
    sender_email: string;
    sender_role: string;
    role?: string | null;
    message: string;
    attachments?: any;
    is_read: boolean;
    created_at: string;
    send_status?: "sending" | "sent" | "failed";
}

interface StaffContact {
    key: string;
    id?: string;
    email: string;
    name: string;
    role: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    messageCount: number;
}

// Week date helper calculations
function getMonday(d: Date) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getSunday(monday: Date) {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
}

function formatWeekRange(start: Date, end: Date) {
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} - ${endStr}`;
}

export default function SupplierMessagesPage() {
    const searchParams = useSearchParams();
    const defaultPoNumber = searchParams.get("po") || "";

    const [messages, setMessages] = useState<SupplierMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [selectedPo, setSelectedPo] = useState<string>(defaultPoNumber);
    const [searchQuery, setSearchQuery] = useState("");
    const [supplierAccount, setSupplierAccount] = useState<any>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [activeLeftTab, setActiveLeftTab] = useState<"contacts" | "weeks">("contacts");
    const [selectedStaffKey, setSelectedStaffKey] = useState<string>("");
    const [selectedWeekId, setSelectedWeekId] = useState<string>("");
    const [dateSearchInput, setDateSearchInput] = useState<string>("");
    const [debouncedDateQuery, setDebouncedDateQuery] = useState<string>("");
    const [visibleMessageLimit, setVisibleMessageLimit] = useState<number>(20);
    const [weekPage, setWeekPage] = useState<number>(1);
    const weeksPerPage = 4;

    // Reset visible limit on contact, week or search change
    useEffect(() => {
        setVisibleMessageLimit(20);
    }, [selectedStaffKey, selectedWeekId, searchQuery]);

    // Debounce date search query
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedDateQuery(dateSearchInput.trim());
        }, 300);
        return () => clearTimeout(handler);
    }, [dateSearchInput]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const currentUserEmail = user.getEmail();
    const currentUserName = user.getName() || "Supplier Representative";
    const currentUserId = user.getUserId();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Extract private staff contacts who have messaged this supplier
    const staffContacts = useMemo(() => {
        const contactMap = new Map<string, StaffContact>();

        messages.forEach((msg) => {
            let staffEmail = "";
            let staffName = "";
            let staffRole = "";
            let staffId = "";

            if (msg.sender_type === "internal") {
                staffEmail = (msg.sender_email || "").trim();
                staffName = (msg.sender_name || "").trim() || "Staff Member";
                staffRole = msg.sender_role || msg.role || "Staff";
                staffId = msg.sender_id || "";
            } else if (msg.sender_type === "supplier") {
                if (Array.isArray(msg.attachments)) {
                    const target = msg.attachments.find(
                        (a: any) => a && (a.type === "target_recipient" || a.recipient_id || a.recipient_email || a.staff_id || a.staff_email)
                    );
                    if (target) {
                        staffId = target.recipient_id || target.staff_id || "";
                        staffEmail = (target.recipient_email || target.staff_email || "").trim();
                        staffName = (target.recipient_name || target.staff_name || "Staff Member").trim();
                        staffRole = target.recipient_role || target.staff_role || "Staff";
                    }
                }
            }

            if (!staffEmail && !staffName) return;

            const key = (staffEmail || staffName).toLowerCase();
            if (!contactMap.has(key)) {
                contactMap.set(key, {
                    key,
                    id: staffId,
                    email: staffEmail,
                    name: staffName,
                    role: staffRole,
                    lastMessage: msg.message,
                    lastMessageTime: msg.created_at,
                    unreadCount: 0,
                    messageCount: 0,
                });
            }

            const contact = contactMap.get(key)!;
            contact.messageCount++;
            if (msg.sender_type === "internal" && !msg.is_read) {
                contact.unreadCount++;
            }
            contact.lastMessage = msg.message;
            contact.lastMessageTime = msg.created_at;
            if (staffRole && staffRole !== "Staff") {
                contact.role = staffRole;
            }
            if (staffId && !contact.id) {
                contact.id = staffId;
            }
        });

        return Array.from(contactMap.values()).sort(
            (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );
    }, [messages]);

    // Automatically synchronize selectedStaffKey to first available contact if not set
    useEffect(() => {
        if (staffContacts.length > 0) {
            if (!selectedStaffKey || !staffContacts.some((c) => c.key === selectedStaffKey)) {
                setSelectedStaffKey(staffContacts[0].key);
            }
        }
    }, [staffContacts, selectedStaffKey]);

    const activeStaffContact = useMemo(() => {
        if (!selectedStaffKey) return staffContacts[0] || null;
        return staffContacts.find((c) => c.key === selectedStaffKey) || staffContacts[0] || null;
    }, [selectedStaffKey, staffContacts]);

    // Fast Parallel Fetch
    const fetchChatData = async () => {
        if (!currentUserEmail) return;
        setIsLoading(true);

        try {
            const { data: acc, error: accErr } = await supabase
                .from("suppliers_account")
                .select("*, suppliers(*)")
                .ilike("email", currentUserEmail.trim())
                .maybeSingle();

            if (accErr || !acc) {
                console.warn("Supplier account lookup returned:", accErr, acc);
                setIsLoading(false);
                return;
            }

            setSupplierAccount(acc);

            const [posRes, msgsRes] = await Promise.all([
                supabase
                    .from("purchase_orders")
                    .select("id, po_number, status, total_amount")
                    .eq("supplier_id", acc.supplier_id)
                    .order("created_at", { ascending: false }),
                supabase
                    .from("messages")
                    .select("*")
                    .eq("supplier_id", acc.supplier_id)
                    .order("created_at", { ascending: true })
            ]);

            if (posRes.data) {
                const uniquePoMap = new Map();
                posRes.data.forEach((po: any) => {
                    if (po.id) uniquePoMap.set(po.id, po);
                });
                setPurchaseOrders(Array.from(uniquePoMap.values()));
            }

            if (msgsRes.data) {
                const uniqueMap = new Map();
                msgsRes.data.forEach((m: any) => {
                    uniqueMap.set(m.id, { ...m, send_status: "sent" });
                });
                setMessages(Array.from(uniqueMap.values()));
            }
        } catch (err) {
            console.error("Error fetching messages:", err);
            toast.error("Failed to load messages");
        } finally {
            setIsLoading(false);
            setTimeout(scrollToBottom, 100);
        }
    };

    // Mark unread messages from active staff contact as read
    useEffect(() => {
        if (!supplierAccount?.supplier_id || !selectedStaffKey) return;
        
        const unreadForSelected = messages.filter((m) => {
            if (m.sender_type !== "internal" || m.is_read) return false;
            const sEmail = (m.sender_email || "").toLowerCase().trim();
            const sName = (m.sender_name || "").toLowerCase().trim();
            return sEmail === selectedStaffKey || sName === selectedStaffKey;
        });

        if (unreadForSelected.length > 0) {
            supabase
                .from("messages")
                .update({ is_read: true })
                .in("id", unreadForSelected.map((m) => m.id))
                .then();
        }
    }, [selectedStaffKey, messages, supplierAccount?.supplier_id]);

    useEffect(() => {
        let activeChannel: any = null;
        let isMounted = true;

        if (currentUserEmail) {
            fetchChatData().then(() => {
                if (!isMounted || !supplierAccount?.supplier_id) return;

                const channelName = `messages_room_${supplierAccount.supplier_id}_${Date.now()}`;
                activeChannel = supabase
                    .channel(channelName)
                    .on(
                        "postgres_changes",
                        {
                            event: "INSERT",
                            schema: "public",
                            table: "messages",
                            filter: `supplier_id=eq.${supplierAccount.supplier_id}`,
                        },
                        (payload) => {
                            if (!isMounted || !payload.new) return;

                            setMessages((prev) => {
                                if (prev.some((m) => m.id === payload.new.id)) return prev;

                                const tempIdx = prev.findIndex(
                                    (m) => m.id.startsWith("temp_") && m.message === payload.new.message && m.sender_type === payload.new.sender_type
                                );
                                if (tempIdx !== -1) {
                                    const copy = [...prev];
                                    copy[tempIdx] = { ...(payload.new as SupplierMessage), send_status: "sent" };
                                    return copy;
                                }

                                return [...prev, { ...(payload.new as SupplierMessage), send_status: "sent" }];
                            });
                            setTimeout(scrollToBottom, 60);
                        }
                    )
                    .on(
                        "postgres_changes",
                        {
                            event: "UPDATE",
                            schema: "public",
                            table: "messages",
                            filter: `supplier_id=eq.${supplierAccount.supplier_id}`,
                        },
                        (payload) => {
                            if (!isMounted || !payload.new) return;
                            setMessages((prev) =>
                                prev.map((m) => (m.id === payload.new.id ? { ...m, ...(payload.new as SupplierMessage) } : m))
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
                            if (!isMounted || !payload.old?.id) return;
                            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
                        }
                    )
                    .subscribe();
            });
        }

        return () => {
            isMounted = false;
            if (activeChannel) {
                supabase.removeChannel(activeChannel);
            }
        };
    }, [currentUserEmail, supplierAccount?.supplier_id]);

    // Send Message directed to selected internal staff member
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text) return;

        let activeSupplierId = supplierAccount?.supplier_id;

        if (!activeSupplierId && currentUserEmail) {
            const { data: acc } = await supabase
                .from("suppliers_account")
                .select("supplier_id")
                .ilike("email", currentUserEmail.trim())
                .maybeSingle();

            if (acc?.supplier_id) {
                activeSupplierId = acc.supplier_id;
                setSupplierAccount((prev: any) => ({ ...prev, supplier_id: acc.supplier_id }));
            }
        }

        if (!activeSupplierId) {
            toast.error("Supplier account is loading. Please try again in a moment.");
            return;
        }

        const currentPo = selectedPo || null;
        setInputText("");
        setIsSending(true);

        const currentStaff = activeStaffContact;
        const recipientMetadata = currentStaff ? {
            type: "target_recipient",
            recipient_id: currentStaff.id || null,
            recipient_email: currentStaff.email,
            recipient_name: currentStaff.name,
            recipient_role: currentStaff.role,
        } : null;

        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newMsg: SupplierMessage = {
            id: tempId,
            supplier_id: activeSupplierId,
            purchase_order_id: currentPo,
            sender_type: "supplier",
            sender_id: currentUserId || null,
            sender_name: currentUserName || "Supplier Representative",
            sender_email: currentUserEmail || "supplier@airship.com",
            sender_role: "Supplier",
            role: "Supplier",
            message: text,
            attachments: recipientMetadata ? [recipientMetadata] : [],
            is_read: false,
            created_at: new Date().toISOString(),
            send_status: "sending"
        };

        // Immediately show optimistic message on screen
        setMessages((prev) => [...prev, newMsg]);
        setTimeout(scrollToBottom, 50);

        try {
            let data: any = null;

            const directRes = await supabase
                .from("messages")
                .insert({
                    supplier_id: Number(newMsg.supplier_id),
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
                console.warn("Direct Supabase insert failed in supplier portal, attempting /api/messages fallback:", directRes.error);
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
                setMessages((prev) => {
                    const alreadyHasId = prev.some((m) => m.id === data.id);
                    if (alreadyHasId) {
                        return prev.filter((m) => m.id !== tempId);
                    }
                    return prev.map((m) => (m.id === tempId ? { ...data, send_status: "sent" } : m));
                });
            }
        } catch (err: any) {
            console.error("Error sending message:", err);
            setMessages((prev) => 
                prev.map((m) => (m.id === tempId ? { ...m, send_status: "failed" } : m))
            );
            toast.error("Delivery failed. Click Re-submit to retry.");
        } finally {
            setIsSending(false);
            setTimeout(scrollToBottom, 100);
        }
    };

    // Re-submit / Retry failed message
    const handleRetryMessage = async (msg: SupplierMessage) => {
        setMessages((prev) => 
            prev.map((m) => (m.id === msg.id ? { ...m, send_status: "sending" } : m))
        );

        const retryPayload = {
            supplier_id: Number(msg.supplier_id),
            purchase_order_id: msg.purchase_order_id || null,
            sender_type: msg.sender_type || "supplier",
            sender_id: msg.sender_id || null,
            sender_name: msg.sender_name,
            sender_email: msg.sender_email || currentUserEmail || "supplier@airship.com",
            sender_role: msg.sender_role || "Supplier",
            role: msg.role || "Supplier",
            message: msg.message,
            attachments: msg.attachments || [],
            is_read: false,
            created_at: new Date().toISOString(),
        };

        try {
            let data: any = null;
            const directRes = await supabase
                .from("messages")
                .insert(retryPayload)
                .select()
                .single();

            if (directRes.error) {
                const apiRes = await fetch("/api/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(retryPayload),
                });
                const apiJson = await apiRes.json();
                if (!apiJson.success) throw new Error(apiJson.error || directRes.error.message);
                data = apiJson.data;
            } else {
                data = directRes.data;
            }

            if (data) {
                setMessages((prev) => {
                    const alreadyHasId = prev.some((m) => m.id === data.id);
                    if (alreadyHasId) {
                        return prev.filter((m) => m.id !== msg.id);
                    }
                    return prev.map((m) => (m.id === msg.id ? { ...data, send_status: "sent" } : m));
                });
                toast.success("Message re-sent successfully!");
            }
        } catch (err: any) {
            console.error("Retry failed:", err);
            setMessages((prev) => 
                prev.map((m) => (m.id === msg.id ? { ...m, send_status: "failed" } : m))
            );
            toast.error("Retry failed. Please check network connection.");
        }
    };

    // Delete Message with instant optimistic UI update
    const handleDeleteMessage = async (msgId: string) => {
        setDeletingId(msgId);
        const previousMessages = messages;
        setMessages((prev) => prev.filter((m) => m.id !== msgId));

        if (msgId.startsWith("temp_")) {
            toast.success("Draft removed");
            setDeletingId(null);
            return;
        }

        try {
            const { error } = await supabase
                .from("messages")
                .delete()
                .eq("id", msgId);

            if (error) {
                const apiRes = await fetch(`/api/messages?id=${encodeURIComponent(msgId)}`, {
                    method: "DELETE",
                });
                const apiJson = await apiRes.json();
                if (!apiJson.success) throw new Error(apiJson.error || error.message);
            }
            toast.success("Message deleted");
        } catch (err: any) {
            console.error("Error deleting message:", err);
            setMessages(previousMessages);
            toast.error("Failed to delete message: " + (err.message || "Network error"));
        } finally {
            setDeletingId(null);
        }
    };

    // Helper: Check if a message belongs to selected staff thread
    const isMessageInSelectedThread = (msg: SupplierMessage, staffKey?: string) => {
        if (!staffKey) return true;
        const targetKey = staffKey.toLowerCase().trim();

        if (msg.sender_type === "internal") {
            const sEmail = (msg.sender_email || "").toLowerCase().trim();
            const sName = (msg.sender_name || "").toLowerCase().trim();
            return sEmail === targetKey || sName === targetKey;
        }

        if (msg.sender_type === "supplier") {
            if (Array.isArray(msg.attachments)) {
                const target = msg.attachments.find(
                    (a: any) => a && (a.type === "target_recipient" || a.recipient_id || a.recipient_email || a.staff_id || a.staff_email)
                );
                if (target) {
                    const tEmail = (target.recipient_email || target.staff_email || "").toLowerCase().trim();
                    const tName = (target.recipient_name || target.staff_name || "").toLowerCase().trim();
                    return tEmail === targetKey || tName === targetKey;
                }
            }
            if (staffContacts.length <= 1) {
                return true;
            }
            return false;
        }

        return false;
    };

    // Filter messages belonging to the currently selected private 1-on-1 thread
    const threadMessages = useMemo(() => {
        if (!selectedStaffKey) return messages;
        return messages.filter((m) => isMessageInSelectedThread(m, selectedStaffKey));
    }, [messages, selectedStaffKey, staffContacts.length]);

    // Dynamic Weekly Groups Calculation for the selected thread
    const weekHistoryGroups = useMemo(() => {
        const now = new Date();
        const currentWeekMonday = getMonday(now).getTime();
        const lastWeekMonday = currentWeekMonday - (7 * 24 * 60 * 60 * 1000);

        const groupMap = new Map<string, {
            id: string;
            label: string;
            dateRangeText: string;
            messageCount: number;
            unreadCount: number;
            lastMessageText: string;
            lastMessageTime: string;
            startDate: Date;
        }>();

        threadMessages.forEach((msg) => {
            const msgDate = new Date(msg.created_at || Date.now());
            const monday = getMonday(msgDate);
            const sunday = getSunday(monday);
            const key = monday.toISOString().split("T")[0];

            let label = `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
            if (monday.getTime() === currentWeekMonday) {
                label = "This Week";
            } else if (monday.getTime() === lastWeekMonday) {
                label = "Last Week";
            }

            const dateRangeText = formatWeekRange(monday, sunday);

            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    id: key,
                    label,
                    dateRangeText,
                    messageCount: 0,
                    unreadCount: 0,
                    lastMessageText: msg.message,
                    lastMessageTime: msg.created_at,
                    startDate: monday,
                });
            }

            const g = groupMap.get(key)!;
            g.messageCount++;
            if (msg.sender_type === "internal" && !msg.is_read) {
                g.unreadCount++;
            }
            g.lastMessageText = msg.message;
            g.lastMessageTime = msg.created_at;
        });

        return Array.from(groupMap.values()).sort(
            (a, b) => b.startDate.getTime() - a.startDate.getTime()
        );
    }, [threadMessages]);

    // Filtered week groups based on debounced date search
    const filteredWeekGroups = useMemo(() => {
        if (!debouncedDateQuery) return weekHistoryGroups;
        const q = debouncedDateQuery.toLowerCase();
        return weekHistoryGroups.filter((w) => {
            const matchLabel = w.label.toLowerCase().includes(q);
            const matchRange = w.dateRangeText.toLowerCase().includes(q);
            const matchId = w.id.toLowerCase().includes(q);
            const matchPreview = w.lastMessageText.toLowerCase().includes(q);
            return matchLabel || matchRange || matchId || matchPreview;
        });
    }, [weekHistoryGroups, debouncedDateQuery]);

    const totalWeekPages = Math.max(1, Math.ceil(filteredWeekGroups.length / weeksPerPage));

    const paginatedWeekGroups = useMemo(() => {
        const start = (weekPage - 1) * weeksPerPage;
        return filteredWeekGroups.slice(start, start + weeksPerPage);
    }, [filteredWeekGroups, weekPage, weeksPerPage]);

    // Message metrics for KPI Cards
    const metrics = useMemo(() => {
        let totalCount = messages.length;
        let internalReplies = 0;
        let poTaggedCount = 0;
        let unreadCount = 0;

        messages.forEach((msg) => {
            if (msg.sender_type === "internal") {
                internalReplies++;
                if (!msg.is_read) unreadCount++;
            }
            if (msg.purchase_order_id) {
                poTaggedCount++;
            }
        });

        return {
            totalCount,
            internalReplies,
            poTaggedCount,
            unreadCount,
            activeContacts: staffContacts.length,
            activeWeeks: weekHistoryGroups.length
        };
    }, [messages, staffContacts.length, weekHistoryGroups.length]);

    // Final filtered message stream for chat viewport
    const filteredMessages = useMemo(() => {
        return threadMessages.filter((msg) => {
            const matchesSearch =
                !searchQuery ||
                msg.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                msg.sender_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (msg.sender_role && msg.sender_role.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (msg.purchase_order_id && msg.purchase_order_id.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (!selectedWeekId) return true;

            const msgDate = new Date(msg.created_at || Date.now());
            const monday = getMonday(msgDate);
            const key = monday.toISOString().split("T")[0];
            return key === selectedWeekId;
        });
    }, [threadMessages, searchQuery, selectedWeekId]);

    const hasMoreMessages = filteredMessages.length > visibleMessageLimit;
    const hiddenCount = Math.max(0, filteredMessages.length - visibleMessageLimit);

    const displayedMessages = useMemo(() => {
        if (filteredMessages.length <= visibleMessageLimit) {
            return filteredMessages;
        }
        return filteredMessages.slice(filteredMessages.length - visibleMessageLimit);
    }, [filteredMessages, visibleMessageLimit]);

    const getRoleBadgeClass = (role?: string, isMe?: boolean) => {
        if (isMe) return "bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20";
        const r = (role || "").toUpperCase();
        if (r.includes("EXEC")) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
        if (r.includes("ADMIN")) return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20";
        if (r.includes("MANAGER")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
        return "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/40";
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return "";
        return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const formatDate = (isoString?: string) => {
        if (!isoString) return "";
        return new Date(isoString).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    };

    return (
        <div className="w-full space-y-5 sm:space-y-6 animate-fade-in bgCard">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                    <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Lock className="w-5 h-5 text-pink-500" />
                        Private Messages & Inquiries
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 sm:mt-1">
                        Direct, confidential 1-on-1 communication channel with Airship Express Admins and Supply Chain Managers.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchChatData}
                    disabled={isLoading}
                    className="self-start sm:self-auto px-3.5 py-2 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#1a1b26] border border-white/80 dark:border-white/[0.08] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.3)] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-pink-500 ${isLoading ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* KPI Stat Cards */}
            {isLoading ? (
                <CardsSkeleton count={4} />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Cards
                        frontIcon="fas fa-comments"
                        header="Total Messages"
                        data={metrics.totalCount.toString()}
                        arrow="fas fa-message"
                        description="Private 1-on-1 messages"
                        frontTextColor="text-pink-500"
                        backHeader="Messages Overview"
                        backDescription="Total messages exchanged in confidential threads with Airship Express staff."
                    />
                    <Cards
                        frontIcon="fas fa-user-shield"
                        header="Staff Contacts"
                        data={(metrics.activeContacts || 1).toString()}
                        arrow="fas fa-users"
                        description="Admins & Managers"
                        frontTextColor="text-pink-500"
                        backHeader="Direct Contacts"
                        backDescription="Separate 1-on-1 conversation channels with Administrators and Supply Chain Managers."
                    />
                    <Cards
                        frontIcon="fas fa-file-invoice"
                        header="PO Inquiries"
                        data={metrics.poTaggedCount.toString()}
                        arrow="fas fa-link"
                        description="Linked to purchase orders"
                        frontTextColor="text-pink-500"
                        backHeader="Tagged PO Threads"
                        backDescription="Messages directly associated with specific purchase order references."
                    />
                    <Cards
                        frontIcon="fas fa-calendar-alt"
                        header="Active Weeks"
                        data={(metrics.activeWeeks || 1).toString()}
                        arrow="fas fa-history"
                        description="Recorded history weeks"
                        frontTextColor="text-pink-500"
                        backHeader="Timeline Archive"
                        backDescription="Weekly chronological history periods of your private conversations."
                    />
                </div>
            )}

            {/* Main Outer Card */}
            <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl p-3.5 sm:p-6 border border-white/80 dark:border-white/[0.08] shadow-[10px_10px_28px_rgba(166,175,195,0.35),-10px_-10px_28px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.7)]">
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                    
                    {/* Left Column: Direct Staff Contacts & Weekly History */}
                    <div className="lg:col-span-4 space-y-3 sm:space-y-4">
                        <div className="bg-[#ebf0f7]/80 dark:bg-[#13141c]/80 rounded-2xl p-3 sm:p-4 border border-white/80 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)] flex flex-col justify-between space-y-3 min-h-0 lg:min-h-[600px]">
                            <div className="space-y-3 flex-1 flex flex-col min-h-0">
                                
                                {/* Left Tab Switcher: Direct Contacts vs Weekly History */}
                                <div className="flex items-center gap-1.5 p-1 bg-[#e0e7f2] dark:bg-[#181924] rounded-xl border border-white/60 dark:border-white/[0.04]">
                                    <button
                                        type="button"
                                        onClick={() => setActiveLeftTab("contacts")}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                            activeLeftTab === "contacts"
                                                ? "bg-white dark:bg-[#25283b] text-pink-600 dark:text-pink-400 shadow-xs"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                    >
                                        <User className="w-3.5 h-3.5" />
                                        <span>Staff Contacts ({staffContacts.length})</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveLeftTab("weeks")}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                            activeLeftTab === "weeks"
                                                ? "bg-white dark:bg-[#25283b] text-pink-600 dark:text-pink-400 shadow-xs"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                    >
                                        <History className="w-3.5 h-3.5" />
                                        <span>Timeline Archive</span>
                                    </button>
                                </div>

                                {activeLeftTab === "contacts" ? (
                                    /* Staff Contacts List (Direct 1-on-1 Threads) */
                                    <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 custom-scrollbar max-h-[300px] sm:max-h-[360px] lg:max-h-none min-h-0">
                                        {staffContacts.length === 0 ? (
                                            <div className="py-8 text-center text-xs text-slate-400 space-y-2 bg-white/70 dark:bg-[#181924]/70 rounded-xl p-4 border border-dashed border-slate-300 dark:border-slate-800">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <p className="font-bold text-slate-800 dark:text-slate-200">No staff contacts yet</p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    When an Admin or Manager sends a message, their private thread will appear here.
                                                </p>
                                            </div>
                                        ) : (
                                            staffContacts.map((contact) => {
                                                const isSelected = selectedStaffKey === contact.key;
                                                const roleBadge = getRoleBadgeClass(contact.role, false);

                                                return (
                                                    <button
                                                        key={`contact_${contact.key}`}
                                                        type="button"
                                                        onClick={() => setSelectedStaffKey(contact.key)}
                                                        className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                                            isSelected
                                                                ? "bg-white dark:bg-[#1C1F2D] text-slate-950 dark:text-white border-2 border-pink-500 dark:border-pink-500 shadow-[0_4px_14px_rgba(236,72,153,0.18)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
                                                                : "bg-[#f0f3f8] dark:bg-[#181924] border-white/80 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.45)] hover:bg-white dark:hover:bg-[#1e1f2b] hover:border-pink-500/40"
                                                        }`}
                                                    >
                                                        {isSelected && (
                                                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-pink-500" />
                                                        )}

                                                        <div className="flex items-start gap-2.5 pl-0.5">
                                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                                                                isSelected 
                                                                    ? "bg-pink-500 text-white shadow-xs" 
                                                                    : "bg-pink-500/10 text-pink-600 dark:text-pink-400"
                                                            }`}>
                                                                <User className="w-4 h-4" />
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center justify-between gap-1.5">
                                                                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                                                        {contact.name}
                                                                    </h4>
                                                                    <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold shrink-0 ${roleBadge}`}>
                                                                        {contact.role}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center justify-between gap-1 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                                                    <span className="truncate">{contact.email || "Internal Staff"}</span>
                                                                    {contact.unreadCount > 0 && (
                                                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[8px] font-black bg-pink-500 text-white shadow-xs shrink-0">
                                                                            {contact.unreadCount} new
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {contact.lastMessage && (
                                                                    <p className="text-[11px] mt-1 line-clamp-1 italic text-slate-600 dark:text-slate-300">
                                                                        "{contact.lastMessage}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                ) : (
                                    /* Weekly Timeline Archive */
                                    <>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 dark:text-slate-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                placeholder="Search timeline..."
                                                value={dateSearchInput}
                                                onChange={(e) => setDateSearchInput(e.target.value)}
                                                className="w-full pl-8 pr-7 py-2 rounded-xl text-xs bg-white dark:bg-[#181924] text-slate-900 dark:text-white font-medium border border-slate-200/80 dark:border-white/[0.08] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] focus:outline-hidden focus:ring-2 focus:ring-pink-500/50"
                                            />
                                        </div>

                                        <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 custom-scrollbar max-h-[260px] sm:max-h-[320px] lg:max-h-none min-h-0">
                                            {paginatedWeekGroups.length === 0 ? (
                                                <div className="py-8 text-center text-xs text-slate-400 space-y-2 bg-white/70 dark:bg-[#181924]/70 rounded-xl p-4 border border-dashed border-slate-300 dark:border-slate-800">
                                                    <CalendarDays className="w-6 h-6 mx-auto text-slate-400" />
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">No matching timeline records</p>
                                                </div>
                                            ) : (
                                                paginatedWeekGroups.map((w) => {
                                                    const isSelected = selectedWeekId === w.id;
                                                    return (
                                                        <button
                                                            key={`week_${w.id}`}
                                                            type="button"
                                                            onClick={() => setSelectedWeekId(isSelected ? "" : w.id)}
                                                            className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                                                                isSelected
                                                                    ? "bg-white dark:bg-[#1C1F2D] border-2 border-pink-500"
                                                                    : "bg-[#f0f3f8] dark:bg-[#181924] border-white/80 dark:border-white/[0.06]"
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-slate-900 dark:text-white">{w.label}</span>
                                                                <span className="text-[10px] text-pink-600 font-bold">{w.messageCount} msgs</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-500">{w.dateRangeText}</span>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Private 1-on-1 Chat Stream & Input */}
                    <div className="lg:col-span-8 flex flex-col h-[520px] sm:h-[560px] lg:h-[600px] bg-[#ebf0f7]/70 dark:bg-[#13141c]/70 rounded-2xl border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)] overflow-hidden">
                        
                        {/* Private 1-on-1 Chat Toolbar */}
                        <div className="p-3 sm:px-4 bg-[#f0f3f8] dark:bg-[#161722] border-b border-white/60 dark:border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 font-black text-xs text-slate-900 dark:text-white">
                                        <Lock className="w-3.5 h-3.5 text-pink-500" />
                                        <span>
                                            Private Conversation with {activeStaffContact ? activeStaffContact.name : "Airship Supply Chain"}
                                        </span>
                                    </div>
                                    {activeStaffContact && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getRoleBadgeClass(activeStaffContact.role, false)}`}>
                                            {activeStaffContact.role}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                    {activeStaffContact?.email ? (
                                        <>Direct 1-on-1 confidential channel • <span className="font-mono text-[10px]">{activeStaffContact.email}</span></>
                                    ) : (
                                        "Private thread with assigned procurement staff"
                                    )}
                                </p>
                            </div>

                            <div className="relative w-full sm:w-52">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search in this private chat..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[#ebf0f7] dark:bg-[#13141c] text-slate-800 dark:text-slate-200 border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] focus:outline-hidden"
                                />
                            </div>
                        </div>

                        {/* Chat Message Feed */}
                        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
                            {isLoading ? (
                                <div className="h-full flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                                    <p className="text-xs text-slate-400 font-medium">Loading private conversation...</p>
                                </div>
                            ) : filteredMessages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                    <div className="w-12 h-12 rounded-2xl bg-[#f0f3f8] dark:bg-[#181924] flex items-center justify-center text-pink-500 mb-2.5 shadow-sm">
                                        <MessageSquare className="w-6 h-6" />
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                                        No Messages in this Private Thread
                                    </h4>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs">
                                        Send a private message to {activeStaffContact?.name || "the staff officer"} regarding purchase orders or deliveries.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {hasMoreMessages && (
                                        <div className="flex justify-center pb-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setVisibleMessageLimit((prev) => prev + 20)}
                                                className="px-3.5 py-1.5 rounded-full text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-white dark:bg-[#181924] border border-pink-500/20 shadow-xs hover:bg-pink-50 dark:hover:bg-pink-950/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <History className="w-3.5 h-3.5" />
                                                <span>Load earlier messages ({hiddenCount} remaining)</span>
                                            </button>
                                        </div>
                                    )}

                                    {displayedMessages.map((msg, index) => {
                                        const isMe = msg.sender_type === "supplier" || msg.sender_email === currentUserEmail;
                                        const showDate =
                                            index === 0 ||
                                            formatDate(msg.created_at) !== formatDate(displayedMessages[index - 1].created_at);

                                        const isSendingMsg = msg.send_status === "sending";
                                        const isFailedMsg = msg.send_status === "failed";
                                        const displayRole = msg.sender_role || msg.role || (isMe ? "Supplier" : "Staff");
                                        const roleBadgeClass = getRoleBadgeClass(displayRole, isMe);
                                        const uniqueMsgKey = `msg_${msg.id || 'idx'}_${index}`;

                                        return (
                                            <div key={uniqueMsgKey} className="space-y-1 group">
                                                {showDate && (
                                                    <div className="flex items-center justify-center my-2">
                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-[#f0f3f8] dark:bg-[#161722] border border-white/60 dark:border-white/[0.04]">
                                                            {formatDate(msg.created_at)}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                                    {/* Meta Info */}
                                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 mb-1 px-1">
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">
                                                            {isMe ? "You" : msg.sender_name}
                                                        </span>
                                                        <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${roleBadgeClass}`}>
                                                            {displayRole}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{formatTime(msg.created_at)}</span>
                                                    </div>

                                                    {/* Bubble + Actions */}
                                                    <div className={`relative flex items-center gap-2 group/bubble max-w-full ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                                                        <div
                                                            className={`max-w-[88%] sm:max-w-md rounded-2xl p-3 text-xs font-medium space-y-1 transition-all ${
                                                                isMe
                                                                    ? isFailedMsg
                                                                        ? "bg-rose-600 text-white shadow-sm rounded-tr-xs"
                                                                        : "bg-pink-600 text-white shadow-[0_3px_10px_rgba(236,72,153,0.3)] rounded-tr-xs"
                                                                    : "bg-[#f0f3f8] dark:bg-[#181924] text-slate-800 dark:text-slate-200 border border-white/80 dark:border-white/[0.06] shadow-sm rounded-tl-xs"
                                                            }`}
                                                        >
                                                            {/* Tagged PO */}
                                                            {msg.purchase_order_id && (
                                                                <div
                                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold mb-0.5 ${
                                                                        isMe
                                                                            ? "bg-white/20 text-white"
                                                                            : "bg-pink-500/10 text-pink-600 dark:text-pink-400"
                                                                    }`}
                                                                >
                                                                    <FileText className="w-3 h-3" />
                                                                    <span>Ref: {msg.purchase_order_id}</span>
                                                                </div>
                                                            )}

                                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>

                                                            {/* Status */}
                                                            {isMe && (
                                                                <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px]">
                                                                    {isSendingMsg && (
                                                                        <span className="flex items-center gap-1 font-semibold text-pink-100 animate-pulse">
                                                                            <Loader2 className="w-3 h-3 animate-spin text-pink-200" />
                                                                            <span>Sending...</span>
                                                                        </span>
                                                                    )}
                                                                    {isFailedMsg && (
                                                                        <span className="flex items-center gap-1 text-rose-200 font-bold">
                                                                            <AlertCircle className="w-3 h-3 text-rose-200" />
                                                                            <span>Failed to send</span>
                                                                        </span>
                                                                    )}
                                                                    {!isSendingMsg && !isFailedMsg && (
                                                                        <span className="flex items-center gap-1 text-white/80 font-medium">
                                                                            <CheckCheck className="w-3.5 h-3.5 text-white/80" />
                                                                            <span>Sent</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Action buttons on hover */}
                                                        <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1">
                                                            {isFailedMsg && (
                                                                <button
                                                                    onClick={() => handleRetryMessage(msg)}
                                                                    className="p-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white shadow-xs cursor-pointer"
                                                                    title="Retry message"
                                                                >
                                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}

                                                            {isMe && (
                                                                <button
                                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                                    disabled={deletingId === msg.id}
                                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-[#181924] border border-slate-200 dark:border-white/[0.08] shadow-xs cursor-pointer"
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

                                                    {/* Re-submit Button */}
                                                    {isMe && isFailedMsg && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <button
                                                                onClick={() => handleRetryMessage(msg)}
                                                                className="px-2.5 py-1 rounded-full text-[10px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/40 hover:bg-pink-100 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                                <span>Click to Re-submit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                                            >
                                                                Discard
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Box */}
                        <form
                            onSubmit={handleSendMessage}
                            className="p-3.5 bg-[#f0f3f8] dark:bg-[#161722] border-t border-white/60 dark:border-white/[0.04] space-y-2.5"
                        >
                            {/* PO Tagging */}
                            {purchaseOrders.length > 0 && (
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <FileText className="w-3 h-3 text-pink-500" />
                                        Tag PO:
                                    </span>
                                    <select
                                        value={selectedPo}
                                        onChange={(e) => setSelectedPo(e.target.value)}
                                        className="py-1 px-2.5 rounded-xl text-xs font-semibold bg-[#ebf0f7] dark:bg-[#13141c] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)] focus:outline-hidden"
                                    >
                                        <option value="">No PO reference</option>
                                        {purchaseOrders.map((po, pIdx) => (
                                            <option key={`po_opt_${po.id || pIdx}_${pIdx}`} value={po.po_number}>
                                                {po.po_number} ({po.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Message input */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder={
                                        activeStaffContact 
                                            ? `Private reply to ${activeStaffContact.name} (${activeStaffContact.role})...`
                                            : "Type your private message to the Supply Chain staff..."
                                    }
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    disabled={isSending}
                                    className="flex-1 px-4 py-2.5 rounded-2xl text-xs font-medium bg-[#ebf0f7] dark:bg-[#13141c] text-slate-800 dark:text-slate-200 border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] focus:outline-hidden focus:ring-2 focus:ring-pink-500/40 disabled:opacity-60"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputText.trim() || isSending}
                                    className="px-4 py-2.5 rounded-2xl text-white bg-pink-600 hover:bg-pink-700 shadow-[2px_2px_8px_rgba(236,72,153,0.35)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                                >
                                    {isSending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-xs font-bold hidden sm:inline">Sending...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            <span className="text-xs font-bold hidden sm:inline">Send</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
