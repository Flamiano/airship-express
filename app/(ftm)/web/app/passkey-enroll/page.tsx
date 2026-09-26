"use client";

import { useEffect, useState } from "react";
import { canRegisterPasskeyForDevice, getPasskeyDeviceLimitMessage, markPasskeyVerified, recordPasskeyUserOnDevice } from "../lib/auth";
import { getDashboardRouteForRole, getRoleForAuthUser } from "../lib/roleAccess";
import { supabase } from "../lib/supabaseClient";

export default function PasskeyEnrollPage() {
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const establishSession = async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) setError("This email verification link is invalid or has expired. Request a new verification email.");
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.user) {
        setError((current) => current || "Verify your email first, then open the passkey setup link again.");
      } else {
        setEmail(data.session.user.email || "your account");
      }
      setChecking(false);
    };
    void establishSession();
  }, []);

  const registerPasskey = async () => {
    setError("");
    setRegistering(true);
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user?.id || !canRegisterPasskeyForDevice(currentUser.user.id)) {
      setRegistering(false);
      setError(getPasskeyDeviceLimitMessage());
      return;
    }
    const { error: registrationError } = await supabase.auth.registerPasskey();
    if (registrationError) {
      setRegistering(false);
      setError(registrationError.message || "Passkey registration was not completed.");
      return;
    }
    setRegistered(true);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      recordPasskeyUserOnDevice(data.user.id);
      markPasskeyVerified(data.user.id);
    }
    const role = getRoleForAuthUser(data.user);
    window.setTimeout(() => window.location.assign(role ? getDashboardRouteForRole(role) : "/ftmAuth"), 1200);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090b12] px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-[28px] border border-white/15 bg-white/[0.07] p-8 shadow-2xl backdrop-blur-md">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-pink-300">Airship Express</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Verify email, register passkey</h1>
        {checking ? (
          <p className="mt-4 text-sm text-white/65">Checking your email verification...</p>
        ) : registered ? (
          <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">Passkey registered for {email}. Redirecting to your workspace...</p>
        ) : !error ? (
          <>
            <p className="mt-3 text-sm leading-6 text-white/65">Your email is verified. Register a passkey on this device to sign in with Windows Hello or your device PIN.</p>
            <button type="button" onClick={() => void registerPasskey()} disabled={registering} className="mt-6 w-full rounded-2xl bg-[#d41471] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-pink-600/25 disabled:cursor-not-allowed disabled:opacity-60">{registering ? "Waiting for Windows Hello..." : "Register Windows Hello PIN"}</button>
            <p className="mt-3 text-[11px] leading-5 text-white/45">The PIN is handled by Windows. Airship Express never sees or stores it.</p>
          </>
        ) : null}
        {error && <p className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-200">{error}</p>}
      </section>
    </main>
  );
}
