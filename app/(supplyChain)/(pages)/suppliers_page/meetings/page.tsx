// app/(supplyChain)/(pages)/suppliers_page/meetings/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    Calendar, 
    Clock, 
    Video, 
    MapPin, 
    Phone, 
    User, 
    Mail, 
    ExternalLink, 
    Search, 
    RefreshCw, 
    CheckCircle2, 
    AlertCircle, 
    Building2, 
    Sparkles, 
    CalendarCheck, 
    Download, 
    Layers, 
    Filter, 
    X, 
    ArrowUpRight,
    MessageSquare,
    Copy,
    Check
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { user } from "../../../lib/services/Class/user";
import { supabase } from "../../../lib/services/client/supabase";
import { fetchSupplierMeetingsAction, SupplierMeetingRecord } from "../../procurement/server/meeting-actions";

export default function SupplierMeetingsPage() {
    const [meetings, setMeetings] = useState<SupplierMeetingRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<string>("ALL");
    const [filterType, setFilterType] = useState<string>("ALL");
    const [copiedMeetingId, setCopiedMeetingId] = useState<string | null>(null);

    // Current logged-in supplier info
    const [supplierAccount, setSupplierAccount] = useState<any>(null);
    const currentUserEmail = user.getEmail();

    const fetchMeetingsData = async () => {
        setIsLoading(true);
        try {
            const activeEmail = currentUserEmail || user.getEmail();
            let supId: any = null;

            if (activeEmail) {
                const { data: acc } = await supabase
                    .from("suppliers_account")
                    .select("*, suppliers(*)")
                    .eq("email", activeEmail)
                    .maybeSingle();

                if (acc) {
                    setSupplierAccount(acc);
                    supId = acc.supplier_id;
                }
            }

            // Query server action
            const queryParam = supId ? String(supId) : (activeEmail || "");
            const res = await fetchSupplierMeetingsAction(queryParam);

            if (res.success && res.data) {
                setMeetings(res.data);
            } else {
                setMeetings([]);
            }
        } catch (err) {
            console.error("Error fetching supplier meetings:", err);
            toast.error("Could not load scheduled meetings");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMeetingsData();
    }, [currentUserEmail]);

    // Copy link helper
    const handleCopyLink = (link: string, id: string) => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopiedMeetingId(id);
        toast.success("Meeting link copied to clipboard");
        setTimeout(() => setCopiedMeetingId(null), 2500);
    };

    // Generate .ICS file for downloading to calendar
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
                `DESCRIPTION:${meeting.agenda?.replace(/\n/g, "\\n") || "Procurement and Sourcing Session"}\\n\\nOrganizer: ${meeting.organizer_name} (${meeting.organizer_email})`,
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
            toast.success("Calendar invite (.ics) downloaded");
        } catch (e) {
            console.error("Failed to generate .ics file:", e);
            toast.error("Could not generate calendar invite");
        }
    };

    // Filtered meetings
    const filteredMeetings = useMemo(() => {
        return meetings.filter((m) => {
            // Status match
            if (filterStatus !== "ALL") {
                if (filterStatus === "UPCOMING" && m.status !== "Scheduled") return false;
                if (filterStatus === "COMPLETED" && m.status !== "Completed") return false;
                if (filterStatus === "CANCELLED" && m.status !== "Cancelled") return false;
            }

            // Type match
            if (filterType !== "ALL" && m.meeting_type !== filterType) {
                return false;
            }

            // Search query match
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const titleMatch = (m.title || "").toLowerCase().includes(q);
                const agendaMatch = (m.agenda || "").toLowerCase().includes(q);
                const organizerMatch = (m.organizer_name || "").toLowerCase().includes(q);
                const itemMatch = (m.item_name || "").toLowerCase().includes(q);
                const reqMatch = (m.request_number || "").toLowerCase().includes(q);
                return titleMatch || agendaMatch || organizerMatch || itemMatch || reqMatch;
            }

            return true;
        });
    }, [meetings, filterStatus, filterType, searchQuery]);

    // Metric counts
    const counts = useMemo(() => {
        const upcoming = meetings.filter((m) => m.status === "Scheduled").length;
        const completed = meetings.filter((m) => m.status === "Completed").length;
        const total = meetings.length;
        return { upcoming, completed, total };
    }, [meetings]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header section */}
            <div className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-slate-200/80 dark:border-white/10">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/[0.06] flex items-center justify-center text-pink-600 dark:text-pink-400 text-xl shrink-0 mt-0.5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)]">
                        <Calendar className="w-6 h-6 drop-shadow" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                Meetings &amp; Negotiations Hub
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                Live Sync
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                            Scheduled video calls, technical inquiries, and proposal evaluation meetings with Airship Express buyers.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={fetchMeetingsData}
                        disabled={isLoading}
                        className="px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#1a1c2c] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold transition-all shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] border border-white/60 dark:border-white/[0.06] cursor-pointer flex items-center gap-2"
                        title="Reload meetings"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-pink-500" : ""}`} />
                        <span className="text-xs font-black">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Upcoming Meetings</p>
                            <p className="text-2xl font-black text-pink-600 dark:text-pink-400 mt-0.5">{counts.upcoming}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                            <Video className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Completed Sessions</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{counts.completed}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Recorded</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{counts.total}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                            <CalendarCheck className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-[#ebf0f7] dark:bg-[#161826] p-3 rounded-2xl border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)]">
                {/* Search input */}
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search meetings by title, agenda, buyer or item..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-[#e3e9f3] dark:bg-[#10121d] text-slate-800 dark:text-slate-200 placeholder-slate-400 border border-slate-300/60 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 focus:ring-pink-500/40"
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

                {/* Status Tabs */}
                <div className="flex items-center gap-1 bg-[#e3e9f3] dark:bg-[#10121d] p-1 rounded-xl shadow-[inset_1px_1px_3px_rgba(163,177,198,0.35)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                    {(["ALL", "UPCOMING", "COMPLETED", "CANCELLED"] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setFilterStatus(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                filterStatus === tab
                                    ? "bg-white dark:bg-[#1a1c2c] text-pink-600 dark:text-pink-400 shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            {tab === "ALL" ? "All" : tab === "UPCOMING" ? "Upcoming" : tab === "COMPLETED" ? "Completed" : "Cancelled"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Meetings Grid / List */}
            {isLoading ? (
                <div className="p-12 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 flex flex-col items-center justify-center text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-pink-500 animate-spin" />
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200">Loading scheduled meetings...</p>
                    <p className="text-xs text-slate-400">Synchronizing with Airship Express procurement schedule</p>
                </div>
            ) : filteredMeetings.length === 0 ? (
                <div className="p-12 sm:p-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 flex flex-col items-center justify-center text-center space-y-4 shadow-[-4px_-4px_12px_rgba(255,255,255,0.9),_4px_4px_12px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)]">
                    <div className="w-16 h-16 rounded-3xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
                        <Calendar className="w-8 h-8 drop-shadow" />
                    </div>
                    <div className="space-y-1 max-w-md">
                        <h4 className="font-black text-base sm:text-lg text-slate-800 dark:text-slate-100">
                            No Meetings Scheduled
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {searchQuery || filterStatus !== "ALL"
                                ? "No meetings match your selected filter criteria. Try clearing search filters."
                                : "When the Airship Express procurement team sets up quotation reviews, technical inquiries, or contract discussions, they will appear here with live video call links."}
                        </p>
                    </div>
                    {(searchQuery || filterStatus !== "ALL") && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setFilterStatus("ALL");
                            }}
                            className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
                        >
                            Reset All Filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredMeetings.map((meeting) => {
                        const isScheduled = meeting.status === "Scheduled";
                        const isCompleted = meeting.status === "Completed";
                        const isCancelled = meeting.status === "Cancelled";

                        return (
                            <div
                                key={meeting.id}
                                className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_12px_rgba(255,255,255,0.9),_4px_4px_12px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)] flex flex-col justify-between space-y-4 transition-transform hover:-translate-y-0.5 duration-200"
                            >
                                <div className="space-y-3">
                                    {/* Top Status & Type Badges */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {/* Meeting Type */}
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-pink-500/10 text-pink-700 dark:text-pink-300 border border-pink-500/20 shadow-[-1px_-1px_3px_rgba(255,255,255,0.6),_1px_1px_3px_rgba(236,72,153,0.15)]">
                                                {meeting.meeting_type === "Video Conference" ? (
                                                    <Video className="w-3 h-3 text-pink-500" />
                                                ) : meeting.meeting_type === "On-Site / In-Person" ? (
                                                    <MapPin className="w-3 h-3 text-pink-500" />
                                                ) : (
                                                    <Phone className="w-3 h-3 text-pink-500" />
                                                )}
                                                <span>{meeting.meeting_type}</span>
                                            </span>

                                            {/* Duration Pill */}
                                            {meeting.duration && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-500 bg-[#e2e8f2] dark:bg-[#12131d]">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{meeting.duration}</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Status badge */}
                                        <span
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black ${
                                                isScheduled
                                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                                    : isCompleted
                                                    ? "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-400/30"
                                                    : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                            }`}
                                        >
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    isScheduled ? "bg-emerald-500 animate-pulse" : isCompleted ? "bg-slate-400" : "bg-rose-500"
                                                }`}
                                            />
                                            <span>{meeting.status}</span>
                                        </span>
                                    </div>

                                    {/* Meeting Title & Item info */}
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                                            {meeting.title}
                                        </h3>
                                        {(meeting.item_name || meeting.request_number) && (
                                            <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-pink-600 dark:text-pink-400">
                                                <Layers className="w-3 h-3" />
                                                <span>
                                                    {meeting.request_number ? `${meeting.request_number} • ` : ""}
                                                    {meeting.item_name || "Requisition Item"}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Date and Time Box */}
                                    <div className="p-3 rounded-2xl bg-[#e3e9f3] dark:bg-[#11131e] border border-slate-300/60 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                                                    {new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString(undefined, {
                                                        weekday: "short",
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
                                                </p>
                                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                    {meeting.start_time} {meeting.end_time ? `- ${meeting.end_time}` : ""}{" "}
                                                    <span className="text-[10px] text-slate-400">({meeting.timezone || "PST"})</span>
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDownloadIcs(meeting)}
                                            className="p-2 rounded-xl bg-[#ebf0f7] dark:bg-[#181a29] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] transition-all cursor-pointer"
                                            title="Add to Google / Outlook Calendar (.ics)"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Agenda / Topic details */}
                                    {meeting.agenda && (
                                        <div className="text-xs text-slate-600 dark:text-slate-300 bg-[#e8eef6]/60 dark:bg-[#181a29]/60 p-2.5 rounded-xl border border-slate-200/50 dark:border-white/[0.04] leading-relaxed">
                                            <span className="font-bold text-slate-700 dark:text-slate-200 block text-[10px] uppercase tracking-wider mb-0.5">
                                                Meeting Agenda &amp; Discussion Points:
                                            </span>
                                            {meeting.agenda}
                                        </div>
                                    )}

                                    {/* Organizer Info */}
                                    <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/50 dark:border-white/[0.04]">
                                        <div className="flex items-center gap-1.5">
                                            <User className="w-3 h-3 text-slate-400" />
                                            <span>
                                                Organizer: <strong className="text-slate-700 dark:text-slate-300">{meeting.organizer_name}</strong>
                                            </span>
                                        </div>
                                        <a
                                            href={`mailto:${meeting.organizer_email}?subject=Regarding Meeting: ${encodeURIComponent(meeting.title)}`}
                                            className="text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 font-bold"
                                        >
                                            <Mail className="w-3 h-3" />
                                            <span>Email Buyer</span>
                                        </a>
                                    </div>
                                </div>

                                {/* Bottom Action Row */}
                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between gap-2 flex-wrap">
                                    {meeting.meeting_link ? (
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <a
                                                href={meeting.meeting_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-[-2px_-2px_6px_rgba(255,255,255,0.4),_2px_2px_8px_rgba(236,72,153,0.35)] cursor-pointer"
                                            >
                                                <Video className="w-3.5 h-3.5" />
                                                <span>Join Video Call</span>
                                                <ExternalLink className="w-3 h-3 ml-0.5" />
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyLink(meeting.meeting_link!, meeting.id)}
                                                className="p-2 rounded-xl bg-[#ebf0f7] dark:bg-[#181a29] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] transition-all cursor-pointer"
                                                title="Copy meeting video link"
                                            >
                                                {copiedMeetingId === meeting.id ? (
                                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    ) : meeting.location ? (
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                            <MapPin className="w-3.5 h-3.5 text-pink-500" />
                                            <span>Location: {meeting.location}</span>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-400 italic">No external link required</div>
                                    )}

                                    <div className="text-[10px] text-slate-400 font-medium">
                                        ID: {meeting.id.slice(0, 8).toUpperCase()}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
