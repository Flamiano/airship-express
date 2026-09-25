"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Check, CheckCheck, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { formatDateTime } from "@/performance-development-dashboard/lib/format/date";
import type { PerDevNotification } from "@/performance-development-dashboard/types";

const API_BASE =
  "/performance-development-dashboard/api/performance/notifications";

/**
 * Module-level fallback for historical notifications stored without a link.
 * Record-level links are stored on new notifications; anything older (or
 * with unrecognized metadata) resolves to its module page — never a guessed
 * record id, and never the generic Dashboard. Unknown types navigate
 * nowhere: the notification is still marked read and the menu closes.
 */
function fallbackPathForType(type: string): string | null {
  if (type.startsWith("appraisal.")) {
    return "/performance-development-dashboard/appraisals";
  }
  if (type.startsWith("checkin.")) {
    return "/performance-development-dashboard/check-ins";
  }
  if (type.startsWith("goal.")) {
    return "/performance-development-dashboard/goals";
  }
  return null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(iso);
}

const emptySubscribe = () => () => {};
const useBrowserOnly = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

export function PerDevNotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PerDevNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const mounted = useBrowserOnly();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    try {
      await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      /* silent */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/read-all`, {
        method: "PATCH",
        credentials: "include",
      });
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) =>
          n.is_read ? n : { ...n, is_read: true, read_at: now },
        ),
      );
      setUnreadCount(0);
    } catch {
      /* silent */
    }
  }, []);

  /* Initial load — fire once on mount. */
  /* eslint-disable react-hooks/set-state-in-effect -- mount-only async fetch */
  useEffect(() => {
    void fetchNotifications();
  }, []);

  /* Close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  /* Refresh on open */
  useEffect(() => {
    if (isOpen) void fetchNotifications();
  }, [isOpen]); /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * Activates one notification: marks it read (existing per-item behavior),
   * then navigates to its record link, or to the module fallback when the
   * stored notification predates record links. router.push preserves SPA
   * navigation so browser Back returns to the previous location.
   */
  const activateNotification = useCallback(
    (notif: PerDevNotification) => {
      if (!notif.is_read) void markOneRead(notif.id);
      const destination =
        notif.link ?? fallbackPathForType(notif.type);
      setIsOpen(false);
      if (destination) router.push(destination);
    },
    [markOneRead, router],
  );

  if (!mounted) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-ink"
      >
        {unreadCount > 0 ? (
          <>
            <Bell size={17} strokeWidth={1.75} />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-paper">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </>
        ) : (
          <BellOff size={17} strokeWidth={1.75} />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-12 z-50 w-80 max-h-[480px] overflow-hidden rounded-xl border border-line bg-paper shadow-lg dark:border-paper/15"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-[13px] font-semibold text-ink">
                Notifications
              </p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11.5px] font-medium text-accent transition-colors hover:text-accent-dark"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
            </div>

            {/* Body */}
            <div className="overflow-y-auto max-h-[400px]">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-1 py-10 text-center">
                  <BellOff size={20} className="text-muted/50" />
                  <p className="text-[12.5px] text-muted">
                    No notifications yet
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => activateNotification(notif)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        activateNotification(notif);
                      }
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.03] dark:hover:bg-paper/[0.06]",
                      !notif.is_read && "bg-accent/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                        notif.is_read ? "bg-transparent" : "bg-accent",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[12.5px] leading-snug",
                          notif.is_read ? "text-muted" : "font-medium text-ink",
                        )}
                      >
                        {notif.title}
                      </p>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-muted line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="mt-1 text-[10.5px] text-muted/70">
                        {relativeTime(notif.created_at)}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markOneRead(notif.id);
                        }}
                        className="mt-0.5 shrink-0 rounded p-0.5 text-muted transition-colors hover:text-accent"
                        aria-label="Mark as read"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
