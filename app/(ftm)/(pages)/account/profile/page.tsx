"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, Bell, Check, ChevronRight, Clock3, KeyRound, LogOut, Mail,
  MapPin, Package, Pencil, ShieldCheck, Truck, UserRound, X,
} from "lucide-react";
import GlobalFooter from "../../../components/global/GlobalFooter";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import FtmProfileAvatar from "../../../components/global/FtmProfileAvatar";
import { useFtmProfileAvatar } from "../../../components/providers/FtmProfileAvatarProvider";
import { useFtmSettings } from "../../../components/providers/FtmSettingsProvider";
import { fetchJson, getAdminUsers, getCurrentProfile, updateCurrentProfile } from "../../../lib/api";
import { signOut } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase/supabaseClient";
import { getDashboardRouteForRole, getRoleForAuthUser, normalizeRole, type AppRole } from "../../../lib/roleAccess";
import { PERMISSIONS, type PermissionModule } from "../../../lib/permissions";

type ProfileRecord = Awaited<ReturnType<typeof getCurrentProfile>>;
type Row = Record<string, unknown>;
type Section = "account" | "workspace" | "security";
type FleetSnapshot = { counts?: Record<string, number>; vehicles?: Row[]; trips?: Row[]; drivers?: Row[] };

const MODULE_LABELS: Record<PermissionModule, string> = {
  operations: "Operations", alerts: "Alerts", costAnalysis: "Cost analysis", driverPerformance: "Driver tools",
  fuelManagement: "Fuel management", gallery: "Documents & proof", fvm: "Fleet management", vrds: "Dispatch",
  userManagement: "User management", roleManagement: "Role management", systemSettings: "System settings",
};

function displayDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : null;
}

function normalizedStatus(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function activeTrip(row: Row) {
  const status = normalizedStatus(row.status);
  return /assigned|scheduled|dispatch|transit|moving|en route|pickup|progress|delayed|late/.test(status)
    && !/complete|delivered|arrived|cancel|reject|fail/.test(status);
}

function DataLine({ label, value, icon: Icon }: { label: string; value: string | null; icon?: typeof UserRound }) {
  if (!value) return null;
  return <div className="flex min-w-0 items-start justify-between gap-4 border-b border-pink-50 py-3 last:border-0"><span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">{Icon && <Icon className="h-3.5 w-3.5 text-pink-600" />}{label}</span><span className="min-w-0 break-words text-right text-xs font-semibold text-slate-800">{value}</span></div>;
}

function ProfileModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" className="w-full max-w-md rounded-2xl border border-pink-100 bg-white p-5 shadow-2xl"><header className="mb-4 flex items-center justify-between"><h2 id="profile-modal-title" className="text-base font-black text-slate-900">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-pink-50"><X className="h-4 w-4" /></button></header>{children}</section></div>;
}

