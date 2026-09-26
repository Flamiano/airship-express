"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentRole, getDashboardRouteForRole, getRoleForAuthUser } from "../../lib/roleAccess";
import SensitiveActionOtp from "../../components/SensitiveActionOtp";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import { supabase } from "../../lib/supabaseClient";
import { getBookings, getDrivers, getTrips } from "../../lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TabKey =
  | "overview"
  | "security"
  | "notifications"
  | "workspace"
  | "activity";

type NotificationPrefs = {
  emailAlerts: boolean;
  securityDigest: boolean;
  productUpdates: boolean;
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

type PendingApproval = {
  id: string;
  title: string;
  requestedBy: string;
  type: "Time Off" | "Expense" | "Route Change" | "Equipment";
};

type ManagedUser = {
  id: string;
  name: string;
  role: string;
  status: "Active" | "Invited" | "Suspended";
};

/* ------------------------------------------------------------------ */
/*  Mock data (swap for real API calls)                                */
/* ------------------------------------------------------------------ */

const MOCK_ACTIVITY: ActivityEntry[] = [
  { id: "a1", label: "Signed in", detail: "New session started from Chrome on Windows", timestamp: "Today, 8:12 AM" },
  { id: "a2", label: "Password changed", detail: "Password updated successfully", timestamp: "3 days ago" },
  { id: "a3", label: "Profile updated", detail: "Display name changed", timestamp: "1 week ago" },
  { id: "a4", label: "Signed in", detail: "New session started from Safari on iPhone", timestamp: "1 week ago" },
];

const MOCK_DISPATCH_QUEUE: DispatchLoad[] = [
  { id: "L-2291", route: "Manila → Batangas", driver: "R. Cruz", status: "En Route", eta: "2:40 PM" },
  { id: "L-2292", route: "Caloocan → Bulacan", driver: "J. Santos", status: "Loading", eta: "3:15 PM" },
  { id: "L-2287", route: "Quezon City → Laguna", driver: "M. Reyes", status: "Delayed", eta: "4:50 PM" },
  { id: "L-2280", route: "Pasig → Cavite", driver: "A. Dela Cruz", status: "Delivered", eta: "Completed" },
];

const MOCK_APPROVALS: PendingApproval[] = [
  { id: "p1", title: "Overtime request — Night shift", requestedBy: "J. Santos", type: "Time Off" },
  { id: "p2", title: "Fuel expense reimbursement", requestedBy: "R. Cruz", type: "Expense" },
  { id: "p3", title: "Route deviation — flooding on EDSA", requestedBy: "M. Reyes", type: "Route Change" },
];

const MOCK_USERS: ManagedUser[] = [
  { id: "u1", name: "R. Cruz", role: "Dispatcher", status: "Active" },
  { id: "u2", name: "J. Santos", role: "Driver", status: "Active" },
  { id: "u3", name: "M. Reyes", role: "Driver", status: "Active" },
  { id: "u4", name: "L. Bautista", role: "Manager", status: "Invited" },
  { id: "u5", name: "K. Fernandez", role: "Dispatcher", status: "Suspended" },
];

/* ------------------------------------------------------------------ */
/*  Small shared UI helpers                                            */
/* ------------------------------------------------------------------ */

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "En Route": "bg-blue-50 text-blue-700 border-blue-200",
    Loading: "bg-amber-50 text-amber-700 border-amber-200",
    Delayed: "bg-rose-50 text-rose-700 border-rose-200",
    Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Invited: "bg-blue-50 text-blue-700 border-blue-200",
    Suspended: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
        styles[status] ?? "bg-slate-50 text-slate-700 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  const router = useRouter();
  const [role, setRole] = useState<string>("User");
  const [email, setEmail] = useState("account@airship.com");
  const [displayName, setDisplayName] = useState("Account");
  const [activeTab, setActiveTab] = useState<TabKey>("security");

  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(displayName);
  const [tempEmail, setTempEmail] = useState(email);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    emailAlerts: true,
    securityDigest: false,
    productUpdates: true,
  });

  // Password modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [suspensionTarget, setSuspensionTarget] = useState<ManagedUser | null>(null);
  const [suspensionPassword, setSuspensionPassword] = useState("");
  const [suspensionError, setSuspensionError] = useState<string | null>(null);
  const [suspensionLoading, setSuspensionLoading] = useState(false);

  // Workspace data (role-scoped)
  const [dispatchQueue, setDispatchQueue] = useState<DispatchLoad[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const savedEmail = window.localStorage.getItem("email") || "account@airship.com";
      const savedName = window.localStorage.getItem("displayName") || "Account";
      const nextEmail = user?.email || savedEmail;
      const nextName = user?.user_metadata?.full_name || user?.email || savedName;
      setRole(getRoleForAuthUser(user) ?? getCurrentRole() ?? "User");
      setEmail(nextEmail);
      setTempEmail(nextEmail);
      setDisplayName(nextName);
      setTempDisplayName(nextName);
      setActivity([
        ...(user?.created_at ? [{ id: "created", label: "Account created", detail: "This account was created in Supabase Auth.", timestamp: new Date(user.created_at).toLocaleString() }] : []),
        ...(user?.last_sign_in_at ? [{ id: "sign-in", label: "Last sign-in", detail: "Most recent authenticated session.", timestamp: new Date(user.last_sign_in_at).toLocaleString() }] : []),
      ]);
    };
    void loadUser();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadWorkspaceData = async () => {
      try {
        const [trips, bookings, drivers] = await Promise.all([
          getTrips(),
          getBookings(),
          getDrivers(),
        ]);

        if (!mounted) return;
        const bookingById = new Map((Array.isArray(bookings) ? bookings : []).map((booking: any) => [String(booking.id), booking]));
        setDispatchQueue((Array.isArray(trips) ? trips : []).map((trip: any) => {
          const statusText = String(trip.status ?? "Scheduled").replace(/[_-]+/g, " ");
          const status: DispatchLoad["status"] = /delayed|late/i.test(statusText)
            ? "Delayed"
            : /delivered|completed/i.test(statusText)
              ? "Delivered"
              : /in transit|transit|dispatch|route|moving|en route/i.test(statusText)
                ? "En Route"
                : "Loading";
          const booking = bookingById.get(String(trip.booking_id ?? trip.bookingId));
          return {
            id: String(trip.id ?? trip.trip_id ?? "Trip"),
            route: [trip.from_location ?? booking?.pickup_location, trip.to_location ?? booking?.dropoff_location].filter(Boolean).join(" -> ") || "Route unavailable",
            driver: trip.driver_name ?? trip.driverName ?? "Unassigned",
            status,
            eta: trip.estimated_arrival ?? trip.estimatedArrival ?? "Not scheduled",
          };
        }));
        setManagedUsers((Array.isArray(drivers) ? drivers : []).map((driver: any) => ({
          id: String(driver.id),
          name: driver.full_name ?? driver.name ?? driver.email ?? "Unnamed user",
          role: String(driver.role ?? "Driver").replace(/_/g, " "),
          status: /suspended/i.test(String(driver.status ?? "")) ? "Suspended" : "Active",
        })));
        setApprovals([]);
        setWorkspaceError(null);
      } catch (error) {
        if (mounted) setWorkspaceError(error instanceof Error ? error.message : "Unable to load workspace data.");
      } finally {
        if (mounted) setWorkspaceLoading(false);
      }
    };

    void loadWorkspaceData();
    return () => {
      mounted = false;
    };
  }, []);

  const normalizedRole = useMemo(() => String(role).toLowerCase().replace(/[_\s]/g, ""), [role]);
  const isAdmin = normalizedRole.includes("admin");
  const isDispatcher = normalizedRole.includes("dispatch");
  const isManager = normalizedRole.includes("manager");
  const hasWorkspaceTools = isAdmin || isDispatcher || isManager;

  const initials =
    displayName
      .split(/[\s@.-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "A";

  const showToast = (message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      const { error } = await supabase.auth.updateUser({ email: tempEmail, data: { full_name: tempDisplayName } });
      if (error) {
        showToast(error.message);
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

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }
    void (async () => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showToast(error.message);
        return;
      }
      setIsPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password successfully changed.");
    })();
  };

  const toggleNotification = (key: keyof NotificationPrefs) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const approveRequest = (id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    showToast("Request approved.");
  };

  const declineRequest = (id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    showToast("Request declined.");
  };

  const toggleUserStatus = (id: string) => {
    setManagedUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === "Suspended" ? "Active" : "Suspended" } : u
      )
    );
  };

  const requestUserSuspension = (user: ManagedUser) => {
    if (user.status === "Suspended") {
      toggleUserStatus(user.id);
      return;
    }
    setSuspensionTarget(user);
    setSuspensionPassword("");
    setSuspensionError(null);
  };

  const confirmUserSuspension = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!suspensionTarget || !email) return;

    setSuspensionLoading(true);
    setSuspensionError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: suspensionPassword,
    });

    if (error) {
      setSuspensionError("Password verification failed. Suspension was not applied.");
      setSuspensionLoading(false);
      return;
    }

    toggleUserStatus(suspensionTarget.id);
    setSuspensionTarget(null);
    setSuspensionPassword("");
    setSuspensionLoading(false);
    showToast(`${suspensionTarget.name} was suspended after verification.`);
  };

  const reassignLoad = (id: string) => {
    showToast(`Load ${id} flagged for reassignment.`);
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "security", label: "Security" },
    { key: "notifications", label: "Notifications" },
    ...(hasWorkspaceTools ? [{ key: "workspace" as TabKey, label: "Workspace Tools" }] : []),
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 font-sans selection:bg-pink-500 selection:text-white">
      <GlobalNavbar />

      <div className="flex flex-1 w-full overflow-hidden">
        {/* ---------------- Sidebar ---------------- */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-pink-100 bg-white px-5 py-8 shadow-sm sm:flex overflow-y-auto">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-pink-600 text-2xl font-black text-white shadow-lg shadow-pink-500/20">
              {initials}
            </div>
            <div className="mt-4 text-lg font-black text-slate-900">{displayName}</div>
            <div className="truncate text-xs text-slate-500">{email}</div>
            <span className="mt-3 inline-flex items-center rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-pink-700">
              {String(role).replace(/_/g, " ")}
            </span>
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            <a
              href="/account/profile"
              className="rounded-xl px-4 py-2.5 text-left text-sm font-bold text-slate-600 transition-all hover:bg-pink-50"
            >
              Profile
            </a>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-4 py-2.5 text-left text-sm font-bold transition-all ${
                  activeTab === tab.key
                    ? "bg-pink-600 text-white shadow-md shadow-pink-500/20"
                    : "text-slate-600 hover:bg-pink-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <a
            href={getDashboardRouteForRole(role)}
            className="mt-auto inline-flex items-center justify-center rounded-xl border border-pink-200 bg-white px-5 py-2.5 text-sm font-bold text-pink-700 transition-all hover:bg-pink-50"
          >
            Back to Dashboard
          </a>
        </aside>

        {/* ---------------- Main content ---------------- */}
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-[1440px]">
            {/* Mobile header (sidebar hidden below sm) */}
            <div className="mb-6 flex items-center justify-between sm:hidden">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-pink-700">Profile</p>
                <h1 className="mt-1 text-2xl font-black text-slate-900">{displayName}</h1>
              </div>
              <a
                href={getDashboardRouteForRole(role)}
                className="rounded-xl bg-pink-600 px-4 py-2 text-xs font-bold text-white"
              >
                Dashboard
              </a>
            </div>

            <div className="mb-6 hidden sm:block">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-pink-700">Account Center</p>
              <h1 className="mt-1 text-3xl font-black text-slate-900">Account Settings</h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage security, notifications, and role-specific workspace tools.
              </p>
            </div>

            {/* Mobile tab strip */}
            <div className="mb-6 flex gap-2 overflow-x-auto sm:hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                    activeTab === tab.key
                      ? "bg-pink-600 text-white"
                      : "border border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {statusMessage && (
              <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 animate-fadeIn">
                {statusMessage}
              </div>
            )}
            {workspaceLoading && (
              <div className="mb-6 rounded-xl border border-pink-100 bg-pink-50 p-4 text-sm font-medium text-pink-700">
                Loading live workspace data...
              </div>
            )}
            {workspaceError && (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
                {workspaceError}
              </div>
            )}

            {/* ---------------- Overview tab ---------------- */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Profile</p>
                      <button
                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                        className="text-xs font-semibold text-pink-700 hover:underline"
                      >
                        {isEditingProfile ? "Cancel" : "Edit Profile"}
                      </button>
                    </div>

                    {!isEditingProfile ? (
                      <div className="mt-4 flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-pink-600 text-lg font-black text-white shadow-inner">
                          {initials}
                        </div>
                        <div className="overflow-hidden">
                          <div className="truncate text-xl font-black text-slate-900">{displayName}</div>
                          <div className="truncate text-sm text-slate-500">{email}</div>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveProfile} className="mt-4 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">Display Name</label>
                          <input
                            type="text"
                            value={tempDisplayName}
                            onChange={(e) => setTempDisplayName(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-pink-500 focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">Email Address</label>
                          <input
                            type="email"
                            value={tempEmail}
                            onChange={(e) => setTempEmail(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-pink-500 focus:outline-none"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          Save Changes
                        </button>
                      </form>
                    )}
                  </div>

                  <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Access Control</p>
                    <div className="mt-4 text-xl font-black text-slate-900">{String(role).replace(/_/g, " ")}</div>
                    <div className="mt-2 text-sm text-slate-500">
                      Role-based workspace permissions are active. Your credential tier dictates module accessibility.
                    </div>
                    {hasWorkspaceTools && (
                      <button
                        onClick={() => setActiveTab("workspace")}
                        className="mt-4 inline-flex items-center rounded-xl bg-pink-600 px-4 py-2 text-xs font-bold text-white hover:bg-pink-700"
                      >
                        Open Workspace Tools →
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick stat strip, varies by role */}
                <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Snapshot</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {isAdmin && (
                      <>
                        <StatCard label="Total Users" value={String(managedUsers.length)} sub="Across all roles" />
                        <StatCard label="Suspended" value={String(managedUsers.filter((u) => u.status === "Suspended").length)} />
                        <StatCard label="Pending Invites" value={String(managedUsers.filter((u) => u.status === "Invited").length)} />
                      </>
                    )}
                    {isDispatcher && !isAdmin && (
                      <>
                        <StatCard label="Active Loads" value={String(dispatchQueue.filter((l) => l.status !== "Delivered").length)} />
                        <StatCard label="Delayed" value={String(dispatchQueue.filter((l) => l.status === "Delayed").length)} />
                        <StatCard label="Delivered Today" value={String(dispatchQueue.filter((l) => l.status === "Delivered").length)} />
                      </>
                    )}
                    {isManager && !isAdmin && !isDispatcher && (
                      <>
                        <StatCard label="Pending Approvals" value={String(approvals.length)} />
                        <StatCard label="Team Size" value={String(managedUsers.length)} />
                        <StatCard label="Open Flags" value={String(dispatchQueue.filter((l) => l.status === "Delayed").length)} />
                      </>
                    )}
                    {!hasWorkspaceTools && (
                      <>
                        <StatCard label="Account Status" value="Active" />
                        <StatCard label="Security" value="OTP Enabled" />
                        <StatCard label="Member Since" value="—" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- Security tab ---------------- */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900">Security & Authentication</h2>
                  <p className="text-sm text-slate-500">Manage your password protection and sign-in credentials.</p>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <p className="font-bold text-slate-800">Password</p>
                      <p className="text-xs text-slate-500">Password managed by Supabase Auth</p>
                    </div>
                    <button
                      onClick={() => setIsPasswordModalOpen(true)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Change Password
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <p className="font-bold text-slate-800">Active Sessions</p>
                      <p className="text-xs text-slate-500">Session count is not exposed by the current Auth API</p>
                    </div>
                    <button
                      onClick={() => showToast("All other sessions signed out.")}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Sign Out Other Sessions
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 mb-2">Verify Sensitive Action</h2>
                  <p className="text-sm text-slate-500 mb-4">
                    Elevated actions ({isAdmin ? "user management, " : ""}
                    {isDispatcher ? "route overrides, " : ""}
                    {isManager ? "approval overrides, " : ""}
                    payout changes) require one-time verification.
                  </p>
                  <SensitiveActionOtp
                    onVerified={() => showToast("Sensitive action verified. Protected settings may now be changed.")}
                  />
                </div>
              </div>
            )}

            {/* ---------------- Notifications tab ---------------- */}
            {activeTab === "notifications" && (
              <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-900">Notification Preferences</h2>
                <p className="text-sm text-slate-500">Choose what updates you want to receive in your inbox.</p>

                <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="block font-bold text-slate-800 text-sm">Email Alerts</span>
                      <span className="block text-xs text-slate-500">Receive important security and account status updates</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.emailAlerts}
                      onChange={() => toggleNotification("emailAlerts")}
                      className="h-5 w-5 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="block font-bold text-slate-800 text-sm">Security Digest</span>
                      <span className="block text-xs text-slate-500">Weekly summary of login locations and activity logs</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.securityDigest}
                      onChange={() => toggleNotification("securityDigest")}
                      className="h-5 w-5 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="block font-bold text-slate-800 text-sm">Product Updates</span>
                      <span className="block text-xs text-slate-500">Get notified about new features and improvements</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.productUpdates}
                      onChange={() => toggleNotification("productUpdates")}
                      className="h-5 w-5 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                    />
                  </label>

                  {hasWorkspaceTools && (
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="block font-bold text-slate-800 text-sm">
                          {isDispatcher ? "Dispatch Alerts" : isAdmin ? "System Alerts" : "Approval Alerts"}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {isDispatcher
                            ? "Get notified when a load is delayed or reassigned"
                            : isAdmin
                            ? "Get notified on suspicious sign-ins and system errors"
                            : "Get notified when a new request needs your approval"}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="h-5 w-5 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* ---------------- Workspace Tools tab (role gated) ---------------- */}
            {activeTab === "workspace" && hasWorkspaceTools && (
              <div className="space-y-6">
                {/* Admin: user management + system health */}
                {isAdmin && (
                  <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-black text-slate-900">User Management</h2>
                      <button
                        onClick={() => showToast("Invite link generated.")}
                        className="rounded-xl bg-pink-600 px-4 py-2 text-xs font-bold text-white hover:bg-pink-700"
                      >
                        + Invite User
                      </button>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                            <th className="py-2 pr-4">Name</th>
                            <th className="py-2 pr-4">Role</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 pr-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {managedUsers.map((u) => (
                            <tr key={u.id} className="border-b border-slate-50 last:border-0">
                              <td className="py-3 pr-4 font-semibold text-slate-800">{u.name}</td>
                              <td className="py-3 pr-4 text-slate-500">{u.role}</td>
                              <td className="py-3 pr-4">
                                <StatusPill status={u.status} />
                              </td>
                              <td className="py-3 pr-4 text-right">
                                <button
                                  onClick={() => requestUserSuspension(u)}
                                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                  {u.status === "Suspended" ? "Reactivate" : "Suspend"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900 mb-4">System Health</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <StatCard label="API Uptime" value="—" sub="Metric unavailable" />
                      <StatCard label="Failed Logins" value="—" sub="Metric unavailable" />
                      <StatCard label="Audit Events" value="—" sub="Metric unavailable" />
                    </div>
                    <button
                      onClick={() => showToast("Opening full audit log…")}
                      className="mt-4 text-xs font-bold text-pink-700 hover:underline"
                    >
                      View full audit log →
                    </button>
                  </div>
                )}

                {/* Dispatcher: dispatch queue */}
                {isDispatcher && (
                  <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-black text-slate-900">Dispatch Queue</h2>
                      <button
                        onClick={() => showToast("Dispatch board refreshed.")}
                        className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                            <th className="py-2 pr-4">Load</th>
                            <th className="py-2 pr-4">Route</th>
                            <th className="py-2 pr-4">Driver</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 pr-4">ETA</th>
                            <th className="py-2 pr-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dispatchQueue.map((l) => (
                            <tr key={l.id} className="border-b border-slate-50 last:border-0">
                              <td className="py-3 pr-4 font-semibold text-slate-800">{l.id}</td>
                              <td className="py-3 pr-4 text-slate-500">{l.route}</td>
                              <td className="py-3 pr-4 text-slate-500">{l.driver}</td>
                              <td className="py-3 pr-4">
                                <StatusPill status={l.status} />
                              </td>
                              <td className="py-3 pr-4 text-slate-500">{l.eta}</td>
                              <td className="py-3 pr-4 text-right">
                                <button
                                  onClick={() => reassignLoad(l.id)}
                                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                  Reassign
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Manager: pending approvals */}
                {isManager && (
                  <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900">Pending Approvals</h2>
                    <p className="text-sm text-slate-500 mb-4">Requests from your team awaiting a decision.</p>
                    {approvals.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">All caught up — no pending requests.</p>
                    ) : (
                      <div className="space-y-3">
                        {approvals.map((a) => (
                          <div
                            key={a.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{a.title}</p>
                              <p className="text-xs text-slate-500">
                                {a.type} · Requested by {a.requestedBy}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveRequest(a.id)}
                                className="rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-pink-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => declineRequest(a.id)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isManager && (
                  <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900 mb-4">Team Performance</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <StatCard label="On-Time Rate" value="—" sub="Metric unavailable" />
                      <StatCard label="Team Size" value={String(managedUsers.length)} />
                      <StatCard label="Open Flags" value={String(dispatchQueue.filter((l) => l.status === "Delayed").length)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------------- Activity tab ---------------- */}
            {activeTab === "activity" && (
              <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-900">Recent Activity</h2>
                <p className="text-sm text-slate-500 mb-4">A log of recent actions on your account.</p>
                <div className="space-y-3">
                  {activity.length === 0 ? (
                    <p className="text-sm text-slate-500">No account activity is available.</p>
                  ) : activity.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{entry.label}</p>
                        <p className="text-xs text-slate-500">{entry.detail}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-slate-400">{entry.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-scaleUp">
            <h3 className="text-xl font-black text-slate-900">Change Password</h3>
            <p className="text-xs text-slate-500 mt-1">Please enter your current password and choose a secure new one.</p>

            <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-pink-600 px-4 py-2 text-xs font-bold text-white hover:bg-pink-700"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {suspensionTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form onSubmit={confirmUserSuspension} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900">Verify suspension</h3>
            <p className="mt-2 text-sm text-slate-600">
              Enter your current account password to suspend {suspensionTarget.name}.
            </p>
            <label className="mt-5 block text-xs font-bold text-slate-700">
              Account password
              <input
                type="password"
                value={suspensionPassword}
                onChange={(event) => setSuspensionPassword(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                autoFocus
                required
              />
            </label>
            {suspensionError && <p className="mt-3 text-xs font-semibold text-rose-700">{suspensionError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSuspensionTarget(null)}
                disabled={suspensionLoading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={suspensionLoading || !suspensionPassword}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {suspensionLoading ? "Verifying..." : "Verify & Suspend"}
              </button>
            </div>
          </form>
        </div>
      )}

      <GlobalFooter />
    </div>
  );
}