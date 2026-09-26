"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentRole, getDashboardRouteForRole, getRoleForAuthUser } from "../../lib/roleAccess";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import ThemeToggle from "../../components/ThemeToggle";
import { persistFtmSettings, readFtmSettings, useFtmSettings, type FtmSystemSettings } from "../../components/FtmSettingsProvider";
import { supabase } from "../../lib/supabaseClient";
import { canRegisterPasskeyForDevice, getOtpExpirationPolicy, getPasskeyDeviceLimitMessage, getUserFriendlyAuthError, recordPasskeyUserOnDevice, updateOtpExpirationPolicy } from "../../lib/auth";
import { useFtmProfileAvatar } from "../../components/FtmProfileAvatarProvider";
import FtmProfileAvatar from "../../components/FtmProfileAvatar";
import { exportSystemBackup, getAdminUsers, getBookings, getDrivers, getTrips } from "../../lib/api";
import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

// Tabs were consolidated: Tracking + Map + Operations -> "mapOperations"
// (they were three near-identical map/display-preference screens);
// Accessibility -> folded into Appearance (it only duplicated the
// reduce-motion toggle); Sessions -> folded into Security (it was a
// dead end with no real functionality of its own).
type TabKey =
  | "overview"
  | "general"
  | "appearance"
  | "security"
  | "notifications"
  | "privacy"
  | "mapOperations"
  | "data"
  | "about"
  | "workspace"
  | "activity";

type NotificationPrefs = FtmSystemSettings["notifications"];
type BackupSchedule = FtmSystemSettings["dataBackups"];
type BackupDownloadKind = "system" | "account";

function nextBackupRun(frequency: "daily" | "weekly" | "monthly" | "yearly") {
  const next = new Date();
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  return next.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type AlertPrefs = {
  leadTimeMinutes: "5" | "10" | "15" | "30";
  escalateUnacknowledged: boolean;
};

type ActivityEntry = {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
};

type DispatchLoad = {
  id: string;
  route: string;
  driver: string;
  status: "En Route" | "Loading" | "Delayed" | "Delivered";
  eta: string;
};

type ManagedUser = {
  id: string;
  name: string;
  role: string;
  status: "Active" | "Invited" | "Suspended";
};

type SystemUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

type SecuritySettingKey = keyof FtmSystemSettings["security"];
type SecuritySettings = FtmSystemSettings["security"];

type SecurityModal = "password" | "sessions" | null;

type PasskeyDevice = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

function formatPasskeyDate(value?: string) {
  if (!value) return "Not used yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const SECURITY_SETTINGS_STORAGE_KEY = "ftm-security-settings";
const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  rbacEnabled: true,
  passkeyMode: "software",
  otpLifetimeSeconds: 60,
  hashFunction: "Argon2id",
  sessionTimeoutMinutes: 5,
  lockoutThreshold: 5,
  lockoutDurationMinutes: 15,
  maxUsersPerDevice: 1,
};

/* ------------------------------------------------------------------ */
/*  Soft 3D / Inflated Styling Helpers                               */
/* ------------------------------------------------------------------ */

// Soft UI inflated card effect
const INFLATED_CARD =
  "settings-soft-card rounded-[28px] border border-white/80 bg-gradient-to-b from-white/95 to-pink-50/35 p-6 shadow-[0_16px_34px_rgba(190,24,93,0.08),inset_1px_1px_0_rgba(255,255,255,1),inset_-4px_-6px_12px_rgba(244,114,182,0.12)] backdrop-blur-md";

// Soft UI button/pill standard
const INFLATED_BUTTON =
  "settings-soft-button transition-all duration-200 active:scale-95 shadow-[0_7px_16px_rgba(190,24,93,0.1),inset_1px_1px_0_rgba(255,255,255,0.85),inset_-2px_-3px_6px_rgba(190,24,93,0.08)]";

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "En Route": "bg-blue-100/80 text-blue-800 border-blue-200/60 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]",
    Loading: "bg-amber-100/80 text-amber-800 border-amber-200/60 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]",
    Delayed: "bg-rose-100/80 text-rose-800 border-rose-200/60 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]",
    Delivered: "bg-emerald-100/80 text-emerald-800 border-emerald-200/60 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]",
    Active: "bg-emerald-100/80 text-emerald-800 border-emerald-200/60 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]",
    Invited: "bg-blue-100/80 text-blue-800 border-blue-200/60 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]",
    Suspended: "bg-rose-100/80 text-rose-800 border-rose-200/60 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${
        styles[status] ?? "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[28px] border border-white/90 bg-gradient-to-b from-white to-slate-50 p-5 shadow-[0_10px_24px_rgba(148,163,184,0.1),inset_1.5px_1.5px_0_rgba(255,255,255,1),inset_-4px_-5px_10px_rgba(203,213,225,0.2)]">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-800 tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p>}
    </div>
  );
}

function SecurityControlCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className={INFLATED_CARD}>
      <div className="mb-4">
        <h3 className="text-base font-black text-slate-800">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed font-medium text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function InflatedToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={`relative inline-flex h-7 w-12 items-center rounded-full p-1 transition-colors duration-200 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15)] ${
        checked ? "bg-pink-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.2)] transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SoftModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className={`relative z-10 w-full max-w-md ${INFLATED_CARD}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className={`rounded-[14px] bg-white px-2.5 py-1.5 text-xs font-black text-slate-600 ${INFLATED_BUTTON}`}>
            Close
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  const { settings, updateSettings, resetPersonalization } = useFtmSettings();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supportedTabs: TabKey[] = ["overview", "general", "appearance", "security", "notifications", "privacy", "mapOperations", "data", "about", "workspace", "activity"];
  const requestedTab = searchParams.get("tab") as TabKey | null;
  const activeTab = requestedTab && supportedTabs.includes(requestedTab) ? requestedTab : "security";
  const [role, setRole] = useState<string>("User");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("account@airship.com");
  const [displayName, setDisplayName] = useState("Account");
  const { avatarUrl, previewUrl, pendingImage, busy: avatarBusy, progress: avatarProgress, error: avatarError, chooseFile, save: saveAvatar, remove: removeAvatar } = useFtmProfileAvatar();
  const [openSectionGroup, setOpenSectionGroup] = useState<string | null>(null);

  const selectTab = (tab: TabKey) => {
    const matchedGroup = sectionGroups.find((group) => group.items.some(([key]) => key === tab))?.label ?? null;
    setOpenSectionGroup(matchedGroup);
    router.replace(`${pathname}?tab=${encodeURIComponent(tab)}`, { scroll: false });
  };

  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(displayName);
  const [tempEmail, setTempEmail] = useState(email);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationPrefs>(() => readFtmSettings().notifications);
  const [backupSchedule, setBackupSchedule] = useState<BackupSchedule>(() => readFtmSettings().dataBackups);
  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>(() => {
    const defaults: AlertPrefs = { leadTimeMinutes: "15", escalateUnacknowledged: true };
    if (typeof window === "undefined") return defaults;
    try { return { ...defaults, ...JSON.parse(window.localStorage.getItem("ftm-alert-preferences") || "{}") }; } catch { return defaults; }
  });
  const [generalPreferences, setGeneralPreferences] = useState(() => readFtmSettings().preferences);
  const [reducedMotion, setReducedMotion] = useState(() => readFtmSettings().appearance.reducedMotion);
  const [advancedPreferences, setAdvancedPreferences] = useState(() => {
    const synced = readFtmSettings();
    return {
      profileVisibility: synced.privacy.profileVisibility,
      locationTracking: synced.privacy.locationTracking,
      activeTripTracking: synced.privacy.activeTripTracking,
      mapView: synced.operations.mapView,
      tripFilter: synced.operations.tripFilter,
      vehicleMarkers: synced.operations.vehicleMarkers,
      driverMarkers: synced.operations.driverMarkers,
      routeLines: synced.operations.routeLines,
      courierWaypoints: synced.operations.courierWaypoints,
      autoCenter: synced.operations.autoCenter,
    };
  });

  // Workspace data
  const [dispatchQueue, setDispatchQueue] = useState<DispatchLoad[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"good" | "bad">("good");
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(() => {
    const synced = readFtmSettings();
    const saved = { ...DEFAULT_SECURITY_SETTINGS, ...synced.security };
    return { ...saved, rbacEnabled: true, passkeyMode: "software" };
  });
  const securitySettingsRef = useRef(securitySettings);

  useEffect(() => {
    securitySettingsRef.current = securitySettings;
  }, [securitySettings]);

  // Personal account security (available to every role, not just admins)
  const [securityModal, setSecurityModal] = useState<SecurityModal>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyDevices, setPasskeyDevices] = useState<PasskeyDevice[]>([]);
  const [passkeyActionId, setPasskeyActionId] = useState<string | null>(null);
  const [passkeyRegistrationOpen, setPasskeyRegistrationOpen] = useState(false);
  const [passkeyAccountConfirmed, setPasskeyAccountConfirmed] = useState(false);
  const [selectedSystemUserIds, setSelectedSystemUserIds] = useState<string[]>([]);
  const [pendingSystemUserIds, setPendingSystemUserIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(window.localStorage.getItem("ftm-pending-passkey-users") || "[]");
      return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  const [backupVerificationOpen, setBackupVerificationOpen] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupDownloadKind, setBackupDownloadKind] = useState<BackupDownloadKind>("system");

  const updateSecuritySetting = useCallback(
    <K extends SecuritySettingKey>(key: K, value: SecuritySettings[K]) => {
      const nextState = { ...securitySettingsRef.current, [key]: value } as SecuritySettings;
      setSecuritySettings(nextState);

      const providerSettings = readFtmSettings();
      const providerNext = { ...providerSettings, security: { ...providerSettings.security, ...nextState } };

      window.localStorage.setItem(SECURITY_SETTINGS_STORAGE_KEY, JSON.stringify(nextState));
      persistFtmSettings(providerNext);
      window.dispatchEvent(new CustomEvent("ftm:security-settings-changed", { detail: nextState }));
      updateSettings("security", nextState);
    },
    [updateSettings]
  );

  const updateOtpExpiration = async (seconds: number) => {
    const previousValue = securitySettings.otpLifetimeSeconds;
    updateSecuritySetting("otpLifetimeSeconds", seconds);

    try {
      const result = await updateOtpExpirationPolicy(seconds);
      updateSecuritySetting("otpLifetimeSeconds", result.otpLifetimeSeconds);
      showToast(`OTP expiration is now ${result.otpLifetimeSeconds / 60} minute${result.otpLifetimeSeconds === 60 ? "" : "s"} for all FTM sign-ins.`);
    } catch (error) {
      updateSecuritySetting("otpLifetimeSeconds", previousValue);
      showToast(error instanceof Error ? error.message : "Unable to update the OTP expiration policy.", "bad");
    }
  };

  const showToast = useCallback((message: string, tone: "good" | "bad" = "good") => {
    setStatusMessage(message);
    setStatusTone(tone);
    setTimeout(() => setStatusMessage(null), 4000);
  }, []);

  const loadPasskeyDevices = useCallback(async () => {
    const { data: passkeys, error } = await supabase.auth.passkey.list();
    if (error) {
      showToast(error.message || "Unable to load registered passkeys.", "bad");
      return [];
    }

    const devices = Array.isArray(passkeys) ? (passkeys as PasskeyDevice[]) : [];
    setPasskeyDevices(devices);
    return devices;
  }, [showToast]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      try {
        const policy = await getOtpExpirationPolicy();
        if ([60, 120, 240, 300, 600].includes(policy.otpLifetimeSeconds)) {
          updateSecuritySetting("otpLifetimeSeconds", policy.otpLifetimeSeconds);
        }
      } catch {
        // Keep the local value when the policy endpoint is temporarily unavailable.
      }
      const savedEmail = window.localStorage.getItem("email") || "account@airship.com";
      const savedName = window.localStorage.getItem("displayName") || "Account";
      const nextEmail = user?.email || savedEmail;
      const nextName = user?.user_metadata?.full_name || user?.email || savedName;
      setRole(getRoleForAuthUser(user) ?? getCurrentRole() ?? "User");
      setCurrentUserId(user?.id ?? null);
      setEmail(nextEmail);
      setTempEmail(nextEmail);
      setDisplayName(nextName);
      setTempDisplayName(nextName);
      const passkeys = await loadPasskeyDevices();
      if (user && passkeys.length > 0) {
        recordPasskeyUserOnDevice(user.id);
        window.localStorage.setItem("ftm-passkey-registration", JSON.stringify({ userId: user.id, email: user.email, count: passkeys.length }));
      }
      setActivity([
        ...(user?.created_at ? [{ id: "created", label: "Account created", detail: "This account was created in Supabase Auth.", timestamp: new Date(user.created_at).toLocaleString() }] : []),
        ...(user?.last_sign_in_at ? [{ id: "sign-in", label: "Last sign-in", detail: "Most recent authenticated session.", timestamp: new Date(user.last_sign_in_at).toLocaleString() }] : []),
      ]);
    };
    void loadUser();
    const { data: authSubscription } = supabase.auth.onAuthStateChange(() => void loadUser());
    return () => {
      authSubscription.subscription.unsubscribe();
    };
  }, [loadPasskeyDevices, showToast, updateSecuritySetting]);

  const updateBackupSetting = <K extends keyof BackupSchedule>(key: K, value: BackupSchedule[K]) => {
    setBackupSchedule((current) => {
      const next = { ...current, [key]: value } as BackupSchedule;
      updateSettings("dataBackups", next);
      return next;
    });
  };

  const updateGeneralPreference = (key: keyof typeof generalPreferences, value: string) => {
    setGeneralPreferences((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem("ftm-general-preferences", JSON.stringify(next));
      updateSettings("preferences", next);
      return next;
    });
  };

  const updateReducedMotion = (value: boolean) => {
    setReducedMotion(value);
    window.localStorage.setItem("ftm-reduced-motion", String(value));
    updateSettings("appearance", { reducedMotion: value });
  };

  const updateAdvancedPreference = (key: keyof typeof advancedPreferences, value: string | boolean) => {
    setAdvancedPreferences((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem("ftm-advanced-preferences", JSON.stringify(next));
      updateSettings("privacy", { profileVisibility: next.profileVisibility, locationTracking: next.locationTracking, activeTripTracking: next.activeTripTracking });
      updateSettings("operations", { mapView: next.mapView, tripFilter: next.tripFilter, vehicleMarkers: next.vehicleMarkers, driverMarkers: next.driverMarkers, routeLines: next.routeLines, courierWaypoints: next.courierWaypoints, autoCenter: next.autoCenter });
      return next;
    });
  };

  const updateAlertPreference = <K extends keyof AlertPrefs>(key: K, value: AlertPrefs[K]) => {
    setAlertPrefs((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem("ftm-alert-preferences", JSON.stringify(next));
      return next;
    });
  };

  const updateNotificationPreference = <K extends keyof FtmSystemSettings["notifications"]>(key: K, value: FtmSystemSettings["notifications"][K]) => {
    setNotifications((current) => {
      const next = { ...current, [key]: value } as FtmSystemSettings["notifications"];
      updateSettings("notifications", next);
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;
    const loadWorkspaceData = async () => {
      try {
        const [trips, bookings, drivers] = await Promise.all([
          getTrips(),
          getBookings(),
          getDrivers(),
        ]);

        const tripList = Array.isArray(trips) ? (trips as Record<string, unknown>[]) : [];
        const bookingList = Array.isArray(bookings) ? (bookings as Record<string, unknown>[]) : [];
        const driverList = Array.isArray(drivers) ? (drivers as Record<string, unknown>[]) : [];

        const getNestedValue = (entry: Record<string, unknown>, ...keys: string[]) => {
          for (const key of keys) {
            const value = entry[key];
            if (value !== undefined && value !== null) return value;
          }
          return undefined;
        };

        if (!mounted) return;
        const bookingById = new Map(bookingList.map((b) => [String(getNestedValue(b, "id") ?? ""), b]));
        setDispatchQueue(tripList.map((trip) => {
          const tripInfo = trip as Record<string, unknown>;
          const statusText = String(getNestedValue(tripInfo, "status") ?? "Scheduled").replace(/[_-]+/g, " ");
          const status: DispatchLoad["status"] = /delayed|late/i.test(statusText)
            ? "Delayed"
            : /delivered|completed/i.test(statusText)
              ? "Delivered"
              : /in transit|transit|dispatch|route|moving|en route/i.test(statusText)
                ? "En Route"
                : "Loading";
          const booking = bookingById.get(String(getNestedValue(tripInfo, "booking_id", "bookingId") ?? ""));
          const fromLocation = getNestedValue(tripInfo, "from_location", "fromLocation");
          const toLocation = getNestedValue(tripInfo, "to_location", "toLocation");
          const pickupLocation = booking ? getNestedValue(booking as Record<string, unknown>, "pickup_location", "pickupLocation") : undefined;
          const dropoffLocation = booking ? getNestedValue(booking as Record<string, unknown>, "dropoff_location", "dropoffLocation") : undefined;
          return {
            id: String(getNestedValue(tripInfo, "id", "trip_id") ?? "Trip"),
            route: [fromLocation ?? pickupLocation, toLocation ?? dropoffLocation].filter(Boolean).join(" -> ") || "Route unavailable",
            driver: String(getNestedValue(tripInfo, "driver_name", "driverName") ?? "Unassigned"),
            status,
            eta: String(getNestedValue(tripInfo, "estimated_arrival", "estimatedArrival") ?? "Not scheduled"),
          };
        }));
        setManagedUsers(driverList.map((driver) => ({
          id: String(getNestedValue(driver, "id") ?? ""),
          name: String(getNestedValue(driver, "full_name", "name", "email") ?? "Unnamed user"),
          role: String(getNestedValue(driver, "role") ?? "Driver").replace(/_/g, " "),
          status: /suspended/i.test(String(getNestedValue(driver, "status") ?? "")) ? "Suspended" : "Active",
        })));
        setWorkspaceError(null);
      } catch (error) {
        if (mounted) setWorkspaceError(error instanceof Error ? error.message : "Unable to load workspace data.");
      } finally {
        if (mounted) setWorkspaceLoading(false);
      }
    };

    void loadWorkspaceData();
    return () => { mounted = false; };
  }, []);

  const normalizedRole = useMemo(() => String(role).toLowerCase().replace(/[_\s]/g, ""), [role]);
  const isAdmin = normalizedRole.includes("admin");

  useEffect(() => {
    if (!isAdmin) return;

    let active = true;
    const loadSystemUsers = async () => {
      try {
        const users = await getAdminUsers();
        if (!active) return;
        const records = Array.isArray(users) ? (users as Record<string, unknown>[]) : [];
        setSystemUsers(records.map((user) => ({
          id: String(user.id ?? ""),
          name: String(user.full_name ?? user.email ?? "Unnamed user"),
          email: String(user.email ?? "No email"),
          role: String(user.role ?? "User").replace(/_/g, " "),
          status: String(user.banned_until ? "Suspended" : "Active"),
        })).filter((user) => user.id));
      } catch (error) {
        if (active) showToast(error instanceof Error ? error.message : "Unable to load system users.", "bad");
      }
    };

    void loadSystemUsers();
    return () => { active = false; };
  }, [isAdmin, showToast]);
  const isDispatcher = normalizedRole.includes("dispatch");
  const isManager = normalizedRole.includes("manager");
  const hasWorkspaceTools = isAdmin || isDispatcher || isManager;
  const canManageTeam = isAdmin || isManager;
  const sectionGroups = [
    { label: "Account", items: [["overview", "Overview"], ["general", "General"], ["appearance", "Appearance"]] },
    { label: "Security & privacy", items: [["security", "Security"], ["privacy", "Privacy"]] },
    { label: "Operations", items: [["notifications", "Notifications"], ["mapOperations", "Map & Operations"]] },
    { label: "System", items: [["data", "Data"], ["about", "About"]] },
    ...(hasWorkspaceTools ? [{ label: "Workspace", items: [["workspace", "Workspace Tools"]] }] : []),
    { label: "Account history", items: [["activity", "Activity"]] },
  ];

  const onAvatarFile = (file: File | null) => {
    void chooseFile(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      const { error } = await supabase.auth.updateUser({ email: tempEmail, data: { full_name: tempDisplayName } });
      if (error) {
        showToast(error.message, "bad");
        return;
      }
      setDisplayName(tempDisplayName);
      setEmail(tempEmail);
      window.localStorage.setItem("displayName", tempDisplayName);
      window.localStorage.setItem("email", tempEmail);
      setIsEditingProfile(false);
      showToast("Profile updated successfully.");
    })();
  };

  const closeSecurityModal = () => {
    setSecurityModal(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters.", "bad");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match.", "bad");
      return;
    }
    setPasswordBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    if (error) {
      showToast(error.message, "bad");
      return;
    }
    showToast("Password changed successfully.");
    closeSecurityModal();
  };

  const registerSoftwarePasskey = async () => {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user?.id) {
      showToast("Your session has expired. Sign in again before registering a device.", "bad");
      return;
    }
    if (!canRegisterPasskeyForDevice(currentUser.user.id)) {
      showToast(getPasskeyDeviceLimitMessage(), "bad");
      return;
    }
    setPasskeyRegistrationOpen(false);
    setPasskeyAccountConfirmed(false);
    setSelectedSystemUserIds([]);
    setPasskeyBusy(true);
    const { error } = await supabase.auth.registerPasskey();
    setPasskeyBusy(false);
    if (error) {
      if (/(already registered|already exists|duplicate|device.*registered|try a different device)/i.test(error.message || "")) {
        await loadPasskeyDevices();
        showToast("This account already has a passkey on this device. Use the existing passkey, or choose another authenticator.");
        return;
      }
      showToast(getUserFriendlyAuthError(error, "passkey"), "bad");
      return;
    }
    const passkeys = await loadPasskeyDevices();
    const nextCount = passkeys.length;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      recordPasskeyUserOnDevice(user.id);
      window.localStorage.setItem("ftm-passkey-registration", JSON.stringify({ userId: user.id, email: user.email, count: nextCount }));
    }
    showToast("This device passkey was registered successfully.");
  };

  const openPasskeyRegistration = () => {
    setPasskeyAccountConfirmed(false);
    setSelectedSystemUserIds(currentUserId ? [currentUserId] : []);
    setPasskeyRegistrationOpen(true);
  };

  const toggleSystemUserSelection = (userId: string) => {
    setSelectedSystemUserIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  const toggleAllSystemUsers = () => {
    setSelectedSystemUserIds((current) => current.length === systemUsers.length ? [] : systemUsers.map((user) => user.id));
  };

  const confirmPasskeyRegistration = () => {
    const pendingIds = selectedSystemUserIds.filter((userId) => userId !== currentUserId);
    if (pendingIds.length > 0) {
      const nextPendingIds = Array.from(new Set([...pendingSystemUserIds, ...pendingIds]));
      setPendingSystemUserIds(nextPendingIds);
      window.localStorage.setItem("ftm-pending-passkey-users", JSON.stringify(nextPendingIds));
    }

    if (currentUserId && selectedSystemUserIds.includes(currentUserId)) {
      void registerSoftwarePasskey();
      if (pendingIds.length > 0) {
        showToast("This account is ready for registration. The other selected accounts are pending until they sign in.");
      }
      return;
    }

    setPasskeyRegistrationOpen(false);
    setPasskeyAccountConfirmed(false);
    setSelectedSystemUserIds([]);
    showToast("The selected accounts are pending. Each user can finish registration from their own account session.");
  };

  const renamePasskey = async (device: PasskeyDevice) => {
    const nextName = window.prompt("Name this passkey device", device.friendly_name || "My device")?.trim();
    if (!nextName || nextName === device.friendly_name) return;

    setPasskeyActionId(device.id);
    const { data, error } = await supabase.auth.passkey.update({ passkeyId: device.id, friendlyName: nextName });
    setPasskeyActionId(null);
    if (error) {
      showToast(error.message || "Unable to rename this passkey.", "bad");
      return;
    }

    setPasskeyDevices((current) => current.map((item) => item.id === device.id ? { ...item, ...(data as PasskeyDevice) } : item));
    showToast("Passkey device name updated.");
  };

  const removePasskey = async (device: PasskeyDevice) => {
    const lastDeviceWarning = passkeyDevices.length === 1
      ? " This is the last registered passkey, so you will need to register a new one before passkey-only sign-in can work."
      : "";
    if (!window.confirm(`Remove ${device.friendly_name || "this passkey device"}?${lastDeviceWarning}`)) return;

    setPasskeyActionId(device.id);
    const { error } = await supabase.auth.passkey.delete({ passkeyId: device.id });
    setPasskeyActionId(null);
    if (error) {
      showToast(error.message || "Unable to remove this passkey.", "bad");
      return;
    }

    setPasskeyDevices((current) => current.filter((item) => item.id !== device.id));
    showToast("Passkey device removed.");
  };

  const signOutOtherSessions = async () => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) {
      showToast(error.message, "bad");
      return;
    }
    showToast("Other sessions have been signed out.");
    closeSecurityModal();
  };

  const downloadAccountData = () => {
    setBackupDownloadKind("account");
    setBackupVerificationOpen(true);
  };

  const buildAccountDataWorkbook = () => {
    const payload = {
      profile: { displayName, email, role },
      generalPreferences,
      advancedPreferences,
      notifications,
      alertPrefs,
      reducedMotion,
      systemSettings: settings,
      exportedAt: new Date().toISOString(),
    };
    const rows = [["Section", "Setting", "Value"]];
    Object.entries(payload).forEach(([section, value]) => {
      if (section === "exportedAt") {
        rows.push(["Export", "Exported at", String(value)]);
        return;
      }
      if (typeof value === "object" && value !== null) {
        Object.entries(value).forEach(([key, nestedValue]) => {
          rows.push([section, key, typeof nestedValue === "object" ? JSON.stringify(nestedValue) : String(nestedValue)]);
        });
      } else {
        rows.push([section, "Value", String(value)]);
      }
    });
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 24 }, { wch: 34 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Account Data");
    return new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  };

  const downloadSystemBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupProgress(1);
    let progressTimer: number | undefined;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email || !backupPassword) {
        throw new Error("Enter your account password to verify this backup download.");
      }

      setBackupProgress(20);
      const { error: verificationError } = await supabase.auth.signInWithPassword({ email: user.email, password: backupPassword });
      if (verificationError) throw new Error("Password verification failed. Check your password and try again.");

      setBackupProgress(40);
      progressTimer = window.setInterval(() => {
        setBackupProgress((current) => Math.min(85, current + 1));
      }, 350);
      const blob = backupDownloadKind === "system" ? await exportSystemBackup() : buildAccountDataWorkbook();
      if (progressTimer) window.clearInterval(progressTimer);
      progressTimer = undefined;
      setBackupProgress(85);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupDownloadKind === "system"
        ? `airship-express-supabase-backup-${new Date().toISOString().slice(0, 10)}.xlsx`
        : `airship-express-account-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupProgress(100);
      setBackupVerificationOpen(false);
      setBackupPassword("");
      showToast(backupDownloadKind === "system" ? "The Supabase system backup was downloaded." : "Your account data was downloaded as an Excel workbook.");
    } catch (error) {
      if (progressTimer) window.clearInterval(progressTimer);
      setBackupProgress(0);
      showToast(error instanceof Error ? error.message : "The system backup could not be created.", "bad");
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setBackupBusy(false);
    }
  };

  const closeBackupVerification = () => {
    if (backupBusy) return;
    setBackupVerificationOpen(false);
    setBackupPassword("");
    setBackupProgress(0);
    setBackupDownloadKind("system");
  };

  return (
    <div className="settings-soft-shell min-h-screen flex flex-col text-slate-800 font-sans selection:bg-pink-500 selection:text-white">
      <GlobalNavbar />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <aside className="settings-soft-hero rounded-[28px] p-4 xl:sticky xl:top-6">
            <div className="flex items-center gap-3 border-b border-pink-100/80 pb-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-pink-500 to-rose-600 text-xl font-black text-white shadow-[0_8px_20px_rgba(244,63,94,0.35),inset_1.5px_1.5px_0_rgba(255,255,255,0.4),inset_-3px_-4px_8px_rgba(0,0,0,0.2)]">
                <FtmProfileAvatar name={displayName} src={avatarUrl} className="flex h-full w-full items-center justify-center rounded-[20px] object-cover" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-black text-slate-900">{displayName}</div>
                <div className="truncate text-[11px] font-semibold text-slate-500">{email}</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-[20px] border border-pink-100 bg-white/70 p-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-pink-500">Role</div>
                <div className="mt-1 text-sm font-black text-slate-800">{String(role).replace(/_/g, " ")}</div>
              </div>
              <a
                href={getDashboardRouteForRole(role)}
                className={`inline-flex items-center justify-center rounded-[14px] border border-white/80 bg-gradient-to-b from-white to-slate-100 px-3 py-2 text-[10px] font-extrabold text-slate-700 hover:text-pink-600 ${INFLATED_BUTTON}`}
              >
                Dashboard
              </a>
            </div>

            <nav className="mt-5 space-y-2" aria-label="Settings categories">
              {sectionGroups.map((group) => {
                const isOpen = openSectionGroup === group.label;

                return (
                  <div key={group.label} className="overflow-hidden rounded-[18px] border border-pink-100 bg-white/40">
                    <button
                      type="button"
                      onClick={() => setOpenSectionGroup((current) => (current === group.label ? null : group.label))}
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                    >
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group.label}</span>
                      <span className={`text-sm font-bold text-slate-500 transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`}>
                        ▾
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-pink-100 bg-white/60 p-2">
                        {group.items.map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => selectTab(key as TabKey)}
                            className={`flex w-full items-center justify-between rounded-[14px] border px-3 py-2.5 text-left text-xs font-black transition-all ${
                              activeTab === key
                                ? "border-pink-200 bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700 shadow-[0_10px_20px_rgba(244,63,94,0.08)]"
                                : "border-transparent bg-white/40 text-slate-600 hover:border-pink-100 hover:bg-white/70"
                            }`}
                          >
                            <span>{label}</span>
                            {activeTab === key && <span className="text-base">•</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>

          <div className="space-y-6">
            <header className="settings-soft-hero rounded-[30px] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-500">Account center</p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Settings</h1>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectTab("overview")}
                    className={`rounded-[16px] border border-white/80 bg-white/70 px-3 py-2 text-[11px] font-black text-slate-700 ${INFLATED_BUTTON}`}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => selectTab("security")}
                    className={`rounded-[16px] bg-gradient-to-b from-pink-500 to-pink-600 px-3 py-2 text-[11px] font-black text-white ${INFLATED_BUTTON}`}
                  >
                    Security
                  </button>
                </div>
              </div>
            </header>

            {/* Global Toast / Feedback Messages */}
            {statusMessage && (
              <div className={`rounded-[24px] border p-4 text-xs font-bold shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)] animate-fadeIn ${statusTone === "good" ? "border-emerald-200/80 bg-emerald-100/70 text-emerald-900" : "border-rose-200/80 bg-rose-100/70 text-rose-900"}`}>
                {statusMessage}
              </div>
            )}
            {workspaceLoading && (
              <div className="rounded-[24px] border border-pink-200/80 bg-pink-100/60 p-4 text-xs font-bold text-pink-900 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]">
                Syncing live workspace details...
              </div>
            )}
            {workspaceError && (
              <div className="rounded-[24px] border border-rose-200/80 bg-rose-100/70 p-4 text-xs font-bold text-rose-900 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]">
                {workspaceError}
              </div>
            )}

            {/* =================================-------------------------------- */}
            {/* TAB CONTENTS                                                     */}
            {/* =================================-------------------------------- */}

        {/* ---------------- Overview Tab ---------------- */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className={INFLATED_CARD}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Settings overview</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div><p className="text-xs font-bold text-slate-700">General</p><p className="mt-1 text-xs text-slate-500">Language, timezone, formats, and landing page.</p></div>
                <div><p className="text-xs font-bold text-slate-700">Appearance</p><p className="mt-1 text-xs text-slate-500">Theme, motion, and accessibility preferences.</p></div>
                <div><p className="text-xs font-bold text-slate-700">Security</p><p className="mt-1 text-xs text-slate-500">Password, two-factor authentication, and sessions.</p></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => selectTab("general")} className={`rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2 text-xs font-black text-white ${INFLATED_BUTTON}`}>Open general settings</button><button type="button" onClick={() => selectTab("appearance")} className={`rounded-[18px] bg-white px-4 py-2 text-xs font-black text-slate-700 ${INFLATED_BUTTON}`}>Open appearance</button></div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className={INFLATED_CARD}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Personal Info</p>
                  <button
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="text-xs font-extrabold text-pink-600 hover:underline"
                  >
                    {isEditingProfile ? "Cancel" : "Edit Profile"}
                  </button>
                </div>

                {!isEditingProfile ? (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-slate-200/60 text-lg font-black text-slate-700 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.08)]">
                      <FtmProfileAvatar name={displayName} src={previewUrl || avatarUrl} className="flex h-full w-full items-center justify-center object-cover" />
                      <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-slate-900/45 text-[9px] font-black text-white opacity-0 transition-opacity hover:opacity-100">
                        Edit
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onAvatarFile(event.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                    <div className="overflow-hidden">
                      <div className="truncate text-lg font-black text-slate-900">{displayName}</div>
                      <div className="truncate text-xs font-semibold text-slate-500">{email}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pendingImage && <button type="button" onClick={() => void saveAvatar()} disabled={avatarBusy} className="text-[10px] font-black text-pink-600">{avatarBusy ? `Saving... ${avatarProgress}%` : "Save photo"}</button>}
                        {avatarUrl && <button type="button" onClick={() => void removeAvatar()} disabled={avatarBusy} className="text-[10px] font-black text-slate-500">Remove photo</button>}
                      </div>
                      {avatarError && <p className="mt-1 text-[10px] font-semibold text-rose-600">{avatarError}</p>}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={tempDisplayName}
                        onChange={(e) => setTempDisplayName(e.target.value)}
                        className="w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={tempEmail}
                        onChange={(e) => setTempEmail(e.target.value)}
                        className="w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-400"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className={`rounded-[18px] bg-gradient-to-b from-slate-800 to-slate-900 px-5 py-2 text-xs font-black text-white ${INFLATED_BUTTON}`}
                    >
                      Save Profile
                    </button>
                  </form>
                )}
              </div>

              <div className={INFLATED_CARD}>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Role Boundary</p>
                <div className="mt-3 text-lg font-black text-slate-900">{String(role).replace(/_/g, " ")}</div>
                <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">
                  Your identity is secured under RBAC rules. System options adapt dynamically to your active permissions tier.
                </p>
                {hasWorkspaceTools && (
                  <button
                    onClick={() => selectTab("workspace")}
                    className={`mt-4 inline-flex items-center rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2 text-xs font-black text-white ${INFLATED_BUTTON}`}
                  >
                    Workspace Console →
                  </button>
                )}
              </div>
            </div>

            <div className={INFLATED_CARD}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Operations Metrics</p>
              <div className="grid gap-4 sm:grid-cols-3">
                {isAdmin && (
                  <>
                    <StatCard label="Total Users" value={String(managedUsers.length)} sub="System wide" />
                    <StatCard label="Suspended" value={String(managedUsers.filter((u) => u.status === "Suspended").length)} />
                    <StatCard label="Invites Pending" value={String(managedUsers.filter((u) => u.status === "Invited").length)} />
                  </>
                )}
                {isDispatcher && !isAdmin && (
                  <>
                    <StatCard label="Active Loads" value={String(dispatchQueue.filter((l) => l.status !== "Delivered").length)} />
                    <StatCard label="Delayed Trips" value={String(dispatchQueue.filter((l) => l.status === "Delayed").length)} />
                    <StatCard label="Completed Today" value={String(dispatchQueue.filter((l) => l.status === "Delivered").length)} />
                  </>
                )}
                {!hasWorkspaceTools && (
                  <>
                    <StatCard label="Account Status" value="Active" />
                    <StatCard label="Authentication" value="Passkey protected" />
                    <StatCard label="Verification Tier" value="Standard" />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- General Tab ---------------- */}
        {activeTab === "general" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">General preferences</h2>
              <p className="mt-1 text-xs text-slate-500">These preferences are stored locally for this browser.</p>
              <div className="mt-5 space-y-4">{([ ["language", "Language", ["English"]], ["timezone", "Timezone", ["Asia/Manila", "UTC"]], ["dateFormat", "Date format", ["MM/DD/YYYY", "DD/MM/YYYY"]], ["timeFormat", "Time format", ["12-hour", "24-hour"]], ["landingPage", "Default landing page", ["Role dashboard", "Operations center"]] ] as const).map(([key, label, options]) => <label key={key} className="block text-xs font-bold text-slate-700">{label}<select value={generalPreferences[key]} onChange={(event) => updateGeneralPreference(key, event.target.value)} className="mt-1.5 w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.04)]">{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}</div>
            </div>
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">Looking for data controls?</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">Clearing local preferences and exporting your account data now live in one place under Data & storage, so nothing here gets deleted by mistake.</p>
              <button type="button" onClick={() => selectTab("data")} className={`mt-5 rounded-[18px] bg-white px-4 py-2 text-xs font-black text-slate-700 ${INFLATED_BUTTON}`}>Open data & storage</button>
            </div>
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">System controls</h2>
              <p className="mt-1 text-xs text-slate-500">These controls apply immediately to every FTM page in this browser.</p>
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4"><div><p className="text-xs font-black text-slate-800">Route prefetching</p><p className="text-[11px] text-slate-500">Preload linked FTM pages for smoother navigation</p></div><InflatedToggle checked={settings.system.navigationPrefetch} onChange={() => updateSettings("system", { navigationPrefetch: !settings.system.navigationPrefetch })} /></div>
                <div className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4"><div><p className="text-xs font-black text-slate-800">Connection notices</p><p className="text-[11px] text-slate-500">Show offline and slow-network status across the app</p></div><InflatedToggle checked={settings.system.networkNotices} onChange={() => updateSettings("system", { networkNotices: !settings.system.networkNotices })} /></div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Appearance Tab (includes former Accessibility) ---------------- */}
        {activeTab === "appearance" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">Appearance</h2>
              <p className="mt-1 text-xs text-slate-500">Choose how the application is presented on this device.</p>
              <div className="mt-5 flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4"><div><p className="text-xs font-black text-slate-800">Theme</p><p className="text-[11px] text-slate-500">Light or dark mode</p></div><ThemeToggle /></div>
              <div className="mt-3 flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4"><div><p className="text-xs font-black text-slate-800">Reduce motion</p><p className="text-[11px] text-slate-500">Minimize decorative transitions</p></div><InflatedToggle checked={reducedMotion} onChange={() => updateReducedMotion(!reducedMotion)} /></div>
              <div className="mt-3 flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4"><div><p className="text-xs font-black text-slate-800">Compact layout</p><p className="text-[11px] text-slate-500">Use denser spacing across FTM pages</p></div><InflatedToggle checked={settings.appearance.density === "compact"} onChange={() => updateSettings("appearance", { density: settings.appearance.density === "compact" ? "comfortable" : "compact" })} /></div>
            </div>
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">Accessibility</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Use browser zoom and operating-system accessibility tools for text sizing and contrast. The application does not currently expose a separate font-size preference.</p>
              <div className="mt-5 rounded-[22px] border border-emerald-200/70 bg-emerald-100/60 p-4 text-xs font-bold text-emerald-800">Keyboard navigation remains enabled throughout the app.</div>
            </div>
          </div>
        )}

        {/* ---------------- Security Tab ---------------- */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div className={INFLATED_CARD}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Account security</h2>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">Password, passkey, and active sessions</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-100/80 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-800 shadow-[inset_1px_1px_0_rgba(255,255,255,0.9)]">MFA removed</span>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <SecurityControlCard title="Password" description="Update the password used to sign in to your account.">
                  <button type="button" onClick={() => setSecurityModal("password")} className={`w-full rounded-[18px] bg-white px-4 py-2.5 text-xs font-black text-slate-700 ${INFLATED_BUTTON}`}>Change password</button>
                </SecurityControlCard>
                <SecurityControlCard title="Active sessions" description="Sign out of every other device where you're logged in.">
                  <button type="button" onClick={() => setSecurityModal("sessions")} className={`w-full rounded-[18px] bg-white px-4 py-2.5 text-xs font-black text-slate-700 ${INFLATED_BUTTON}`}>Manage sessions</button>
                </SecurityControlCard>
                <SecurityControlCard title="Passkey devices" description="Register multiple passkeys and remove devices you no longer trust.">
                  <div className="space-y-3">
                    {passkeyDevices.length === 0 ? (
                      <div className="rounded-[18px] border border-pink-100 bg-pink-50/60 px-4 py-3 text-xs font-bold text-pink-700">
                        No passkey devices registered yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {passkeyDevices.map((device, index) => (
                          <div key={device.id} className="rounded-[18px] border border-white/90 bg-white/75 p-3 shadow-[inset_1px_1px_0_rgba(255,255,255,0.9),0_5px_12px_rgba(190,24,93,0.06)]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black text-slate-800">{device.friendly_name || `Passkey device ${index + 1}`}</p>
                                <p className="mt-1 text-[10px] font-semibold text-slate-500">Added {formatPasskeyDate(device.created_at)}</p>
                                <p className="text-[10px] font-semibold text-slate-500">Last used {formatPasskeyDate(device.last_used_at)}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">Active</span>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <button type="button" onClick={() => void renamePasskey(device)} disabled={passkeyActionId === device.id} className={`flex-1 rounded-[12px] bg-white px-2 py-1.5 text-[10px] font-black text-slate-600 ${INFLATED_BUTTON}`}>
                                Rename
                              </button>
                              <button type="button" onClick={() => void removePasskey(device)} disabled={passkeyActionId === device.id} className="flex-1 rounded-[12px] border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">
                                {passkeyActionId === device.id ? "Updating..." : "Remove"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={openPasskeyRegistration} disabled={passkeyBusy} className={`w-full rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60 ${INFLATED_BUTTON}`}>
                      {passkeyBusy ? "Waiting for passkey setup..." : "Register another passkey"}
                    </button>
                    <p className="text-[10px] font-semibold text-slate-500">Use a separate passkey for each trusted phone, computer, or security key.</p>
                  </div>
                </SecurityControlCard>
              </div>
            </div>

            {isAdmin && (
              <div className={INFLATED_CARD}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Security Engine Settings</h2>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">Organization-wide policy — administrators only</p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-100/80 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-800 shadow-[inset_1px_1px_0_rgba(255,255,255,0.9)]">
                    Active
                  </span>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <SecurityControlCard
                    title="Passkeys Strategy"
                    description="Software passkeys are required for the FTM web portal and driver app."
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-[20px] bg-slate-800 p-3 text-xs font-black text-white shadow-[0_6px_16px_rgba(0,0,0,0.2),inset_1px_1px_0_rgba(255,255,255,0.2)]">
                        <span>Software passkey</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${passkeyDevices.length > 0 ? "bg-emerald-500" : "bg-pink-500"}`}>
                          {passkeyDevices.length > 0 ? `Registered${passkeyDevices.length > 1 ? ` (${passkeyDevices.length})` : ""}` : "Not registered"}
                        </span>
                      </div>
                      {passkeyDevices.length > 0 ? (
                        <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-xs font-black text-emerald-700">
                          Passkey registered for this account
                        </div>
                      ) : (
                        <button type="button" onClick={openPasskeyRegistration} disabled={passkeyBusy} className={`w-full rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60 ${INFLATED_BUTTON}`}>
                          {passkeyBusy ? "Waiting for passkey setup..." : "Register a passkey"}
                        </button>
                      )}
                      <p className="mt-2 text-[10px] font-semibold text-slate-500">Windows may offer Windows Hello, which can use your device PIN. The browser controls the available passkey choices.</p>
                    </div>
                  </SecurityControlCard>

                  <SecurityControlCard
                    title="Users per device"
                    description="Limit how many separate FTM accounts may register passkeys in this browser device profile."
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 5, 10].map((limit) => {
                        const selected = securitySettings.maxUsersPerDevice === limit;
                        return (
                          <button
                            key={limit}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => updateSecuritySetting("maxUsersPerDevice", limit)}
                            className={`rounded-[16px] px-2 py-3 text-xs font-black transition-all ${selected ? "bg-pink-600 text-white shadow-[inset_2px_2px_5px_rgba(126,0,58,0.35),0_5px_12px_rgba(190,24,93,0.2)]" : "border border-white/80 bg-white/70 text-slate-700 hover:border-pink-200 hover:bg-pink-50"}`}
                          >
                            {limit}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-center text-xs font-black text-slate-700">Up to {securitySettings.maxUsersPerDevice} account{securitySettings.maxUsersPerDevice === 1 ? "" : "s"} per browser device</p>
                    <p className="mt-1 text-[10px] font-semibold text-slate-500">Each account keeps its own Supabase passkey. The limit is enforced locally for this browser profile and origin.</p>
                  </SecurityControlCard>

                  <SecurityControlCard title="Session timeout" description="Minutes of inactivity before a dispatcher or admin session expires.">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {[3, 4, 5, 10, 15, 30].map((minutes) => {
                        const selected = securitySettings.sessionTimeoutMinutes === minutes;
                        return (
                          <button
                            key={minutes}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => updateSecuritySetting("sessionTimeoutMinutes", minutes)}
                            className={`rounded-[16px] px-3 py-3 text-xs font-black transition-all ${selected ? "bg-pink-600 text-white shadow-[inset_2px_2px_5px_rgba(126,0,58,0.35),0_5px_12px_rgba(190,24,93,0.2)]" : "border border-white/80 bg-white/70 text-slate-700 shadow-[2px_2px_6px_rgba(148,163,184,0.16),inset_1px_1px_0_rgba(255,255,255,0.9)] hover:border-pink-200 hover:bg-pink-50"}`}
                          >
                            {minutes} min
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-center text-xs font-black text-slate-700">Auto logout after {securitySettings.sessionTimeoutMinutes} minutes of inactivity</p>
                  </SecurityControlCard>

                  <SecurityControlCard title="OTP expiration" description="Organization-wide lifetime for the six-digit sign-in code and its live countdown.">
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 4, 5, 10].map((minutes) => {
                        const seconds = minutes * 60;
                        const selected = securitySettings.otpLifetimeSeconds === seconds;
                        return <button key={minutes} type="button" aria-pressed={selected} onClick={() => void updateOtpExpiration(seconds)} className={`rounded-[16px] px-2 py-3 text-xs font-black transition-all ${selected ? "bg-pink-600 text-white shadow-[inset_2px_2px_5px_rgba(126,0,58,0.35),0_5px_12px_rgba(190,24,93,0.2)]" : "border border-white/80 bg-white/70 text-slate-700 hover:border-pink-200 hover:bg-pink-50"}`}>{minutes} min</button>;
                      })}
                    </div>
                    <p className="mt-3 text-center text-xs font-black text-slate-700">Sign-in codes expire after {securitySettings.otpLifetimeSeconds / 60} minute{securitySettings.otpLifetimeSeconds === 60 ? "" : "s"}</p>
                  </SecurityControlCard>

                  <SecurityControlCard title="Login lockout" description="Failed attempts allowed before an account is temporarily locked.">
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-[11px] font-bold text-slate-600">Failed attempts</p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {[3, 4, 5, 6, 8, 10].map((threshold) => {
                            const selected = securitySettings.lockoutThreshold === threshold;
                            return (
                              <button
                                key={threshold}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => updateSecuritySetting("lockoutThreshold", threshold)}
                                className={`rounded-[16px] px-3 py-3 text-xs font-black transition-all ${selected ? "bg-pink-600 text-white shadow-[inset_2px_2px_5px_rgba(126,0,58,0.35),0_5px_12px_rgba(190,24,93,0.2)]" : "border border-white/80 bg-white/70 text-slate-700 shadow-[2px_2px_6px_rgba(148,163,184,0.16),inset_1px_1px_0_rgba(255,255,255,0.9)] hover:border-pink-200 hover:bg-pink-50"}`}
                              >
                                {threshold}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-[11px] font-bold text-slate-600">Lockout duration</p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {[5, 10, 15, 30, 45, 60].map((minutes) => {
                            const selected = securitySettings.lockoutDurationMinutes === minutes;
                            return (
                              <button
                                key={minutes}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => updateSecuritySetting("lockoutDurationMinutes", minutes)}
                                className={`rounded-[16px] px-3 py-3 text-xs font-black transition-all ${selected ? "bg-pink-600 text-white shadow-[inset_2px_2px_5px_rgba(126,0,58,0.35),0_5px_12px_rgba(190,24,93,0.2)]" : "border border-white/80 bg-white/70 text-slate-700 shadow-[2px_2px_6px_rgba(148,163,184,0.16),inset_1px_1px_0_rgba(255,255,255,0.9)] hover:border-pink-200 hover:bg-pink-50"}`}
                              >
                                {minutes} min
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-center text-xs font-black text-slate-700">Lock after {securitySettings.lockoutThreshold} failed attempts for {securitySettings.lockoutDurationMinutes} minutes</p>
                    </div>
                  </SecurityControlCard>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- Notifications Tab ---------------- */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900 mb-4">Notification Preferences</h2>
              <div className="space-y-3">
                {[
                  { key: "dispatch", title: "Dispatch Notifications", desc: "Assignments, driver changes, route changes, and trip status." },
                  { key: "fleet", title: "Fleet Notifications", desc: "Maintenance, vehicle availability, and vehicle issues." },
                  { key: "safety", title: "Safety Notifications", desc: "Emergency events, breakdowns, and safety incidents." },
                  { key: "system", title: "System Notifications", desc: "Account activity, maintenance, and important announcements." },
                ].map((item) => {
                  const k = item.key as keyof NotificationPrefs;
                  return (
                    <div key={item.key} className="flex items-center justify-between rounded-[24px] border border-white/80 bg-white/60 p-4 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.02)]">
                      <div>
                        <p className="text-xs font-black text-slate-800">{item.title}</p>
                        <p className="text-[11px] font-medium text-slate-500">{item.desc}</p>
                      </div>
                      <InflatedToggle checked={notifications[k]} onChange={() => updateNotificationPreference(k, !notifications[k])} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">Alert thresholds</h2>
              <p className="mt-1 text-xs text-slate-500">Controls how urgently safety and dispatch alerts are surfaced to you.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">Alert lead time before ETA<select value={alertPrefs.leadTimeMinutes} onChange={(event) => updateAlertPreference("leadTimeMinutes", event.target.value as AlertPrefs["leadTimeMinutes"])} className="mt-1.5 w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-800">{["5", "10", "15", "30"].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
                <div className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4"><div><p className="text-xs font-black text-slate-800">Escalate unacknowledged alerts</p><p className="text-[11px] text-slate-500">Re-notify if a safety alert isn&apos;t acknowledged</p></div><InflatedToggle checked={alertPrefs.escalateUnacknowledged} onChange={() => updateAlertPreference("escalateUnacknowledged", !alertPrefs.escalateUnacknowledged)} /></div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Privacy Tab ---------------- */}
        {activeTab === "privacy" && (
          <div className={INFLATED_CARD}>
            <h2 className="text-base font-black text-slate-900">Privacy</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">Privacy controls are limited to preferences currently supported by this application.</p>
            <label className="mt-5 flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4 text-xs font-bold text-slate-700">Profile visibility<select value={advancedPreferences.profileVisibility} onChange={(event) => updateAdvancedPreference("profileVisibility", event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option>Team</option><option>Private</option></select></label>
            <div className="mt-3 space-y-3">
              {([["locationTracking", "Share my live location with dispatch"], ["activeTripTracking", "Share active-trip location with the assigned team"]] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4 text-xs font-bold text-slate-700">
                  <span>{label}</span>
                  <InflatedToggle checked={advancedPreferences[key]} onChange={() => updateAdvancedPreference(key, !advancedPreferences[key])} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Location and operational records remain governed by dispatch and fleet permissions regardless of this setting.</p>
          </div>
        )}

        {/* ---------------- Map & Operations Tab (merged Tracking + Map + Operations) ---------------- */}
        {activeTab === "mapOperations" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">Map view & filters</h2>
              <p className="mt-1 text-xs text-slate-500">Personal display preferences only; fleet records are not changed here.</p>
              <div className="mt-5 space-y-4">
                <label className="block text-xs font-bold text-slate-700">Default map view<select value={advancedPreferences.mapView} onChange={(event) => updateAdvancedPreference("mapView", event.target.value)} className="mt-1.5 w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-800">{["Active dispatch", "Fleet overview", "Route planning"].map((option) => <option key={option}>{option}</option>)}</select></label>
                <label className="block text-xs font-bold text-slate-700">Default trip filter<select value={advancedPreferences.tripFilter} onChange={(event) => updateAdvancedPreference("tripFilter", event.target.value)} className="mt-1.5 w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-800">{["Active trips", "All trips", "Delayed trips"].map((option) => <option key={option}>{option}</option>)}</select></label>
              </div>
            </div>
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">Map display elements</h2>
              <p className="mt-1 text-xs text-slate-500">These settings affect map presentation where supported by each module.</p>
              <div className="mt-5 grid gap-3">
                {([["vehicleMarkers", "Vehicle markers"], ["driverMarkers", "Driver markers"], ["routeLines", "Route lines"], ["courierWaypoints", "Courier waypoints"], ["autoCenter", "Auto-center"]] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4 text-xs font-bold text-slate-700">
                    <span>{label}</span>
                    <InflatedToggle checked={advancedPreferences[key]} onChange={() => updateAdvancedPreference(key, !advancedPreferences[key])} />
                  </label>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-slate-400">Live GPS status and update frequency are unavailable from the current account APIs.</p>
            </div>
          </div>
        )}

        {/* ---------------- Data & Storage Tab ---------------- */}
        {activeTab === "data" && (
          <div className="space-y-6">
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">System backup schedule</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">Each enabled frequency is shown separately below. An administrator can export the current FTM Supabase records as a formatted Excel workbook for recovery or archiving.</p>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4 text-xs font-bold text-slate-700">
                  <div>
                    <p className="text-xs font-black text-slate-800">Automatic backup system</p>
                    <p className="text-[11px] font-medium text-slate-500">Enable or pause the platform backup routine</p>
                  </div>
                  <InflatedToggle checked={backupSchedule.enabled} onChange={() => updateBackupSetting("enabled", !backupSchedule.enabled)} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {([
                    ["daily", "Daily backup"],
                    ["weekly", "Weekly backup"],
                    ["monthly", "Monthly backup"],
                    ["yearly", "Yearly backup"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white/60 p-4 text-xs font-bold text-slate-700">
                      <div>
                        <p>{label}</p>
                        <p className={`mt-1 text-[10px] font-black uppercase tracking-[0.14em] ${backupSchedule.enabled && backupSchedule[key] ? "text-emerald-600" : "text-slate-400"}`}>
                          {backupSchedule.enabled && backupSchedule[key] ? `Active · next ${nextBackupRun(key)}` : "Paused"}
                        </p>
                      </div>
                      <InflatedToggle checked={backupSchedule[key]} onChange={() => updateBackupSetting(key, !backupSchedule[key])} />
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Retention period
                    <select
                      value={String(backupSchedule.retentionDays)}
                      onChange={(event) => updateBackupSetting("retentionDays", Number(event.target.value))}
                      className="mt-1.5 w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-800"
                    >
                      {[30, 60, 90, 180, 365, 730].map((days) => (
                        <option key={days} value={days}>{days} days</option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-[22px] border border-white/80 bg-white/60 p-4 text-xs font-bold text-slate-700">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Last run</p>
                    <p className="mt-2 text-sm font-black text-slate-900">{new Date(backupSchedule.lastRun || Date.now()).toLocaleString()}</p>
                  </div>

                  <div className="rounded-[22px] border border-white/80 bg-white/60 p-4 text-xs font-bold text-slate-700">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Next run</p>
                    <p className="mt-2 text-sm font-black text-slate-900">{new Date(backupSchedule.nextRun || Date.now()).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <button type="button" onClick={() => setBackupVerificationOpen(true)} className={`mt-5 rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2 text-xs font-black text-white ${INFLATED_BUTTON}`}>
                  Download full Supabase backup
                </button>
              )}
              {!isAdmin && <p className="mt-5 text-[11px] font-semibold text-slate-400">Full system backups are available to administrators only.</p>}
            </div>

            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900">Local data controls</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">Clear local preferences and cached display choices, or download a copy of your saved settings. Operational records are never changed from this page.</p>
              <div className="mt-5 rounded-[22px] border border-white/80 bg-white/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-slate-800">Saved backup policy</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      {backupSchedule.enabled ? "Automatic backups enabled" : "Automatic backups paused"} · {backupSchedule.retentionDays} days retained
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${backupSchedule.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                    {backupSchedule.enabled ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["daily", "weekly", "monthly", "yearly"] as const).map((key) => (
                    <span key={key} className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${backupSchedule[key] ? "border-pink-200 bg-pink-50 text-pink-700" : "border-slate-200 bg-slate-100 text-slate-400"}`}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => { resetPersonalization(); showToast("Personal settings reset across FTM."); }} className={`rounded-[18px] bg-white px-4 py-2 text-xs font-black text-slate-700 ${INFLATED_BUTTON}`}>Reset personal settings</button>
                <button type="button" onClick={downloadAccountData} className={`rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2 text-xs font-black text-white ${INFLATED_BUTTON}`}>Download my data</button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- About Tab ---------------- */}
        {activeTab === "about" && <div className="grid gap-6 md:grid-cols-2"><div className={INFLATED_CARD}><h2 className="text-base font-black text-slate-900">About Airship Express</h2><p className="mt-3 text-xs leading-relaxed text-slate-500">Fleet & Transportation Management System</p><p className="mt-1 text-xs font-bold text-slate-700">Version 1.0.0</p></div><div className={INFLATED_CARD}><h2 className="text-base font-black text-slate-900">Help & support</h2><p className="mt-2 text-xs text-slate-500">For account or access support, contact the operations administrator.</p><a href="mailto:airshipexpress.s@gmail.com" className="mt-4 inline-flex text-xs font-bold text-pink-700 hover:underline">Contact support</a></div></div>}

        {/* ---------------- Workspace Tools Tab ---------------- */}
        {activeTab === "workspace" && hasWorkspaceTools && (
          <div className="space-y-6">
            <div className={INFLATED_CARD}>
              <h2 className="text-base font-black text-slate-900 mb-4">Fleet Dispatch Queue</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-bold text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200/60 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Load ID</th>
                      <th className="py-3 px-4">Route</th>
                      <th className="py-3 px-4">Driver</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">ETA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dispatchQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-white/40 transition">
                        <td className="py-3 px-4 font-black text-slate-900">{item.id}</td>
                        <td className="py-3 px-4">{item.route}</td>
                        <td className="py-3 px-4">{item.driver}</td>
                        <td className="py-3 px-4"><StatusPill status={item.status} /></td>
                        <td className="py-3 px-4 text-slate-500">{item.eta}</td>
                      </tr>
                    ))}
                    {dispatchQueue.length === 0 && !workspaceLoading && (
                      <tr><td colSpan={5} className="py-6 px-4 text-center text-slate-400">No active loads right now.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {canManageTeam && (
              <div className={INFLATED_CARD}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-black text-slate-900">Team & Drivers</h2>
                  <span className="text-[11px] font-bold text-slate-400">{managedUsers.length} people</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-bold text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-200/60 text-slate-400 uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {managedUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-white/40 transition">
                          <td className="py-3 px-4 font-black text-slate-900">{user.name}</td>
                          <td className="py-3 px-4">{user.role}</td>
                          <td className="py-3 px-4"><StatusPill status={user.status} /></td>
                        </tr>
                      ))}
                      {managedUsers.length === 0 && !workspaceLoading && (
                        <tr><td colSpan={3} className="py-6 px-4 text-center text-slate-400">No drivers or team members found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- Activity Tab ---------------- */}
        {activeTab === "activity" && (
          <div className={INFLATED_CARD}>
            <h2 className="text-base font-black text-slate-900 mb-4">Account Event Logs</h2>
            <div className="space-y-3">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between rounded-[20px] border border-white/80 bg-white/60 p-4 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.02)]">
                  <div>
                    <p className="text-xs font-black text-slate-800">{entry.label}</p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">{entry.detail}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{entry.timestamp}</span>
                </div>
              ))}
              {activity.length === 0 && <p className="text-xs text-slate-400">No recorded activity yet.</p>}
            </div>
          </div>
        )}
          </div>
        </div>
      </main>

      <GlobalFooter />

      {securityModal === "password" && (
        <SoftModal title="Change password" subtitle="Use at least 8 characters." onClose={closeSecurityModal}>
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-800" /></label>
            <label className="block text-xs font-bold text-slate-700">Confirm new password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-800" /></label>
            <button type="button" onClick={changePassword} disabled={passwordBusy} className={`w-full rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-60 ${INFLATED_BUTTON}`}>{passwordBusy ? "Updating…" : "Update password"}</button>
          </div>
        </SoftModal>
      )}

      {securityModal === "sessions" && (
        <SoftModal title="Manage sessions" subtitle="Sign out of every other device where you're logged in." onClose={closeSecurityModal}>
          <div className="space-y-4">
            <div className="rounded-[22px] border border-white/80 bg-white/60 p-4 text-xs text-slate-600">
              This device stays signed in. Any other browser or device using your account will be signed out immediately.
            </div>
            <button type="button" onClick={signOutOtherSessions} className={`w-full rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2.5 text-xs font-black text-white ${INFLATED_BUTTON}`}>Sign out other sessions</button>
          </div>
        </SoftModal>
      )}

      {passkeyRegistrationOpen && (
        <SoftModal
          title="Register another passkey"
          subtitle="Register this device for the signed-in system user."
          onClose={() => {
            if (passkeyBusy) return;
            setPasskeyRegistrationOpen(false);
            setPasskeyAccountConfirmed(false);
            setSelectedSystemUserIds([]);
          }}
        >
          <div className="space-y-4">
            <div className="rounded-[22px] border border-pink-100 bg-pink-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-pink-600">System user</p>
              <p className="mt-2 text-sm font-black text-slate-800">{displayName}</p>
              <p className="mt-0.5 break-all text-xs font-bold text-slate-600">{email}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-pink-600">{String(role).replace(/_/g, " ")}</p>
              <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-500">The device will be registered to this system user. Their existing passkeys remain available, and this device can be used for the same account.</p>
            </div>
            {isAdmin && (
              <div className="rounded-[22px] border border-white/80 bg-white/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">System users</p>
                  <button type="button" onClick={toggleAllSystemUsers} className="text-[10px] font-black text-pink-600 hover:text-pink-800">
                    {selectedSystemUserIds.length === systemUsers.length && systemUsers.length > 0 ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {systemUsers.map((user) => (
                    <label key={user.id} className={`flex cursor-pointer items-center gap-2 rounded-[14px] px-3 py-2 ${user.id === currentUserId ? "border border-pink-200 bg-pink-50" : "bg-white/70"}`}>
                      <input type="checkbox" checked={selectedSystemUserIds.includes(user.id)} onChange={() => toggleSystemUserSelection(user.id)} className="h-4 w-4 accent-pink-600" />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black text-slate-800">{user.name}</p>
                        <p className="truncate text-[10px] font-semibold text-slate-500">{user.email}</p>
                      </div>
                      <span className={`ml-auto shrink-0 text-[9px] font-black uppercase tracking-wider ${pendingSystemUserIds.includes(user.id) ? "text-amber-600" : "text-slate-400"}`}>
                        {pendingSystemUserIds.includes(user.id) ? "Pending" : user.id === currentUserId ? "Current" : user.role}
                      </span>
                    </label>
                  ))}
                  {systemUsers.length === 0 && <p className="px-2 py-3 text-[10px] font-semibold text-slate-500">The system user list is unavailable.</p>}
                </div>
                <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">Select one or all users. The current user can register now; other selected users are marked pending and can finish when they sign in.</p>
              </div>
            )}
            <label className="flex cursor-pointer items-start gap-3 rounded-[18px] border border-white/80 bg-white/70 p-3 text-xs font-bold text-slate-700 shadow-[inset_1px_1px_0_rgba(255,255,255,0.9)]">
              <input
                type="checkbox"
                checked={passkeyAccountConfirmed}
                onChange={(event) => setPasskeyAccountConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-pink-600"
              />
              <span>I confirm this is the system user I want to register on this device.</span>
            </label>
            <button
              type="button"
              onClick={confirmPasskeyRegistration}
              disabled={!passkeyAccountConfirmed || passkeyBusy || selectedSystemUserIds.length === 0}
              className={`w-full rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${INFLATED_BUTTON}`}
            >
              {passkeyBusy ? "Waiting for device registration..." : "Okay, register this device"}
            </button>
          </div>
        </SoftModal>
      )}

      {backupVerificationOpen && (
        <SoftModal
          title={backupDownloadKind === "system" ? "Verify backup download" : "Verify account data download"}
          subtitle={backupDownloadKind === "system" ? "Enter your current account password before exporting system data." : "Enter your current account password before exporting your settings."}
          onClose={closeBackupVerification}
        >
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-700">
              Account password
              <input
                type="password"
                value={backupPassword}
                onChange={(event) => setBackupPassword(event.target.value)}
                disabled={backupBusy}
                autoFocus
                className="mt-1.5 w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-800"
              />
            </label>

            <div aria-live="polite" className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                <span>{backupProgress === 100 ? "Backup ready" : backupBusy ? "Preparing backup" : "Waiting for verification"}</span>
                <span>{backupProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
                <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-600 transition-[width] duration-300" style={{ width: `${backupProgress}%` }} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void downloadSystemBackup()}
              disabled={backupBusy || !backupPassword}
              className={`w-full rounded-[18px] bg-gradient-to-b from-pink-500 to-pink-600 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60 ${INFLATED_BUTTON}`}
            >
              {backupBusy ? `Preparing download (${backupProgress}%)...` : backupProgress === 100 ? "Download complete" : "Verify and download"}
            </button>
          </div>
        </SoftModal>
      )}
    </div>
  );
}
