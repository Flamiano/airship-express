"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentRole, getDashboardRouteForRole } from "../../lib/roleAccess";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>("User");
  const [email, setEmail] = useState("account@airship.com");
  const [displayName, setDisplayName] = useState("Account");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRole(getCurrentRole() ?? "User");
      setEmail(window.localStorage.getItem("email") || "account@airship.com");
      setDisplayName(window.localStorage.getItem("displayName") || "Account");
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#fff7fc] px-6 py-10 text-slate-800">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-pink-200 bg-white p-8 shadow-[0_20px_60px_rgba(184,0,73,0.08)]">
        <div className="mb-8 flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-pink-700">Account</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Settings</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push(getDashboardRouteForRole(role))}
            className="rounded-full bg-[#b80049] px-4 py-2 text-sm font-bold text-white hover:bg-[#9a003c]"
          >
            Back to dashboard
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Profile</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#b80049] text-lg font-black text-white">
                {displayName
                  .split(/[\s@.-]+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("") || "A"}
              </div>
              <div>
                <div className="text-xl font-black text-slate-900">{displayName}</div>
                <div className="text-sm text-slate-500">{email}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Access</p>
            <div className="mt-4 text-lg font-black text-slate-900">{String(role).replace(/_/g, " ")}</div>
            <div className="mt-2 text-sm text-slate-500">Role-based workspace permissions are enabled for this account.</div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-pink-200 bg-pink-50/60 p-5 text-sm text-slate-700">
          This is the current account settings placeholder. Connect it to your real auth profile later to manage email, password, and permissions.
        </div>
      </div>
    </main>
  );
}
