"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GlobalFooter from "../../components/GlobalFooter";
import GlobalNavbar from "../../components/GlobalNavbar";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentRole, getDashboardRouteForRole, getRoleForAuthUser } from "../../lib/roleAccess";

export default function ProfilePage() {
  const router = useRouter();
  const [role, setRole] = useState("User");
  const [displayName, setDisplayName] = useState("Account");
  const [email, setEmail] = useState("account@airship.com");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("Account");
  const [draftEmail, setDraftEmail] = useState("account@airship.com");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const savedName = window.localStorage.getItem("displayName") || "Account";
      const savedEmail = window.localStorage.getItem("email") || "account@airship.com";
      const name = user?.user_metadata?.full_name || user?.email || savedName;
      const userEmail = user?.email || savedEmail;
      setRole(getRoleForAuthUser(user) ?? getCurrentRole() ?? "User");
      setDisplayName(name);
      setEmail(userEmail);
      setDraftName(name);
      setDraftEmail(userEmail);
    };
    void loadUser();
  }, []);

  const initials = displayName
    .split(/[\s@.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "A";

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    const save = async () => {
      const { error } = await supabase.auth.updateUser({
        email: draftEmail,
        data: { full_name: draftName },
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      window.localStorage.setItem("displayName", draftName);
      window.localStorage.setItem("email", draftEmail);
      setDisplayName(draftName);
      setEmail(draftEmail);
      setEditing(false);
      setMessage("Profile updated successfully.");
      window.setTimeout(() => setMessage(null), 3500);
    };
    void save();
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 font-sans selection:bg-pink-500 selection:text-white">
      <GlobalNavbar />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-10 py-8">
        <div className="mx-auto w-full max-w-[1440px]">
          <section className="relative overflow-hidden rounded-3xl border border-pink-200/80 bg-gradient-to-br from-white via-pink-50/40 to-pink-100/30 p-6 md:p-8 shadow-sm">
            <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex rounded-full border border-pink-200 bg-pink-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-pink-700">Account Center</span>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">My Profile</h1>
                <p className="mt-2 text-sm text-slate-600">Manage your identity and account information.</p>
              </div>
              <div className="flex gap-2">
                <a href="/account/settings" className="rounded-xl border border-pink-200 bg-white px-4 py-2.5 text-xs font-bold text-pink-700 hover:bg-pink-50">Settings</a>
                <a href={getDashboardRouteForRole(role)} className="rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-pink-700">Dashboard</a>
              </div>
            </div>
          </section>

          {message && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}

          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-pink-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Personal information</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">Profile details</h2>
                </div>
                <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-xl border border-pink-200 px-3 py-2 text-xs font-bold text-pink-700 hover:bg-pink-50">{editing ? "Cancel" : "Edit Profile"}</button>
              </div>

              {!editing ? (
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-600 text-xl font-black text-white shadow-lg shadow-pink-500/20">{initials}</div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black text-slate-900">{displayName}</p>
                    <p className="truncate text-sm text-slate-500">{email}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={saveProfile} className="mt-6 space-y-4">
                  <label className="block text-xs font-bold text-slate-700">Display name<input value={draftName} onChange={(event) => setDraftName(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2.5 text-sm text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none" /></label>
                  <label className="block text-xs font-bold text-slate-700">Email address<input type="email" value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2.5 text-sm text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none" /></label>
                  <button type="submit" className="rounded-xl bg-pink-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-pink-700">Save Profile</button>
                </form>
              )}
            </div>

            <aside className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Access level</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{String(role).replace(/_/g, " ")}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">Your role controls the workspace tools and modules available in Airship Express.</p>
              <div className="mt-5 rounded-xl border border-pink-100 bg-pink-50/50 p-3 text-xs font-semibold text-pink-700">Account status: Active</div>
            </aside>
          </section>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
