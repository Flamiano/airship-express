// app/(supplyChain)/(pages)/suppliers/components/tables/SupplierMeetingsTab.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Calendar,
    Clock,
    Video,
    MapPin,
    Phone,
    Mail,
    ExternalLink,
    Search,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Building2,
    CalendarCheck,
    Download,
    Filter,
    X,
    Copy,
    Check,
    Trash2,
    PlusCircle,
    Edit3,
    User,
    Layers,
    FileText
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../../lib/services/client/supabase";
import {
    fetchSupplierMeetingsAction,
    updateSupplierMeetingStatusAction,
    removeSupplierMeetingAction,
    SupplierMeetingRecord
} from "../../../procurement/server/meeting-actions";
import { SetSupplierMeetingModal } from "../../../procurement/components/SetSupplierMeetingModal";
import { Supplier } from "../../types";

interface SupplierMeetingsTabProps {
    suppliers?: Supplier[];
    onMeetingCountChange?: (count: number) => void;
}

export function SupplierMeetingsTab({
    suppliers = [],
    onMeetingCountChange
}: SupplierMeetingsTabProps) {
    const [meetings, setMeetings] = useState<SupplierMeetingRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<string>("ALL");
    const [filterType, setFilterType] = useState<string>("ALL");
    const [copiedMeetingId, setCopiedMeetingId] = useState<string | null>(null);

    // Modal state for Setting or Updating a Meeting
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState<boolean>(false);
    const [selectedMeetingForEdit, setSelectedMeetingForEdit] = useState<SupplierMeetingRecord | null>(null);
    const [selectedSupplierForNew, setSelectedSupplierForNew] = useState<Supplier | null>(null);
    const [removingMeetingId, setRemovingMeetingId] = useState<string | null>(null);
    const [completingMeetingId, setCompletingMeetingId] = useState<string | null>(null);

    // Fetch meetings
    const loadMeetings = useCallback(async (silent: boolean = false) => {
        if (!silent) setIsLoading(true);
        try {
            let fetchedList: SupplierMeetingRecord[] = [];
            
            // 1. Fetch via elevated server action (bypasses RLS)
            const res = await fetchSupplierMeetingsAction();
            if (res.success && Array.isArray(res.data)) {
                fetchedList = res.data;
            }

            // 2. Client-side fallback if server action returns empty
            if (fetchedList.length === 0) {
                const { data: clientData } = await supabase
                    .from("supplier_meetings")
                    .select("*")
                    .order("meeting_date", { ascending: false })
                    .order("start_time", { ascending: true });
                if (clientData && Array.isArray(clientData)) {
                    fetchedList = clientData as SupplierMeetingRecord[];
                }
            }

            setMeetings(fetchedList);
            onMeetingCountChange?.(fetchedList.filter(m => (m.status || "").toLowerCase() === "scheduled").length);
        } catch (err) {
            console.error("Error loading supplier meetings:", err);
            if (!silent) toast.error("Could not load supplier meetings.");
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [onMeetingCountChange]);

    useEffect(() => {
        loadMeetings(false);

        // Supabase Realtime subscription
        const channel = supabase
            .channel(`supplier_meetings_realtime_${Date.now()}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "supplier_meetings" },
                () => {
                    loadMeetings(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadMeetings]);

    // Copy link helper
    const handleCopyLink = (link: string, id: string) => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopiedMeetingId(id);
        toast.success("Meeting link copied to clipboard!");
        setTimeout(() => setCopiedMeetingId(null), 2500);
    };

    // Download calendar ICS
    const handleDownloadIcs = (meeting: SupplierMeetingRecord) => {
        try {
            const dateStr = (meeting.meeting_date || "").replace(/-/g, "");
            const timeRaw = (meeting.start_time || "10:00").replace(/[^0-9]/g, "").padStart(4, "0");
            const startIso = `${dateStr}T${timeRaw}00Z`;

            const icsContent = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//Airship Express//Procurement Meetings//EN",
                "CALSCALE:GREGORIAN",
                "METHOD:REQUEST",
                "BEGIN:VEVENT",
                `UID:${meeting.id}@airship-express.com`,
                `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
                `DTSTART:${startIso}`,
                `SUMMARY:${meeting.title} - Airship Express Procurement`,
                `DESCRIPTION:${meeting.agenda?.replace(/\n/g, "\\n") || "Supplier Sourcing Session"}\\n\\nOrganizer: ${meeting.organizer_name} (${meeting.organizer_email})`,
                meeting.meeting_link ? `URL:${meeting.meeting_link}` : "",
                meeting.location ? `LOCATION:${meeting.location}` : meeting.meeting_link ? `LOCATION:${meeting.meeting_link}` : "",
                "STATUS:CONFIRMED",
                "END:VEVENT",
                "END:VCALENDAR"
            ].filter(Boolean).join("\r\n");

            const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Meeting-${meeting.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Calendar invite (.ics) downloaded!");
        } catch {
            toast.error("Could not generate calendar invite.");
        }
    };

    // Remove meeting
    const handleRemoveMeeting = async (meetingId: string, supplierName: string) => {
        if (!window.confirm(`Are you sure you want to cancel and remove this scheduled meeting with ${supplierName}?`)) {
            return;
        }

        setRemovingMeetingId(meetingId);
        try {
            const res = await removeSupplierMeetingAction(meetingId);
            if (res.success) {
                toast.success("Meeting removed successfully.");
                loadMeetings(true);
            } else {
                toast.error(res.error || "Failed to remove meeting.");
            }
        } catch (err: any) {
            toast.error(err.message || "An unexpected error occurred.");
        } finally {
            setRemovingMeetingId(null);
        }
    };

    // Mark complete
    const handleMarkComplete = async (meetingId: string) => {
        setCompletingMeetingId(meetingId);
        try {
            const res = await updateSupplierMeetingStatusAction(meetingId, "Completed");
            if (res.success) {
                toast.success("Meeting marked as Completed.");
                loadMeetings(true);
            } else {
                toast.error(res.error || "Failed to update status.");
            }
        } catch (err: any) {
            toast.error(err.message || "An unexpected error occurred.");
        } finally {
            setCompletingMeetingId(null);
        }
    };

    // Statistics computation
    const stats = useMemo(() => {
        const scheduled = meetings.filter(m => (m.status || "").toLowerCase() === "scheduled");
        const completed = meetings.filter(m => (m.status || "").toLowerCase() === "completed");
        const video = meetings.filter(m => (m.meeting_type || "").toLowerCase().includes("video"));
        const onSite = meetings.filter(m => !(m.meeting_type || "").toLowerCase().includes("video"));

        // Today's meetings
        const todayStr = new Date().toISOString().split("T")[0];
        const todayCount = meetings.filter(m => m.meeting_date === todayStr && (m.status || "").toLowerCase() === "scheduled").length;

        return {
            total: meetings.length,
            scheduled: scheduled.length,
            completed: completed.length,
            today: todayCount,
            video: video.length,
            onSite: onSite.length,
        };
    }, [meetings]);

    // Filtering logic
    const filteredMeetings = useMemo(() => {
        return meetings.filter(m => {
            // Status match
            if (filterStatus !== "ALL") {
                const st = (m.status || "").toUpperCase();
                if (filterStatus === "SCHEDULED" && st !== "SCHEDULED") return false;
                if (filterStatus === "COMPLETED" && st !== "COMPLETED") return false;
                if (filterStatus === "CANCELLED" && st !== "CANCELLED") return false;
            }

            // Type match
            if (filterType !== "ALL") {
                const mt = (m.meeting_type || "").toLowerCase();
                if (filterType === "VIDEO" && !mt.includes("video")) return false;
                if (filterType === "ONSITE" && !mt.includes("site") && !mt.includes("person")) return false;
                if (filterType === "PHONE" && !mt.includes("phone")) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const title = (m.title || "").toLowerCase();
                const supName = (m.supplier_name || "").toLowerCase();
                const supEmail = (m.supplier_email || "").toLowerCase();
                const contact = (m.contact_person || "").toLowerCase();
                const reqNum = (m.request_number || "").toLowerCase();
                const item = (m.item_name || "").toLowerCase();
                const organizer = (m.organizer_name || "").toLowerCase();

                return (
                    title.includes(q) ||
                    supName.includes(q) ||
                    supEmail.includes(q) ||
                    contact.includes(q) ||
                    reqNum.includes(q) ||
                    item.includes(q) ||
                    organizer.includes(q)
                );
            }

            return true;
        });
    }, [meetings, filterStatus, filterType, searchQuery]);

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Scheduled / Upcoming */}
                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Upcoming Meetings
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                            <Calendar className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-800 dark:text-white">
                            {stats.scheduled}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                            scheduled sessions
                        </span>
                    </div>
                </div>

                {/* 2. Today's Sessions */}
                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Today&apos;s Sessions
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-800 dark:text-white">
                            {stats.today}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                            due today
                        </span>
                    </div>
                </div>

                {/* 3. Video Conferences */}
                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Video Conferences
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                            <Video className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-800 dark:text-white">
                            {stats.video}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                            virtual meetings
                        </span>
                    </div>
                </div>

                {/* 4. On-Site / Phone Calls */}
                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            On-Site &amp; Completed
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-800 dark:text-white">
                            {stats.completed}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                            completed ({stats.onSite} on-site)
                        </span>
                    </div>
                </div>
            </div>

            {/* Filter and Action Bar */}
            <div className="p-4 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),_5px_5px_12px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),_4px_4px_10px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 flex-wrap">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by supplier, meeting title, agenda, PR #..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#f0f4fa] dark:bg-[#12131e] pl-9 pr-4 py-2 rounded-2xl text-xs font-bold text-slate-800 dark:text-white border-0 shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35),_inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-[#f0f4fa] dark:bg-[#12131e] px-3 py-2 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 border-0 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.3),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="SCHEDULED">Scheduled / Upcoming</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>

                    {/* Meeting Type Filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-[#f0f4fa] dark:bg-[#12131e] px-3 py-2 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 border-0 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.3),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus:outline-none cursor-pointer"
                    >
                        <option value="ALL">All Meeting Types</option>
                        <option value="VIDEO">Video Conferences</option>
                        <option value="ONSITE">On-Site / In-Person</option>
                        <option value="PHONE">Phone Calls</option>
                    </select>
                </div>

                {/* Right Action: Refresh + Set Meeting */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => loadMeetings(false)}
                        disabled={isLoading}
                        className="p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)] transition-all cursor-pointer disabled:opacity-50"
                        title="Reload meetings"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-pink-600" : ""}`} />
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setSelectedMeetingForEdit(null);
                            setSelectedSupplierForNew(null);
                            setIsMeetingModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.6),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Schedule Meeting</span>
                    </button>
                </div>
            </div>

            {/* Meetings Cards Grid */}
            {isLoading ? (
                <div className="p-12 text-center rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/60 dark:border-white/10 shadow-inner flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-pink-600 animate-spin" />
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                        Loading scheduled supplier meetings...
                    </span>
                </div>
            ) : filteredMeetings.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/60 dark:border-white/10 shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),_5px_5px_12px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),_4px_4px_10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                        <CalendarCheck className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white">
                        No Supplier Meetings Found
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                        {searchQuery
                            ? "No meetings match your current search query or filter selection."
                            : "There are no meetings scheduled with suppliers at this time. Click 'Schedule Meeting' above to set an appointment."}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedMeetingForEdit(null);
                            setSelectedSupplierForNew(null);
                            setIsMeetingModalOpen(true);
                        }}
                        className="mt-2 px-4 py-2 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Schedule a Meeting</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredMeetings.map((meeting) => {
                        const isScheduled = (meeting.status || "").toLowerCase() === "scheduled";
                        const isCompleted = (meeting.status || "").toLowerCase() === "completed";
                        const isCancelled = (meeting.status || "").toLowerCase() === "cancelled";
                        const isVideo = (meeting.meeting_type || "").toLowerCase().includes("video");

                        return (
                            <div
                                key={meeting.id}
                                className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-5px_-5px_14px_rgba(255,255,255,0.9),_5px_5px_14px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),_4px_4px_12px_rgba(0,0,0,0.55)] flex flex-col justify-between gap-4 transition-all"
                            >
                                <div className="space-y-3">
                                    {/* Header: Title + Status Badge */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                        isScheduled
                                                            ? "bg-pink-600 text-white"
                                                            : isCompleted
                                                            ? "bg-emerald-600 text-white"
                                                            : "bg-slate-400 text-white"
                                                    }`}
                                                >
                                                    {meeting.status || "Scheduled"}
                                                </span>

                                                <span className="px-2 py-0.5 rounded-md bg-[#e2e8f0] dark:bg-[#1e2030] text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center gap-1">
                                                    {isVideo ? <Video className="w-3 h-3 text-pink-600" /> : <MapPin className="w-3 h-3 text-amber-600" />}
                                                    <span>{meeting.meeting_type}</span>
                                                </span>

                                                {meeting.request_number && (
                                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold">
                                                        #{meeting.request_number}
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug line-clamp-2">
                                                {meeting.title}
                                            </h4>
                                        </div>
                                    </div>

                                    {/* Supplier Information Card */}
                                    <div className="p-3 rounded-2xl bg-[#f0f4fa] dark:bg-[#12131e] border border-white/60 dark:border-white/5 space-y-1.5 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.3),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <Building2 className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                                                <span className="font-black text-slate-800 dark:text-white truncate">
                                                    {meeting.supplier_name}
                                                </span>
                                            </div>
                                            {meeting.supplier_id && (
                                                <span className="text-[10px] font-mono font-bold text-slate-400">
                                                    ID: #{meeting.supplier_id}
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="truncate">{meeting.supplier_email}</span>
                                            </div>
                                            {(meeting.contact_phone || meeting.contact_person) && (
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span className="truncate">
                                                        {meeting.contact_phone || meeting.contact_person}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Date, Time, Location / Link Bar */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                            <Calendar className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                                            <span className="font-bold">
                                                {meeting.meeting_date}
                                            </span>
                                            <span className="text-slate-400">@</span>
                                            <span className="font-bold">
                                                {meeting.start_time}
                                            </span>
                                            {meeting.duration && (
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    ({meeting.duration})
                                                </span>
                                            )}
                                        </div>

                                        {meeting.meeting_link ? (
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <Video className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                                                <a
                                                    href={meeting.meeting_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-bold text-pink-600 hover:text-pink-700 hover:underline truncate text-[11px]"
                                                    title={meeting.meeting_link}
                                                >
                                                    {meeting.meeting_link.replace(/^https?:\/\//, "")}
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyLink(meeting.meeting_link!, meeting.id)}
                                                    className="p-1 text-slate-400 hover:text-pink-600 transition-colors"
                                                    title="Copy link"
                                                >
                                                    {copiedMeetingId === meeting.id ? (
                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>
                                        ) : meeting.location ? (
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                <span className="truncate">{meeting.location}</span>
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Agenda Preview */}
                                    {meeting.agenda && (
                                        <div className="p-3 rounded-2xl bg-[#ebf0f7]/70 dark:bg-[#141522] border border-slate-200/50 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                Discussion Agenda &amp; Objectives:
                                            </div>
                                            <p className="line-clamp-2 text-[11px] leading-relaxed whitespace-pre-line text-slate-600 dark:text-slate-300">
                                                {meeting.agenda}
                                            </p>
                                        </div>
                                    )}

                                    {/* Organizer Info */}
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
                                        <div className="flex items-center gap-1.5">
                                            <User className="w-3 h-3 text-slate-400" />
                                            <span>Organizer: <strong>{meeting.organizer_name}</strong></span>
                                        </div>
                                        {meeting.item_name && (
                                            <span className="truncate max-w-[150px] font-medium text-slate-600 dark:text-slate-300">
                                                Item: {meeting.item_name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Card Actions Footer */}
                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        {meeting.meeting_link && (
                                            <a
                                                href={meeting.meeting_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Video className="w-3.5 h-3.5" />
                                                <span>Join Call</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => handleDownloadIcs(meeting)}
                                            className="px-2.5 py-1.5 rounded-xl bg-[#e8eef6] dark:bg-[#181a29] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold transition-all border border-white/60 dark:border-white/5 flex items-center gap-1.5 cursor-pointer shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_4px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.4)] active:shadow-inner"
                                            title="Download calendar file (.ics)"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span>.ICS</span>
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {/* Update Button */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedMeetingForEdit(meeting);
                                                setSelectedSupplierForNew(null);
                                                setIsMeetingModalOpen(true);
                                            }}
                                            className="px-2.5 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 border border-pink-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_4px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.4)] active:shadow-inner"
                                            title="Update meeting schedule"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            <span>Update</span>
                                        </button>

                                        {/* Mark Completed Button */}
                                        {isScheduled && (
                                            <button
                                                type="button"
                                                onClick={() => handleMarkComplete(meeting.id)}
                                                disabled={completingMeetingId === meeting.id || removingMeetingId === meeting.id}
                                                className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 border border-emerald-500/30 text-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_4px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.4)] active:shadow-inner"
                                                title="Mark meeting as Completed"
                                            >
                                                {completingMeetingId === meeting.id ? (
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                                ) : (
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        )}

                                        {/* Remove / Cancel Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveMeeting(meeting.id, meeting.supplier_name)}
                                            disabled={removingMeetingId === meeting.id || completingMeetingId === meeting.id}
                                            className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:text-rose-700 border border-rose-500/30 text-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_4px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.4)] active:shadow-inner"
                                            title="Cancel and remove meeting"
                                        >
                                            {removingMeetingId === meeting.id ? (
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                                            ) : (
                                                <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Set / Update Supplier Meeting Modal */}
            <SetSupplierMeetingModal
                isOpen={isMeetingModalOpen}
                onClose={() => {
                    setIsMeetingModalOpen(false);
                    setSelectedMeetingForEdit(null);
                    setSelectedSupplierForNew(null);
                }}
                meeting={selectedMeetingForEdit}
                supplier={selectedSupplierForNew ? {
                    id: selectedSupplierForNew.id,
                    dbSupplierId: Number(selectedSupplierForNew.id),
                    name: selectedSupplierForNew.name,
                    email: selectedSupplierForNew.email,
                    phone: selectedSupplierForNew.phone,
                    contact_person: selectedSupplierForNew.contact_person,
                } : selectedMeetingForEdit ? {
                    id: selectedMeetingForEdit.supplier_id || undefined,
                    name: selectedMeetingForEdit.supplier_name,
                    email: selectedMeetingForEdit.supplier_email,
                    phone: selectedMeetingForEdit.contact_phone || undefined,
                    contact_person: selectedMeetingForEdit.contact_person || undefined,
                } : null}
                onMeetingScheduled={() => {
                    setIsMeetingModalOpen(false);
                    setSelectedMeetingForEdit(null);
                    setSelectedSupplierForNew(null);
                    loadMeetings(true);
                }}
                onMeetingRemoved={() => {
                    setIsMeetingModalOpen(false);
                    setSelectedMeetingForEdit(null);
                    setSelectedSupplierForNew(null);
                    loadMeetings(true);
                }}
            />
        </div>
    );
}
