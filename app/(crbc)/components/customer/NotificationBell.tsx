"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  XCircle,
  X,
  Truck,
  PackageCheck,
  FileText,
  MessageSquareWarning,
  MessageSquareMore,
  MessageSquareCheck,
  MessageSquareX,
} from "lucide-react";
import { getNotificationsAction } from "../../actions/notifications";
import type { CustomerNotification, NotificationKind } from "../../services/notification.service";

const KIND_CONFIG: Record<NotificationKind, { icon: React.ElementType; iconClass: string; dotClass: string }> = {
  request_accepted:   { icon: CheckCircle2,         iconClass: "text-emerald-500", dotClass: "bg-emerald-500" },
  request_rejected:   { icon: XCircle,              iconClass: "text-red-500",     dotClass: "bg-red-500" },
  request_cancelled:  { icon: X,                    iconClass: "text-zinc-400",    dotClass: "bg-zinc-400" },
  shipment_updated:   { icon: Truck,                iconClass: "text-blue-500",    dotClass: "bg-blue-500" },
  shipment_delivered: { icon: PackageCheck,         iconClass: "text-emerald-500", dotClass: "bg-emerald-500" },
  pod_available:      { icon: FileText,             iconClass: "text-purple-500",  dotClass: "bg-purple-500" },
  concern_created:    { icon: MessageSquareWarning, iconClass: "text-amber-500",   dotClass: "bg-amber-500" },
  concern_updated:    { icon: MessageSquareMore,    iconClass: "text-blue-500",    dotClass: "bg-blue-500" },
  concern_resolved:   { icon: MessageSquareCheck,   iconClass: "text-emerald-500", dotClass: "bg-emerald-500" },
  concern_closed:     { icon: MessageSquareX,       iconClass: "text-zinc-400",    dotClass: "bg-zinc-400" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle() {
    if (!open && !loaded) {
      startTransition(async () => {
        const result = await getNotificationsAction();
        setNotifications(result);
        setLoaded(true);
      });
    }
    setOpen((o) => !o);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const todayItems = notifications.filter((n) => isToday(n.at));
  const earlierItems = notifications.filter((n) => !isToday(n.at));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative p-2 rounded-md text-muted hover:text-foreground hover:bg-line/50 transition-colors cursor-pointer"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-line bg-background shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                {unreadCount} new
              </span>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto">
            {isPending ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell size={18} className="text-muted mb-2" />
                <p className="text-sm font-medium text-foreground">All caught up</p>
                <p className="mt-0.5 text-xs text-muted">No updates yet.</p>
              </div>
            ) : (
              <>
                {todayItems.length > 0 && (
                  <div>
                    <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Today</p>
                    {todayItems.map((n) => <NotifItem key={n.id} n={n} onClose={() => setOpen(false)} />)}
                  </div>
                )}
                {earlierItems.length > 0 && (
                  <div>
                    <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Earlier</p>
                    {earlierItems.map((n) => <NotifItem key={n.id} n={n} onClose={() => setOpen(false)} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({ n, onClose }: { n: CustomerNotification; onClose: () => void }) {
  const cfg = KIND_CONFIG[n.kind];
  const Icon = cfg.icon;

  return (
    <Link
      href={n.href}
      onClick={onClose}
      className="flex items-start gap-3 px-4 py-3 hover:bg-foreground/[0.04] transition-colors"
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]">
        <Icon size={13} className={cfg.iconClass} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground leading-snug">{n.title}</p>
        <p className="mt-0.5 text-[11px] text-muted leading-relaxed line-clamp-2">{n.detail}</p>
        <p className="mt-1 text-[10px] text-muted/70">{relativeTime(n.at)}</p>
      </div>
      {!n.read && (
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dotClass}`} />
      )}
    </Link>
  );
}
