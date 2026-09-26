"use client";

import { useEffect, useState } from "react";
import GlobalFooter from "../../components/GlobalFooter";
import GlobalNavbar from "../../components/GlobalNavbar";
import { hasPermission } from "../../lib/permissions";
import { supabase } from "../../lib/supabaseClient";
import { useFtmProfileAvatar } from "../../components/FtmProfileAvatarProvider";
import FtmProfileAvatar from "../../components/FtmProfileAvatar";
import { getCurrentRole, getDashboardRouteForRole, getRoleForAuthUser } from "../../lib/roleAccess";
import { useFtmSettings, type FtmSystemSettings } from "../../components/FtmSettingsProvider";

type NotifPrefs = Pick<FtmSystemSettings["notifications"], "email" | "sms" | "push">;
type ModalKind = "avatar" | "password" | "sessions" | null;

const AVATAR_COLORS = ["#db2777", "#7c3aed", "#0891b2", "#16a34a", "#ea580c", "#334155"];

function Modal({
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
      <div className="ftm-soft-panel relative z-10 w-full max-w-md rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ftm-soft-button rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600"
          >
            Close
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className="flex w-full items-center justify-between gap-3 py-1.5 text-left"
    >
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-pink-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export default function ProfilePage() {
  const { settings, updateSettings } = useFtmSettings();
  const [role, setRole] = useState("User");
  const [displayName, setDisplayName] = useState("Account");
  const [email, setEmail] = useState("account@airship.com");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("Account");
  const [draftEmail, setDraftEmail] = useState("account@airship.com");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"good" | "bad">("good");
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [profileEditedAt, setProfileEditedAt] = useState("Not recorded");

  // New: avatar, theme, notification prefs, modals, activity
  const { avatarUrl, previewUrl, pendingImage, busy: avatarBusy, progress: avatarProgress, error: avatarError, chooseFile, save: saveAvatarImage, remove: removeAvatarImage, clearPreview } = useFtmProfileAvatar();
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const theme = settings.appearance.theme;
  const notifPrefs: NotifPrefs = { email: settings.notifications.email, sms: settings.notifications.sms, push: settings.notifications.push };
  const [activeModal, setActiveModal] = useState<ModalKind>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Password modal state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const flash = (text: string, tone: "good" | "bad" = "good") => {
    setMessage(text);
    setMessageTone(tone);
    window.setTimeout(() => setMessage(null), 3500);
  };

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const savedName = window.localStorage.getItem("displayName") || "Account";
      const savedEmail = window.localStorage.getItem("email") || "account@airship.com";
      const savedAvatarColor = window.localStorage.getItem("avatarColor");
      setProfileEditedAt(window.localStorage.getItem("profileEditedAt") || "Not recorded");

      const name = user?.user_metadata?.full_name || user?.email || savedName;
      const userEmail = user?.email || savedEmail;

      setSignedIn(Boolean(user));
      setLastSignIn(user?.last_sign_in_at || null);
      setCreatedAt(user?.created_at || null);
      setAccountId(user?.id || null);
      setEmailVerified(user?.email_confirmed_at ? true : user ? false : null);
      setRole(getRoleForAuthUser(user) ?? getCurrentRole() ?? "User");
      setDisplayName(name);
      setEmail(userEmail);
      setDraftName(name);
      setDraftEmail(userEmail);
      if (savedAvatarColor) setAvatarColor(savedAvatarColor);
    };
    void loadUser();
  }, []);

  const initials = displayName
    .split(/[\s@.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "A";

  const normalizedRole = String(role).toLowerCase();
  const canEditProfile = signedIn;
  const canViewOperations = hasPermission(normalizedRole, "operations", "view");
  const accessibleModules = [
    ["Operations", canViewOperations],
    ["Alerts", hasPermission(normalizedRole, "alerts", "view")],
    ["Driver performance", hasPermission(normalizedRole, "driverPerformance", "view")],
    ["Fuel management", hasPermission(normalizedRole, "fuelManagement", "view")],
    ["Fleet management", hasPermission(normalizedRole, "fvm", "view")],
    ["Dispatch", hasPermission(normalizedRole, "vrds", "view")],
  ] as const;
  const profileFields = [displayName, email, role !== "User", Boolean(avatarUrl)];
  const completion = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  const roleDescription = normalizedRole.includes("admin")
    ? "Full system administration and security management access."
    : normalizedRole.includes("manager")
      ? "Manages fleet resources, vehicles, maintenance, and fleet operations."
      : normalizedRole.includes("dispatch")
        ? "Manages route planning, bookings, assignments, and active trips."
        : normalizedRole.includes("driver")
          ? "Accesses assigned trips, fuel workflows, alerts, and driver tools."
          : "Access is assigned according to your authenticated account role.";
  const availableModuleCount = accessibleModules.filter(([, allowed]) => allowed).length;

  const activityLog = [
    { label: "Signed in", detail: lastSignIn ? new Date(lastSignIn).toLocaleString() : "Not available" },
    { label: "Account created", detail: createdAt ? new Date(createdAt).toLocaleString() : "Not available" },
    { label: "Profile last edited", detail: profileEditedAt },
  ];

  const saveProfile = (event: React.FormEvent) => {
    if (!canEditProfile) return;
    event.preventDefault();
    const save = async () => {
      const { error } = await supabase.auth.updateUser({
        email: draftEmail,
        data: { full_name: draftName },
      });
      if (error) {
        flash(error.message, "bad");
        return;
      }
      window.localStorage.setItem("displayName", draftName);
      window.localStorage.setItem("email", draftEmail);
      window.localStorage.setItem("profileEditedAt", new Date().toLocaleString());
      setDisplayName(draftName);
      setEmail(draftEmail);
      setEditing(false);
      flash("Profile updated successfully.");
    };
    void save();
  };

  const closeModal = () => {
    setActiveModal(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const onAvatarFile = (file: File | null) => {
    void chooseFile(file);
  };

  const saveAvatar = async () => {
    try {
      if (pendingImage) await saveAvatarImage();
      window.localStorage.setItem("avatarColor", avatarColor);
      flash("Avatar updated.");
      clearPreview();
      closeModal();
    } catch (error) {
      flash(error instanceof Error ? error.message : "The avatar could not be saved. Please try again.", "bad");
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      flash("Password must be at least 8 characters.", "bad");
      return;
    }
    if (newPassword !== confirmPassword) {
      flash("Passwords do not match.", "bad");
      return;
    }
    setPasswordBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    if (error) {
      flash(error.message, "bad");
      return;
    }
    flash("Password changed successfully.");
    closeModal();
  };

  const signOutOtherSessions = async () => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) {
      flash(error.message, "bad");
      return;
    }
    flash("Other sessions have been signed out.");
    closeModal();
  };

  const toggleNotif = (key: keyof NotifPrefs) => {
    const nextNotifications = { ...settings.notifications, [key]: !notifPrefs[key] } as FtmSystemSettings["notifications"];
    updateSettings("notifications", nextNotifications);
  };

  const copyAccountId = async () => {
    if (!accountId) return;
    await navigator.clipboard.writeText(accountId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 font-sans selection:bg-pink-500 selection:text-white">
      <GlobalNavbar />
      <main className="ftm-soft-shell flex-1 w-full px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-[1440px]">
          <section className="ftm-soft-hero relative overflow-hidden rounded-3xl p-6 md:p-8">
            <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="ftm-soft-inset inline-flex rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-pink-700">Account Center</span>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">My Profile</h1>
                <p className="mt-2 text-sm text-slate-600">Manage your identity and account information.</p>
              </div>
            </div>
          </section>

          {message && (
            <div
              className={`mt-6 rounded-xl border p-4 text-sm font-semibold ${
                messageTone === "good"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {message}
            </div>
          )}

          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="ftm-soft-panel rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-pink-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Personal information</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">Profile details</h2>
                </div>
                <button type="button" onClick={() => canEditProfile && setEditing((value) => !value)} disabled={!canEditProfile} className="ftm-soft-button rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-pink-700 disabled:cursor-not-allowed disabled:opacity-50">{editing ? "Cancel" : "Edit Profile"}</button>
              </div>

              {!editing ? (
                <div className="mt-6 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveModal("avatar")}
                    className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xl font-black text-white shadow-lg shadow-pink-500/20"
                    style={{ backgroundColor: previewUrl || avatarUrl ? undefined : avatarColor }}
                    aria-label="Change avatar"
                  >
                    <FtmProfileAvatar name={displayName} src={previewUrl || avatarUrl} className="flex h-full w-full items-center justify-center object-cover" />
                    <span className="absolute inset-0 hidden items-center justify-center bg-slate-900/50 text-[10px] font-bold group-hover:flex">Edit</span>
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black text-slate-900">{displayName}</p>
                    <p className="truncate text-sm text-slate-500">{email}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={saveProfile} className="mt-6 space-y-4">
                  <label className="block text-xs font-bold text-slate-700">Display name<input value={draftName} onChange={(event) => setDraftName(event.target.value)} required className="ftm-soft-control mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm" /></label>
                  <label className="block text-xs font-bold text-slate-700">Email address<input type="email" value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} required className="ftm-soft-control mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm" /></label>
                  <button type="submit" className="ftm-soft-button rounded-xl bg-pink-600 px-5 py-2.5 text-xs font-bold text-white">Save Profile</button>
                </form>
              )}
            </div>

            <aside className="ftm-soft-panel rounded-2xl p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Access level</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{String(role).replace(/_/g, " ")}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">Your role controls the workspace tools and modules available in Airship Express.</p>
              <div className="ftm-soft-inset mt-5 rounded-xl p-3 text-xs font-semibold text-pink-700">Account status: {signedIn ? "Active" : "Signed out"}</div>
            </aside>
          </section>

          <section className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="ftm-soft-panel rounded-2xl p-5">
              <h2 className="text-sm font-black text-slate-900">Profile completion</h2>
              <div className="mt-4 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-pink-500 transition-all" style={{ width: `${completion}%` }} /></div>
              <p className="mt-3 text-xs font-semibold text-slate-500">{completion}% complete. Add a verified identity and avatar to keep access records clear.</p>
            </div>

            <div className="ftm-soft-panel rounded-2xl p-5">
              <h2 className="text-sm font-black text-slate-900">Security status</h2>
              <div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-500">Authentication</span><span className="font-bold text-emerald-600">Passkey protected</span></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setActiveModal("password")} className="ftm-soft-button rounded-lg bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-700">Change password</button>
                <button type="button" onClick={() => setActiveModal("sessions")} className="ftm-soft-button rounded-lg bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-700">Manage sessions</button>
              </div>
            </div>

            <div className="ftm-soft-panel rounded-2xl p-5">
              <h2 className="text-sm font-black text-slate-900">Preferences</h2>
              <div className="mt-3 divide-y divide-slate-100">
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-slate-500">Theme</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => updateSettings("appearance", { theme: "light" })} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${theme === "light" ? "bg-pink-600 text-white" : "ftm-soft-inset text-slate-600"}`}>Light</button>
                    <button type="button" onClick={() => updateSettings("appearance", { theme: "dark" })} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${theme === "dark" ? "bg-pink-600 text-white" : "ftm-soft-inset text-slate-600"}`}>Dark</button>
                  </div>
                </div>
                <Toggle checked={notifPrefs.email} onChange={() => toggleNotif("email")} label="Email notifications" />
                <Toggle checked={notifPrefs.sms} onChange={() => toggleNotif("sms")} label="SMS alerts" />
                <Toggle checked={notifPrefs.push} onChange={() => toggleNotif("push")} label="Push notifications" />
              </div>
            </div>

            <div className="ftm-soft-panel rounded-2xl p-5">
              <h2 className="text-sm font-black text-slate-900">Role & access</h2>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">{roleDescription}</p>
              <div className="ftm-soft-inset mt-4 flex items-center justify-between rounded-xl px-3 py-2.5 text-xs"><span className="text-slate-500">Workspace modules</span><span className="font-black text-emerald-700">{availableModuleCount} of {accessibleModules.length} available</span></div>
            </div>

            <div className="ftm-soft-panel rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900">Account activity</h2>
                <button type="button" onClick={() => setActivityExpanded((value) => !value)} className="text-xs font-bold text-pink-700 hover:underline">{activityExpanded ? "Show less" : "Show all"}</button>
              </div>
              <div className="mt-3 space-y-3">
                {(activityExpanded ? activityLog : activityLog.slice(0, 2)).map((entry) => (
                  <div key={entry.label}>
                    <p className="text-xs text-slate-500">{entry.label}</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-800">{entry.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="ftm-soft-panel rounded-2xl p-5">
              <h2 className="text-sm font-black text-slate-900">Account information</h2>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Account ID</span>
                  <button type="button" onClick={copyAccountId} className="max-w-[65%] truncate font-bold text-slate-800 hover:text-pink-700" title="Copy account ID">
                    {copied ? "Copied!" : accountId || "Unavailable"}
                  </button>
                </div>
                <div className="flex justify-between"><span className="text-slate-500">Email verification</span><span className={`font-bold ${emailVerified === true ? "text-emerald-600" : "text-slate-500"}`}>{emailVerified === null ? "Unavailable" : emailVerified ? "Verified" : "Not verified"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Account type</span><span className="font-bold text-slate-800">FTM user</span></div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="ftm-soft-panel rounded-2xl p-5"><h2 className="text-sm font-black text-slate-900">Workspace shortcuts</h2><div className="mt-4 flex flex-wrap gap-2"><a href={getDashboardRouteForRole(role)} className="ftm-soft-button rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-slate-700">My dashboard</a>{canViewOperations && <a href="/dashboard" className="ftm-soft-button rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-slate-700">Operations center</a>}{hasPermission(normalizedRole, "alerts", "view") && <a href="/alerts" className="ftm-soft-button rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-slate-700">Alerts</a>}</div></div>
            <div className="ftm-soft-panel rounded-2xl p-5"><h2 className="text-sm font-black text-slate-900">Support and account status</h2><p className="mt-3 text-xs leading-relaxed text-slate-500">Need help with access or profile data? Contact the operations administrator.</p><div className="mt-4 flex items-center justify-between"><span className="ftm-soft-inset rounded-full px-3 py-1.5 text-xs font-bold text-emerald-700">{signedIn ? "Account active" : "Authentication required"}</span><a href="mailto:airshipexpress.s@gmail.com" className="text-xs font-bold text-pink-700 hover:underline">Contact support</a></div></div>
          </section>
        </div>
      </main>
      <GlobalFooter />

      {activeModal === "avatar" && (
        <Modal title="Change avatar" subtitle="Upload a photo or pick a color." onClose={closeModal}>
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-lg font-black text-white"
              style={{ backgroundColor: previewUrl || avatarUrl ? undefined : avatarColor }}
            >
              <FtmProfileAvatar name={displayName} src={previewUrl || avatarUrl} className="flex h-full w-full items-center justify-center object-cover" />
            </div>
            <label className="ftm-soft-button cursor-pointer rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-pink-700">
              Upload photo
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onAvatarFile(event.target.files?.[0] ?? null)} />
            </label>
            {(previewUrl || avatarUrl) && (
              <button type="button" onClick={() => previewUrl ? clearPreview() : void removeAvatarImage()} disabled={avatarBusy} className="text-xs font-bold text-slate-500 hover:underline">{previewUrl ? "Discard" : "Remove"}</button>
            )}
          </div>
          {!previewUrl && !avatarUrl && (
            <div className="mt-4 flex gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className="h-7 w-7 rounded-full ring-offset-2"
                  style={{ backgroundColor: color, boxShadow: avatarColor === color ? "0 0 0 2px #db2777" : undefined }}
                  aria-label={`Choose color ${color}`}
                />
              ))}
            </div>
          )}
            {avatarError && <p className="mt-3 text-xs font-semibold text-rose-600">{avatarError}</p>}
            {avatarBusy && <p className="mt-2 text-xs font-semibold text-pink-600">Uploading photo... {avatarProgress}%</p>}
            <button type="button" onClick={() => void saveAvatar()} disabled={avatarBusy || !pendingImage} className="ftm-soft-button mt-5 w-full rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {avatarBusy ? "Saving avatar..." : "Save avatar"}
            </button>
        </Modal>
      )}

      {activeModal === "password" && (
        <Modal title="Change password" subtitle="Use at least 8 characters." onClose={closeModal}>
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="ftm-soft-control mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm" /></label>
            <label className="block text-xs font-bold text-slate-700">Confirm new password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="ftm-soft-control mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm" /></label>
            <button type="button" onClick={changePassword} disabled={passwordBusy} className="ftm-soft-button w-full rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{passwordBusy ? "Updating…" : "Update password"}</button>
          </div>
        </Modal>
      )}

      {activeModal === "sessions" && (
        <Modal title="Manage sessions" subtitle="Sign out of every other device where you're logged in." onClose={closeModal}>
          <div className="space-y-4">
            <div className="ftm-soft-inset rounded-xl p-3 text-xs text-slate-600">
              This device stays signed in. Any other browser or device using your account will be signed out immediately.
            </div>
            <button type="button" onClick={signOutOtherSessions} className="ftm-soft-button w-full rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-bold text-white">Sign out other sessions</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