export default function ProfilePage() {
  const router = useRouter();
  const { settings, updateSettings } = useFtmSettings();
  const { avatarUrl, previewUrl, pendingImage, busy: avatarBusy, progress: avatarProgress, error: avatarError, chooseFile, save: saveAvatar, remove: removeAvatar, clearPreview } = useFtmProfileAvatar();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [fleetSnapshot, setFleetSnapshot] = useState<FleetSnapshot | null>(null);
  const [adminUsers, setAdminUsers] = useState<Row[]>([]);
  const [driverTrips, setDriverTrips] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [section, setSection] = useState<Section>("account");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"avatar" | "password" | "sessions" | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [newAvatarColor, setNewAvatarColor] = useState("#db2777");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data: authResult } = await supabase.auth.getUser();
          if (!active) return;
          const user = authResult.user;
          const authRole = getRoleForAuthUser(user);
          let currentProfile: ProfileRecord;
          try {
            currentProfile = await getCurrentProfile();
          } catch (profileError) {
            if (!user || authRole !== "customer") throw profileError;
            currentProfile = {
              id: user.id,
              email: user.email || null,
              full_name: user.user_metadata?.full_name || null,
              avatar_url: user.user_metadata?.avatar_url || null,
              role: "customer",
              phone: user.user_metadata?.phone || null,
              username: user.user_metadata?.username || null,
              is_active: true,
              created_at: user.created_at,
              last_sign_in_at: user.last_sign_in_at,
            };
          }
          if (!active) return;
          const savedAvatarColor = window.localStorage.getItem("avatarColor");
          if (savedAvatarColor && /^#[0-9a-f]{6}$/i.test(savedAvatarColor)) setNewAvatarColor(savedAvatarColor);
          const currentRole = normalizeRole(currentProfile.role) || authRole;
          setProfile(currentProfile);
          setRole(currentRole);
          setDraftName(currentProfile.full_name || user?.email || "");
          setDraftEmail(currentProfile.email || user?.email || "");
          setDraftPhone(currentProfile.phone || user?.user_metadata?.phone || "");
          setLastSignIn(currentProfile.last_sign_in_at || user?.last_sign_in_at || null);
          setEmailVerified(Boolean(user?.email_confirmed_at));

          if (currentRole === "admin") {
            const [dashboardResult, usersResult] = await Promise.allSettled([
              fetchJson("/api/dashboard", { cache: "no-store" }),
              getAdminUsers(),
            ]);
            if (!active) return;
            if (dashboardResult.status === "fulfilled") setFleetSnapshot(dashboardResult.value as FleetSnapshot);
            if (usersResult.status === "fulfilled" && Array.isArray(usersResult.value)) setAdminUsers(usersResult.value as Row[]);
          } else if (currentRole === "fleet_manager" || currentRole === "dispatcher") {
            try { setFleetSnapshot(await fetchJson("/api/dashboard", { cache: "no-store" }) as FleetSnapshot); }
            catch (error) { if (active) setPageError(error instanceof Error ? error.message : "Workspace data is unavailable."); }
          } else if (currentRole === "driver") {
            try {
              const rows = await fetchJson("/api/trips", { cache: "no-store" });
              if (active) setDriverTrips(Array.isArray(rows) ? rows as Row[] : []);
            } catch (error) { if (active) setPageError(error instanceof Error ? error.message : "Assigned trips are unavailable."); }
          }
        } catch (error) {
          if (active) setPageError(error instanceof Error ? error.message : "Unable to load this profile.");
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  const fullName = profile?.full_name || "Account";
  const roleName = role ? role.replace(/_/g, " ") : "Unassigned role";
  const permissions = useMemo(() => role ? Object.entries(PERMISSIONS[role]).flatMap(([module, actions]) => actions.length ? [{ module: MODULE_LABELS[module as PermissionModule], actions }] : []) : [], [role]);
  const activeTrips = (fleetSnapshot?.trips || []).filter(activeTrip);
  const fleetVehicles = fleetSnapshot?.vehicles || [];
  const fleetDrivers = fleetSnapshot?.drivers || [];
  const assignedTrips = driverTrips.filter((trip) => String(trip.driver_id || trip.driverId || "") === String(profile?.id || ""));
  const currentTrip = assignedTrips.find(activeTrip) || null;
  const roleLinks = role === "admin"
    ? [{ label: "User & driver accounts", href: "/users" }, { label: "Vehicle management", href: "/fvm/inventory" }, { label: "Fleet reports", href: "/fvm/analytics" }, { label: "System settings", href: "/account/settings" }]
    : role === "fleet_manager"
      ? [{ label: "Vehicle inventory", href: "/fvm/inventory" }, { label: "Driver & vehicle assignments", href: "/vrds/bookings" }, { label: "Fleet analytics", href: "/fvm/analytics" }, { label: "Delivery monitoring", href: "/vrds/missions" }]
      : role === "dispatcher"
        ? [{ label: "Dispatch board", href: "/vrds/missions" }, { label: "Assignments", href: "/vrds/bookings" }, { label: "Fleet availability", href: "/fvm" }, { label: "Route planning", href: "/vrds/route-planning" }]
        : role === "driver"
          ? [{ label: "Driver overview", href: "/driver/overview" }, { label: "Assigned trips", href: "/driver/overview" }, { label: "Trip history", href: "/driver/overview" }, { label: "Pickup proof", href: "/fuel/proof-pickup" }]
          : role === "customer"
            ? []
            : [{ label: "My dashboard", href: getDashboardRouteForRole(role) }];

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setPageError("");
    try {
      const emailChanged = draftEmail.trim().toLowerCase() !== (profile.email || "").toLowerCase();
      if (emailChanged) {
        const { error } = await supabase.auth.updateUser({ email: draftEmail.trim() });
        if (error) throw error;
      }
      const saved = role === "customer"
        ? { id: profile.id, full_name: draftName.trim(), phone: draftPhone.trim(), updated_at: new Date().toISOString() }
        : await updateCurrentProfile({ full_name: draftName.trim(), phone: draftPhone.trim() });
      const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: draftName.trim(), phone: draftPhone.trim() } });
      if (metadataError) throw metadataError;
      setProfile((current) => current ? { ...current, full_name: saved.full_name, phone: saved.phone, email: emailChanged ? current.email : draftEmail.trim(), updated_at: saved.updated_at } : current);
      setEditing(false);
      if (emailChanged) flash("Profile saved. Confirm the email change using the message sent to your inbox.");
      else flash("Profile changes saved.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to save profile changes.");
    } finally { setSaving(false); }
  }

  async function updatePassword() {
    if (password.length < 8) { setPageError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setPageError("Passwords do not match."); return; }
    setPasswordBusy(true); setPageError("");
    const { error } = await supabase.auth.updateUser({ password });
    setPasswordBusy(false);
    if (error) { setPageError(error.message); return; }
    setPassword(""); setConfirmPassword(""); setModal(null); flash("Password updated.");
  }

  async function signOutOtherSessions() {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) { setPageError(error.message); return; }
    setModal(null); flash("Other sessions were signed out.");
  }

  async function logout() {
    const result = await signOut();
    if (result.error) { setPageError(result.error.message); return; }
    router.replace("/ftmAuth");
  }

  async function saveAvatarImage() {
    try { await saveAvatar(); setModal(null); flash("Profile picture updated."); }
    catch (error) { setPageError(error instanceof Error ? error.message : "Unable to update profile picture."); }
  }

  const inputClass = "mt-1 block w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100";
  const tabClass = (active: boolean) => `border-b-2 px-3 py-2.5 text-xs font-bold ${active ? "border-pink-600 text-pink-700" : "border-transparent text-slate-500 hover:text-slate-800"}`;
  const accountStatus = profile?.is_active === false ? "Inactive" : "Active";

  return (
    <div className="min-h-screen bg-[#fffafd] text-slate-800">
      <GlobalNavbar />
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <header className="ftm-soft-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-pink-700">Account center</p><h1 className="mt-1 text-2xl font-black text-slate-900">My profile</h1><p className="mt-1 text-xs text-slate-500">Authenticated identity, role access, and account controls.</p></div><button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-lg border border-pink-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-pink-50"><LogOut className="h-3.5 w-3.5" />Sign out</button></header>

        {pageError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"><span>{pageError}</span><button type="button" aria-label="Dismiss error" onClick={() => setPageError("")}><X className="h-4 w-4" /></button></div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{notice}</div>}

        <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="ftm-soft-panel flex flex-col gap-4 rounded-2xl p-4">
            {loading ? <div className="h-28 animate-pulse rounded-xl bg-pink-50" /> : <>
              <div className="flex items-center gap-3"><button type="button" onClick={() => role !== "customer" && setModal("avatar")} disabled={role === "customer"} aria-label="Change profile picture" style={{ backgroundColor: newAvatarColor }} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-pink-100 disabled:cursor-default"><FtmProfileAvatar name={fullName} src={previewUrl || avatarUrl} className="h-full w-full object-cover" /><span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white opacity-0 transition hover:bg-slate-950/50 hover:opacity-100"><Pencil className="h-4 w-4" /></span></button><div className="min-w-0"><p className="truncate text-base font-black text-slate-900">{fullName}</p>{profile?.email ? <p className="truncate text-xs text-slate-500">{profile.email}</p> : null}<span className="mt-1.5 inline-flex rounded-full border border-pink-200 bg-pink-50 px-2 py-0.5 text-[9px] font-bold capitalize text-pink-700">{roleName}</span></div></div>
              <div className="grid grid-cols-2 gap-2"><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Account</p><p className={`mt-1 text-xs font-bold ${accountStatus === "Active" ? "text-emerald-700" : "text-rose-700"}`}>{accountStatus}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Email</p><p className={`mt-1 text-xs font-bold ${emailVerified ? "text-emerald-700" : "text-amber-700"}`}>{emailVerified ? "Verified" : "Unverified"}</p></div></div>
            </>}
            <nav aria-label="Profile sections" className="mt-1 space-y-1 border-t border-pink-100 pt-3">{([{ id: "account", label: "Account details", icon: UserRound }, { id: "workspace", label: "Role workspace", icon: Activity }, { id: "security", label: "Security & activity", icon: ShieldCheck }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition ${section === id ? "bg-pink-50 text-pink-700" : "text-slate-600 hover:bg-pink-50/60"}`}><Icon className="h-4 w-4" />{label}<ChevronRight className="ml-auto h-3.5 w-3.5" /></button>)}</nav>
          </aside>

          <section className="min-w-0">
            {loading ? <div className="ftm-soft-panel h-96 animate-pulse rounded-2xl bg-pink-50/60" /> : !profile ? <div className="ftm-soft-panel rounded-2xl p-8 text-center"><p className="text-sm font-bold">Profile unavailable</p><p className="mt-2 text-xs text-slate-500">Sign in again to load your account profile.</p><button type="button" onClick={() => router.push("/ftmAuth")} className="mt-4 rounded-lg bg-pink-600 px-4 py-2 text-xs font-bold text-white">Sign in</button></div> : <>
              {section === "account" && <div className="ftm-soft-panel rounded-2xl p-4 sm:p-5"><header className="flex items-center justify-between gap-4 border-b border-pink-100 pb-3"><div><h2 className="text-sm font-black text-slate-900">Personal information</h2><p className="mt-1 text-[10px] text-slate-500">Changes update your authenticated profile record.</p></div>{!editing && <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-pink-200 bg-white px-3 py-2 text-[10px] font-bold text-pink-700"><Pencil className="h-3 w-3" />Edit</button>}</header>
                {editing ? <form onSubmit={saveProfile} className="mt-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-bold">Full name<input required minLength={2} maxLength={120} value={draftName} onChange={(event) => setDraftName(event.target.value)} className={inputClass} /></label><label className="text-[11px] font-bold">Email address<input required type="email" value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} className={inputClass} /><span className="mt-1 block text-[9px] font-normal text-slate-500">A confirmation message may be required to change email.</span></label><label className="text-[11px] font-bold">Contact number<input maxLength={40} value={draftPhone} onChange={(event) => setDraftPhone(event.target.value)} className={inputClass} /></label></div><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditing(false); setDraftName(profile.full_name || ""); setDraftEmail(profile.email || ""); setDraftPhone(profile.phone || ""); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-pink-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save profile"}</button></div></form> : <div className="mt-2 grid gap-x-8 sm:grid-cols-2"> <DataLine label="User ID" value={profile.id} />{profile.full_name ? <DataLine label="Full name" value={profile.full_name} /> : null}{profile.email ? <DataLine label="Email" value={profile.email} icon={Mail} /> : null}{profile.phone ? <DataLine label="Contact number" value={profile.phone} /> : null}{profile.username ? <DataLine label="Username" value={profile.username} /> : null}<DataLine label="Role" value={roleName} /><DataLine label="Account status" value={accountStatus} /><DataLine label="Registered" value={displayDate(profile.created_at)} icon={Clock3} /><DataLine label="Last login" value={displayDate(lastSignIn)} icon={Clock3} />{profile.employee_id && <DataLine label="Employee ID" value={profile.employee_id} />}{profile.department && <DataLine label="Department" value={profile.department} />}{profile.license_number && <DataLine label="Driver license" value={profile.license_number} />}{profile.license_expiry && <DataLine label="License expiry" value={displayDate(profile.license_expiry)} />}</div>}
              </div>}

              {section === "workspace" && <div className="space-y-4"><article className="ftm-soft-panel rounded-2xl p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-pink-700">{roleName}</p><h2 className="mt-1 text-sm font-black text-slate-900">Role workspace</h2><p className="mt-1 text-xs text-slate-500">Quick access and live statistics for your authorized work.</p></div>{role !== "customer" && <a href={getDashboardRouteForRole(role)} className="inline-flex items-center gap-1.5 rounded-lg border border-pink-200 bg-white px-3 py-2 text-xs font-bold text-pink-700">Open dashboard<ArrowRight className="h-3.5 w-3.5" /></a>}</div>
                {role === "admin" && <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4"><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Total users</p><p className="mt-1 text-xl font-black">{adminUsers.length}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Fleet vehicles</p><p className="mt-1 text-xl font-black">{fleetVehicles.length}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Active drivers</p><p className="mt-1 text-xl font-black">{fleetDrivers.filter((driver) => driver.is_active !== false).length}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Active trips</p><p className="mt-1 text-xl font-black">{activeTrips.length}</p></div></div>}
                {(role === "fleet_manager" || role === "dispatcher") && <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4"><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Active trips</p><p className="mt-1 text-xl font-black">{activeTrips.length}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Vehicles</p><p className="mt-1 text-xl font-black">{fleetVehicles.length}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Available vehicles</p><p className="mt-1 text-xl font-black">{fleetVehicles.filter((vehicle) => /available|ready/i.test(String(vehicle.status || ""))).length}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Drivers</p><p className="mt-1 text-xl font-black">{fleetDrivers.filter((driver) => driver.is_active !== false).length}</p></div></div>}
                {role === "driver" && <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Assigned vehicle</p><p className="mt-1 text-sm font-bold">{String(currentTrip?.vehicle_plate || currentTrip?.vehicle_id || "No active vehicle assignment")}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Current trip</p><p className="mt-1 text-sm font-bold">{String(currentTrip?.id || "No active trip")}</p><p className="mt-1 text-[10px] text-slate-500">{String(currentTrip?.status || "")}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Driver availability</p><p className="mt-1 text-sm font-bold">{currentTrip ? "On trip" : profile.is_active === false ? "Inactive" : "Available"}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Trip history</p><p className="mt-1 text-sm font-bold">{assignedTrips.length} records</p></div></div>}
                {role === "customer" && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-slate-800">Customer shipment records</p><p className="mt-1 text-xs text-slate-600">Shipment history, delivery tracking, and proof of delivery are not exposed by the FTM customer APIs. Your authenticated profile details remain available here.</p></div>}
              </article><article className="ftm-soft-panel rounded-2xl p-4 sm:p-5"><h3 className="text-xs font-black text-slate-900">Authorized shortcuts</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{roleLinks.map((link) => <a key={link.href + link.label} href={link.href} className="flex items-center justify-between gap-3 rounded-lg border border-pink-100 bg-white px-3 py-3 text-xs font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-700">{link.label}<ArrowRight className="h-3.5 w-3.5 text-pink-600" /></a>)}</div></article>{role === "driver" && <article className="ftm-soft-panel rounded-2xl p-4"><h3 className="text-xs font-black">Assigned trip history</h3>{assignedTrips.length ? <div className="mt-3 divide-y divide-pink-100">{assignedTrips.map((trip) => { const fromLocation = trip.from_location ?? trip.origin ?? trip.pickup_location ?? null; const toLocation = trip.to_location ?? trip.destination ?? trip.dropoff_location ?? null; const hasRouteLocation = Boolean(fromLocation || toLocation); return <div key={String(trip.id)} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span className="font-mono font-bold text-pink-700">{String(trip.id)}</span>{hasRouteLocation ? <span>{fromLocation ? String(fromLocation) : "Origin unavailable"}{toLocation ? ` → ${String(toLocation)}` : ""}</span> : <span>Route details unavailable</span>}<span className="rounded-full bg-slate-100 px-2 py-1 text-[10px]">{String(trip.status || "Unknown")}</span></div>; })}</div> : <p className="mt-3 text-xs text-slate-500">No trip history was returned for this account.</p>}</article>}</div>}

              {section === "security" && <div className="grid gap-4 xl:grid-cols-2"><article className="ftm-soft-panel rounded-2xl p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-pink-600" /><h2 className="text-sm font-black">Security</h2></div><div className="mt-3 space-y-2"><button type="button" onClick={() => setModal("password")} className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-3 text-left text-xs font-semibold"><span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-pink-600" />Change password</span><ChevronRight className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setModal("sessions")} className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-3 text-left text-xs font-semibold"><span className="flex items-center gap-2"><LogOut className="h-4 w-4 text-pink-600" />Sign out other sessions</span><ChevronRight className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void logout()} className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-3 text-left text-xs font-semibold"><span className="flex items-center gap-2"><LogOut className="h-4 w-4 text-rose-600" />Sign out this device</span><ChevronRight className="h-3.5 w-3.5" /></button></div></article>
                <article className="ftm-soft-panel rounded-2xl p-4"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-pink-600" /><h2 className="text-sm font-black">Notification preferences</h2></div><p className="mt-1 text-[10px] text-slate-500">Saved with this device&apos;s FTM preferences.</p><div className="mt-3 divide-y divide-pink-50">{(["email", "sms", "push"] as const).map((key) => <label key={key} className="flex items-center justify-between py-2.5 text-xs font-semibold capitalize"><span>{key} notifications</span><input type="checkbox" checked={settings.notifications[key]} onChange={(event) => updateSettings("notifications", { [key]: event.target.checked })} className="h-4 w-4 accent-pink-600" /></label>)}</div><div className="mt-3 border-t border-pink-100 pt-3"><p className="text-[10px] font-bold uppercase text-slate-500">Appearance</p><div className="mt-2 flex gap-2">{(["light", "dark"] as const).map((theme) => <button key={theme} type="button" onClick={() => updateSettings("appearance", { theme })} aria-pressed={settings.appearance.theme === theme} className={`rounded-lg border px-3 py-2 text-xs font-bold capitalize ${settings.appearance.theme === theme ? "border-pink-600 bg-pink-600 text-white" : "border-pink-100 bg-white text-slate-600"}`}>{theme}</button>)}</div></div></article>
                <article className="ftm-soft-panel rounded-2xl p-4 xl:col-span-2"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-pink-600" /><h2 className="text-sm font-black">Login & account activity</h2></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-white p-3"><p className="text-[10px] text-slate-500">Last sign-in</p><p className="mt-1 text-xs font-bold">{displayDate(lastSignIn)}</p></div><div className="rounded-lg bg-white p-3"><p className="text-[10px] text-slate-500">Registration date</p><p className="mt-1 text-xs font-bold">{displayDate(profile.created_at)}</p></div></div><button type="button" onClick={() => setActivityExpanded((value) => !value)} className="mt-3 text-[10px] font-bold text-pink-700">{activityExpanded ? "Hide activity details" : "View activity details"}</button>{activityExpanded && <p className="mt-2 text-xs text-slate-500">The current profile API provides last sign-in and registration dates only; detailed device/session history is not exposed.</p>}</article>
                <article className="ftm-soft-panel rounded-2xl p-4 xl:col-span-2"><h2 className="text-sm font-black">Role permissions</h2><p className="mt-1 text-[10px] text-slate-500">Access shown from the current FTM permission matrix.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{permissions.map((permission) => <div key={permission.module} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-xs"><span className="font-semibold">{permission.module}</span><span className="text-right text-[10px] capitalize text-slate-500">{permission.actions.join(" · ")}</span></div>)}</div></article></div>}
            </>}
          </section>
        </section>
      </main>
      <GlobalFooter />

      {modal === "avatar" && <ProfileModal title="Profile picture" onClose={() => { clearPreview(); setModal(null); }}><div className="flex items-center gap-3"><div className="h-16 w-16 overflow-hidden rounded-xl bg-pink-600" style={{ backgroundColor: previewUrl || avatarUrl ? undefined : newAvatarColor }}><FtmProfileAvatar name={fullName} src={previewUrl || avatarUrl} className="h-full w-full object-cover" /></div><label className="cursor-pointer rounded-lg border border-pink-200 bg-white px-3 py-2 text-xs font-bold text-pink-700">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0] || null)} /></label>{avatarUrl && <button type="button" disabled={avatarBusy} onClick={() => void removeAvatar().then(() => { setModal(null); flash("Profile picture removed."); }).catch((error) => setPageError(error instanceof Error ? error.message : "Unable to remove profile picture."))} className="text-xs font-bold text-rose-600">Remove</button>}</div>{avatarError && <p role="alert" className="mt-3 text-xs text-rose-700">{avatarError}</p>}{avatarBusy && <p className="mt-3 text-xs text-pink-700">Uploading · {avatarProgress}%</p>}<div className="mt-4 flex gap-2">{["#db2777", "#0891b2", "#16a34a", "#ea580c", "#334155"].map((color) => <button key={color} type="button" aria-label={`Avatar color ${color}`} onClick={() => { setNewAvatarColor(color); window.localStorage.setItem("avatarColor", color); }} className="h-7 w-7 rounded-full ring-offset-2" style={{ backgroundColor: color, boxShadow: newAvatarColor === color ? "0 0 0 2px #db2777" : undefined }} />)}</div><button type="button" onClick={() => void saveAvatarImage()} disabled={avatarBusy || !pendingImage} className="mt-5 w-full rounded-lg bg-pink-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Save picture</button><button type="button" onClick={() => { window.localStorage.setItem("avatarColor", newAvatarColor); setModal(null); flash("Profile color saved."); }} className="mt-2 w-full rounded-lg border border-pink-200 bg-white px-4 py-2.5 text-xs font-bold text-pink-700">Use selected color</button></ProfileModal>}
      {modal === "password" && <ProfileModal title="Change password" onClose={() => { setModal(null); setPassword(""); setConfirmPassword(""); }}><div className="space-y-3"><label className="block text-xs font-bold">New password<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label><label className="block text-xs font-bold">Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} /></label><button type="button" onClick={() => void updatePassword()} disabled={passwordBusy} className="w-full rounded-lg bg-pink-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{passwordBusy ? "Updating..." : "Update password"}</button></div></ProfileModal>}
      {modal === "sessions" && <ProfileModal title="Other sessions" onClose={() => setModal(null)}><p className="text-xs leading-5 text-slate-600">This signs out other devices and keeps this device signed in.</p><button type="button" onClick={() => void signOutOtherSessions()} className="mt-4 w-full rounded-lg bg-pink-600 px-4 py-2.5 text-xs font-bold text-white">Sign out other sessions</button></ProfileModal>}
    </div>
  );
}