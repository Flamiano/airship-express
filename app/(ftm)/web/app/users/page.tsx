"use client";

import { useEffect, useState } from "react";
import RoleRestricted from "../components/RoleRestricted";
import GlobalNavbar from "../components/GlobalNavbar";
import { getAdminUsers, lockAdminUser, unlockAdminUser, updateAdminUserRole } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

type FtmUser = { id: string; email?: string; full_name?: string; role?: string | null; last_sign_in_at?: string | null; locked?: boolean; banned_until?: string | null };
const ROLES = ["admin", "fleet_manager", "dispatcher", "driver", "customer"];

export default function ManageUsersPage() {
  const [users, setUsers] = useState<FtmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [roleChange, setRoleChange] = useState<{ user: FtmUser; role: string } | null>(null);
  const [verificationPassword, setVerificationPassword] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [selectedUser, setSelectedUser] = useState<FtmUser | null>(null);
  const [lockChange, setLockChange] = useState<{ user: FtmUser; locked: boolean } | null>(null);

  useEffect(() => {
    void getAdminUsers()
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load users"))
      .finally(() => setLoading(false));
  }, []);

  const requestRoleChange = (user: FtmUser, role: string) => {
    if (role === user.role) return;
    setVerificationError("");
    setVerificationPassword("");
    setRoleChange({ user, role });
  };

  const cancelRoleChange = () => {
    setRoleChange(null);
    setVerificationPassword("");
    setVerificationError("");
  };

  const verifyAndChangeRole = async () => {
    if (!roleChange || !verificationPassword) return;
    setError("");
    setVerificationError("");
    setVerifying(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) throw new Error("The current admin session has no email address.");
      const { error: passwordError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: verificationPassword });
      if (passwordError) throw new Error("Password verification failed. The role was not changed.");

      const updated = await updateAdminUserRole(roleChange.user.id, roleChange.role);
      setUsers((current) => current.map((item) => item.id === roleChange.user.id ? { ...item, ...updated, role: roleChange.role } : item));
      cancelRoleChange();
    } catch (requestError) {
      setVerificationError(requestError instanceof Error ? requestError.message : "Unable to verify password");
    } finally {
      setVerifying(false);
    }
  };

  const requestLockChange = (user: FtmUser) => {
    setVerificationError("");
    setVerificationPassword("");
    setLockChange({ user, locked: !user.locked });
  };

  const verifyAndChangeLockState = async () => {
    if (!lockChange || !verificationPassword) return;
    setError("");
    setVerificationError("");
    setVerifying(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) throw new Error("The current admin session has no email address.");
      const { error: passwordError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: verificationPassword });
      if (passwordError) throw new Error("Password verification failed. The account lock state was not changed.");

      const result = lockChange.locked
        ? await lockAdminUser(lockChange.user.id)
        : await unlockAdminUser(lockChange.user.id);
      setUsers((current) => current.map((item) => item.id === lockChange.user.id ? { ...item, locked: result.locked, banned_until: result.locked_until } : item));
      setLockChange(null);
      setVerificationPassword("");
    } catch (requestError) {
      setVerificationError(requestError instanceof Error ? requestError.message : "Unable to verify password");
    } finally {
      setVerifying(false);
    }
  };

  const cancelSecurityVerification = () => {
    if (verifying) return;
    setRoleChange(null);
    setLockChange(null);
    setVerificationPassword("");
    setVerificationError("");
  };

  const adminCount = users.filter((user) => user.role === "admin").length;
  const dispatcherCount = users.filter((user) => user.role === "dispatcher").length;
  const activeCount = users.filter((user) => user.last_sign_in_at).length;
  const filteredUsers = users.filter((user) => {
    const query = searchText.trim().toLowerCase();
    if (!query) return true;
    return [user.full_name, user.email, user.role, user.id]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const formatRole = (role?: string | null) => (role || "Unassigned").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  const roleBadge = (role?: string | null) => {
    if (role === "admin") return "border-rose-200 bg-rose-50 text-rose-700";
    if (role === "dispatcher") return "border-pink-200 bg-pink-50 text-pink-700";
    if (role === "fleet_manager") return "border-violet-200 bg-violet-50 text-violet-700";
    if (role === "driver") return "border-sky-200 bg-sky-50 text-sky-700";
    return "border-slate-200 bg-slate-50 text-slate-600";
  };

  return (
    <RoleRestricted allowedRoles={["admin"]}>
      <GlobalNavbar />
      <main className="min-h-screen bg-transparent px-4 py-8 text-slate-800 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-[1920px]">
          <section className="relative mb-8 overflow-hidden rounded-3xl border border-pink-200/80 bg-gradient-to-br from-white via-pink-50/40 to-pink-100/30 p-6 shadow-sm backdrop-blur-md md:p-8">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pink-300/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-pink-400/10 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-100 px-3.5 py-1.5 text-xs font-semibold text-pink-700">
                  <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                  FTM Administration Hub
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">Manage Users & Access</h1>
                <p className="mt-3 text-base leading-relaxed text-slate-600">Manage FTM account roles and keep access aligned with each team member&apos;s operational responsibility.</p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Role protection active</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700"><span className="material-symbols-outlined text-[15px]">shield</span>Admin controls</span>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-3 lg:max-w-xl xl:grid-cols-4">
                {[
                  { label: "Total users", value: users.length, icon: "group" },
                  { label: "Active users", value: activeCount, icon: "verified_user" },
                  { label: "Admins", value: adminCount, icon: "shield_person" },
                  { label: "Dispatchers", value: dispatcherCount, icon: "local_shipping" },
                ].map((stat) => <div key={stat.label} className="rounded-2xl border border-pink-100 bg-white/85 p-4 shadow-sm backdrop-blur-sm"><span className="material-symbols-outlined text-pink-600">{stat.icon}</span><div className="mt-2 text-2xl font-black text-slate-900">{stat.value}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</div></div>)}
              </div>
            </div>
          </section>

          {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          <section className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-lg font-black text-slate-900">User Directory</h2><p className="text-sm text-slate-500">Role changes take effect on the user&apos;s next authenticated request.</p></div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700"><span className="material-symbols-outlined text-[15px]">group</span>{users.length} accounts</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-pink-100 bg-pink-50/30 p-1.5 text-xs font-semibold text-slate-600">
              <span className="rounded-lg bg-pink-600 px-3 py-2 text-white shadow-sm">All accounts</span>
            </div>
            <div className="relative mt-4 max-w-xl">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-400">search</span>
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by name, email, role, or user ID"
                aria-label="Search users"
                className="w-full rounded-xl border border-pink-200 bg-pink-50/20 py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-pink-500 focus:bg-white focus:ring-2 focus:ring-pink-100"
              />
              {searchText && <button type="button" onClick={() => setSearchText("")} aria-label="Clear user search" className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 hover:text-pink-600">close</button>}
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-3xl border border-pink-200/80 bg-white shadow-sm">
            {loading ? <div className="space-y-3 p-6">{[1, 2, 3].map((row) => <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div> : filteredUsers.length === 0 ? <div className="p-12 text-center"><span className="material-symbols-outlined text-4xl text-pink-300">person_search</span><p className="mt-3 font-bold text-slate-700">No matching users</p><p className="mt-1 text-sm text-slate-500">Try a different name, email, role, or user ID.</p><button type="button" onClick={() => setSearchText("")} className="mt-4 rounded-xl border border-pink-300 bg-pink-50 px-4 py-2 text-xs font-semibold text-pink-700 hover:bg-pink-100">Clear search</button></div> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-pink-100 bg-[#fff7fc] text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    <tr><th className="px-5 py-4">User</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Last sign-in</th><th className="px-5 py-4">Access</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => <tr key={user.id} onClick={() => setSelectedUser(user)} className="cursor-pointer transition-colors hover:bg-pink-50/50">
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b80049] text-xs font-black text-white">{(user.full_name || user.email || "U").split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span><div><div className="font-bold text-slate-900">{user.full_name || "Unnamed user"}</div><div className="text-xs text-slate-500">{user.email || "No email"}</div></div></div></td>
                      <td className="px-5 py-4"><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${roleBadge(user.role)}`}>{formatRole(user.role)}</span><select value={user.role || ""} onClick={(event) => event.stopPropagation()} onChange={(event) => requestRoleChange(user, event.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600" aria-label={`Change role for ${user.email || user.id}`}>{ROLES.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select></div></td>
                      <td className="px-5 py-4 text-xs text-slate-500">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never signed in"}</td>
                      <td className="px-5 py-4"><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${user.locked ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${user.locked ? "bg-rose-500" : "bg-emerald-500"}`} />{user.locked ? "Locked" : "Active"}</span><button type="button" onClick={(event) => { event.stopPropagation(); requestLockChange(user); }} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${user.locked ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-rose-200 text-rose-700 hover:bg-rose-50"}`}>{user.locked ? "Unlock" : "Lock"}</button></div></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
      {(roleChange || lockChange) && (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/40 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="role-verification-title">
          <div className="w-full max-w-md rounded-3xl border border-pink-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-xl bg-pink-100 text-pink-700">password</span>
              <div><h2 id="role-verification-title" className="text-lg font-black text-slate-900">Verify security action</h2><p className="mt-1 text-sm text-slate-500">Enter your admin password to {roleChange ? <>change {roleChange.user.email || "this user"} to <strong>{formatRole(roleChange.role)}</strong></> : <>{lockChange?.locked ? "lock" : "unlock"} {lockChange?.user.email || "this account"}</>}.</p></div>
            </div>
            <label htmlFor="role-verification-password" className="mt-5 block text-xs font-bold uppercase tracking-wider text-slate-600">Admin password</label>
            <input id="role-verification-password" type="password" autoFocus value={verificationPassword} onChange={(event) => setVerificationPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void verifyAndChangeRole(); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-100" placeholder="Enter your password" />
            {verificationError && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{verificationError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={cancelSecurityVerification} disabled={verifying} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void (roleChange ? verifyAndChangeRole() : verifyAndChangeLockState())} disabled={verifying || !verificationPassword} className="rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50">{verifying ? "Verifying..." : roleChange ? "Verify & change role" : "Verify & update account"}</button>
            </div>
          </div>
        </div>
      )}
      {selectedUser && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/40 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="user-details-title" onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-pink-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-pink-100 bg-gradient-to-r from-pink-50 to-white px-6 py-5">
              <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b80049] text-sm font-black text-white">{(selectedUser.full_name || selectedUser.email || "U").split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-700">User details</p><h2 id="user-details-title" className="mt-1 text-xl font-black text-slate-900">{selectedUser.full_name || "Unnamed user"}</h2></div></div>
              <button type="button" onClick={() => setSelectedUser(null)} aria-label="Close user details" className="material-symbols-outlined rounded-full p-1.5 text-slate-400 hover:bg-pink-100 hover:text-pink-700">close</button>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              {[
                ["Email", selectedUser.email || "Not provided"],
                ["User ID", selectedUser.id],
                ["Role", formatRole(selectedUser.role)],
                ["Account status", selectedUser.locked ? "Locked" : "Active"],
                ["Last sign-in", selectedUser.last_sign_in_at ? new Date(selectedUser.last_sign_in_at).toLocaleString() : "Never signed in"],
                ["Banned until", selectedUser.banned_until ? new Date(selectedUser.banned_until).toLocaleString() : "Not banned"],
              ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mt-2 break-words text-sm font-bold text-slate-900">{value}</div></div>)}
            </div>
            <div className="flex justify-end border-t border-slate-100 px-6 py-4"><button type="button" onClick={() => setSelectedUser(null)} className="rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-700">Close</button></div>
          </div>
        </div>
      )}
    </RoleRestricted>
  );
}