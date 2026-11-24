"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import airshipLogo from "../../../public/airship-logo.png";

function EyeIcon({ size = 20, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size = 20, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.88 9.88A3 3 0 0 0 14.12 14.12" />
      <path d="M10.73 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.9 17.9 0 0 1-4.29 5.38" />
      <path d="M6.61 6.61A17.8 17.8 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 5.39-1.61" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

function LoaderSpinnerIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3.5-7.1" />
    </svg>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}
import { OtpVerificationModal, PasskeyVerificationModal } from "../../(ftm)/components/modals/AuthVerificationModals";
import {
  canRegisterPasskeyForDevice,
  getPasskeyDeviceLimitMessage,
  getUserFriendlyAuthError,
  markPasskeyVerified,
  recordPasskeyUserOnDevice,
  requestEmailMfaCode,
  signInWithPassword,
  signOut,
  verifyEmailMfaCode,
} from "../../(ftm)/lib/auth";
import { getPostLoginRoute, normalizeRole } from "../../(ftm)/lib/roleAccess";
import type { AppRole } from "../../(ftm)/lib/roleAccess";
import { supabase } from "../../(ftm)/lib/supabase/supabaseClient";

type SecurityStep = "otp" | "passkey" | null;
type OtpDeliveryState = "sending" | "sent" | "failed";

function getFtmPostLoginRoute(role: AppRole): string | null {
  if (typeof window === "undefined") return null;

  const requestedPath = new URL(window.location.href).searchParams.get("next");
  if (requestedPath) {
    try {
      const destination = new URL(requestedPath, window.location.origin);
      if (destination.origin === window.location.origin) {
        const route = `${destination.pathname}${destination.search}${destination.hash}`;
        const allowedRoute = getPostLoginRoute(role, route);
        if (allowedRoute) return allowedRoute;
      }
    } catch {
      // Ignore malformed next values and use the role's default route.
    }
  }

  return getPostLoginRoute(role);
}

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<SecurityStep>(null);
  const [otpDeliveryState, setOtpDeliveryState] = useState<OtpDeliveryState>("sending");
  const [pendingRole, setPendingRole] = useState<AppRole | null>(null);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [passkeyMode, setPasskeyMode] = useState<"verify" | "register">("verify");
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const passkeyInFlight = useRef(false);

  useEffect(() => {
    if (step !== "otp") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const finishLogin = () => {
    setPasskeyBusy(false);
    setStep(null);
    if (!pendingDestination) {
      setError("This account does not have an accessible FTM page. Contact an FTM administrator.");
      void signOut();
      return;
    }
    window.dispatchEvent(
      new CustomEvent("ftm:loading", { detail: { destination: pendingDestination } })
    );
  };

  const cancelSecurityStep = async () => {
    setStep(null);
    setOtpCode("");
    setError("");
    setPendingRole(null);
    setPendingDestination(null);
    await signOut();
  };

  const sendOtp = async () => {
    setOtpBusy(true);
    setError("");
    setStep("otp");
    setOtpDeliveryState("sending");
    try {
      const result = await requestEmailMfaCode(email.trim());
      setOtpCode("");
      setAttemptsRemaining(5);
      setOtpExpiresAt(result.expiresAt);
      setResendAvailableAt(result.resendAvailableAt);
      setNow(Date.now());
      setOtpDeliveryState("sent");
    } catch (err) {
      setOtpDeliveryState("failed");
      setError(getUserFriendlyAuthError(err, "otp"));
    } finally {
      setOtpBusy(false);
    }
  };

  const openPasskey = async () => {
    if (typeof window === "undefined" || !window.isSecureContext || !("PublicKeyCredential" in window) || !navigator.credentials) {
      setError("Passkeys require HTTPS or localhost and a browser with WebAuthn support.");
      return;
    }

    const { data: passkeys, error: passkeyListError } = await supabase.auth.passkey.list();
    if (passkeyListError) {
      await cancelSecurityStep();
      setError("We couldn’t load this account’s passkeys. Please sign in again.");
      return;
    }

    setPasskeyMode(Array.isArray(passkeys) && passkeys.length > 0 ? "verify" : "register");
    setStep("passkey");
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6 || !pendingRole || Date.now() >= otpExpiresAt) return;
    setOtpBusy(true);
    setError("");
    try {
      const { verified } = await verifyEmailMfaCode(email.trim(), otpCode);
      if (!verified) throw new Error("The verification code is invalid or expired.");
      await openPasskey();
    } catch (err: unknown) {
      const attemptsRemaining = typeof err === "object" && err !== null && "attemptsRemaining" in err
        ? err.attemptsRemaining
        : null;
      const remaining = Number(attemptsRemaining);
      if (Number.isFinite(remaining)) setAttemptsRemaining(remaining);
      setError(getUserFriendlyAuthError(err, "otp"));
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyPasskey = async () => {
    if (passkeyInFlight.current || !pendingUserId || !pendingRole) return;
    passkeyInFlight.current = true;
    setPasskeyBusy(true);
    setError("");
    try {
      const { error: passkeyError } = await supabase.auth.signInWithPasskey();
      if (passkeyError) {
        setError(getUserFriendlyAuthError(passkeyError, "passkey"));
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user || data.user.id !== pendingUserId) {
        setError("The passkey authenticated a different account. Cancel and sign in with the intended account.");
        return;
      }

      markPasskeyVerified(data.user.id);
      finishLogin();
    } finally {
      passkeyInFlight.current = false;
      setPasskeyBusy(false);
    }
  };

  const registerPasskey = async () => {
    if (passkeyInFlight.current || !pendingUserId || !pendingRole) return;
    if (!canRegisterPasskeyForDevice(pendingUserId)) {
      setError(getPasskeyDeviceLimitMessage());
      return;
    }

    passkeyInFlight.current = true;
    setPasskeyBusy(true);
    setError("");
    try {
      const { error: registrationError } = await supabase.auth.registerPasskey();
      if (registrationError) {
        setError(getUserFriendlyAuthError(registrationError, "passkey"));
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user || data.user.id !== pendingUserId) {
        setError("The passkey was registered for a different account. Cancel and sign in with the intended account.");
        return;
      }

      recordPasskeyUserOnDevice(data.user.id);
      markPasskeyVerified(data.user.id);
      finishLogin();
    } finally {
      passkeyInFlight.current = false;
      setPasskeyBusy(false);
    }
  };

  const useExistingPasskey = () => {
    setError("");
    setPasskeyMode("verify");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setPendingDestination(null);

    const { user, error: authError } = await signInWithPassword(email.trim(), password);
    if (authError || !user) {
      setLoading(false);
      setError(getUserFriendlyAuthError(authError || "No user returned", "signin"));
      return;
    }

    setPendingUserId(user.id);
    const role = normalizeRole(user.role);
    if (!role) {
      setLoading(false);
      setError("This account does not have an approved FTM role.");
      await signOut();
      return;
    }

    const destination = getFtmPostLoginRoute(role);
    if (!destination) {
      setLoading(false);
      setError("This account does not have access to an FTM page. Contact an FTM administrator.");
      await signOut();
      return;
    }

    setPendingRole(role);
    setPendingDestination(destination);
    setLoading(false);
    await sendOtp();
  };

  return (
    <>
      <div className="supplychain-container h-dvh w-full bg-paper dark:bg-ink text-ink dark:text-paper font-rethink grid grid-cols-1 lg:grid-cols-[1fr_460px] transition-colors duration-300">
        <div className="relative hidden lg:flex flex-col justify-between border-r border-line dark:border-paper/10 px-16 py-14 overflow-hidden">
          <div className="absolute bottom-14 right-14 rotate-[-6deg] select-none">
            <div className="flex items-center gap-2 rounded-full border border-line dark:border-paper/15 px-4 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent dark:bg-accent" />
              <span className="font-rethink text-[10px] font-medium uppercase tracking-[0.16em] text-muted dark:text-paper/70">
                Fleet & Transport
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Image
              src={airshipLogo}
              unoptimized
              alt="Airship Express"
              width={168}
              height={48}
              className="h-10 w-auto dark:brightness-0 dark:invert transition-all"
              priority
            />
          </motion.div>

          <motion.div
            className="max-w-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
          >
            <p className="font-rethink text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
              Secure Access
            </p>
            <h1 className="mt-5 font-bricolage text-[44px] font-medium leading-[1.05] tracking-tight text-ink dark:text-paper">
              Fleet & Transport
              <br />
              Management
              <br />
              Portal
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-muted dark:text-paper/70">
              Securely manage dispatch, fleet operations, compliance, and customer movement across the full transport network.
            </p>
          </motion.div>

          <div className="flex items-center gap-2 text-[12px] text-muted dark:text-paper/60">
            <span className="h-1 w-1 rounded-full bg-accent" />
            Internal use only &middot; Airship Express Fleet Operations
          </div>
        </div>

        <div className="h-dvh overflow-y-auto flex items-center justify-center px-5 py-8 sm:px-12 sm:py-16 bg-paper dark:bg-ink">
          <motion.div
            className="w-full max-w-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
          >
            <div className="mb-6 sm:mb-10 lg:hidden">
              <Image
                src={airshipLogo}
                unoptimized
                alt="Airship Express"
                width={144}
                height={40}
                className="h-8 w-auto sm:h-9 dark:brightness-0 dark:invert transition-all"
                priority
              />
            </div>

            <p className="font-rethink text-[12px] sm:text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
              Welcome back
            </p>
            <h2 className="mt-2 sm:mt-3 font-bricolage text-[24px] sm:text-[28px] lg:text-[30px] font-medium tracking-tight text-ink dark:text-paper">
              Sign in to Fleet & Transport
            </h2>
            <p className="mt-2 sm:mt-2.5 text-[13.5px] sm:text-[14.5px] leading-relaxed text-muted dark:text-paper/70">
              Use your company email and password.
            </p>

            <form onSubmit={submit} className="mt-6 sm:mt-9 lg:mt-11 space-y-5 sm:space-y-7 lg:space-y-8" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-[11.5px] sm:text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted dark:text-paper/70"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-2 block w-full border-0 border-b border-line dark:border-paper/20 bg-transparent px-0 py-2 text-[14px] sm:text-[15px] text-ink dark:text-paper placeholder:text-muted/40 dark:placeholder:text-paper/40 outline-none transition focus:border-accent dark:focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="password"
                    className="block text-[11.5px] sm:text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted dark:text-paper/70"
                  >
                    Password
                  </label>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    disabled={loading}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-2 block w-full border-0 border-b border-line dark:border-paper/20 bg-transparent px-0 py-2 pr-12 text-[14px] sm:text-[15px] text-ink dark:text-paper placeholder:text-muted/40 dark:placeholder:text-paper/40 outline-none transition focus:border-accent dark:focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute bottom-2 right-0 p-1.5 text-muted hover:text-ink dark:text-paper/80 dark:hover:text-paper transition-colors cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOffIcon size={20} strokeWidth={2} /> : <EyeIcon size={20} strokeWidth={2} />}
                  </button>
                </div>
              </div>

              {error && !step && (
                <div role="alert" className="border-l-2 border-accent pl-3 text-[13px] text-accent">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3.5 text-[14px] font-medium tracking-wide transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer bg-ink dark:bg-paper text-paper dark:text-ink hover:bg-accent dark:hover:bg-accent dark:hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <LoaderSpinnerIcon className="animate-spin" size={18} />
                    Checking credentials…
                  </>
                ) : (
                  <>
                    <LockIcon size={16} />
                    Sign in
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 p-4 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] border border-white/60 dark:border-white/[0.06] shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-1px_-1px_4px_rgba(255,255,255,0.02)] transition-all">
              <p className="text-center text-xs sm:text-[12.5px] text-slate-600 dark:text-slate-300 font-medium">
                Need help accessing your account? Contact support at{' '}
                <a
                  href="mailto:ftm.airshipexpress@gmail.com"
                  className="font-bold text-accent dark:text-pink-400 hover:text-accent-dark dark:hover:text-pink-300 transition-colors underline decoration-pink-500/30 underline-offset-2"
                >
                  ftm.airshipexpress@gmail.com
                </a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <OtpVerificationModal
        open={step === "otp"}
        email={email}
        code={otpCode}
        busy={otpBusy}
        deliveryState={otpDeliveryState}
        error={error}
        attemptsRemaining={attemptsRemaining}
        secondsRemaining={Math.max(0, Math.ceil((otpExpiresAt - now) / 1000))}
        resendSeconds={Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))}
        onCodeChange={setOtpCode}
        onVerify={() => void verifyOtp()}
        onResend={() => void sendOtp()}
        onCancel={() => void cancelSecurityStep()}
      />

      <PasskeyVerificationModal
        open={step === "passkey"}
        mode={passkeyMode}
        busy={passkeyBusy}
        error={error}
        onVerify={() => void verifyPasskey()}
        onRegister={() => void registerPasskey()}
        onUseNew={() => {
          setError("");
          setPasskeyMode("register");
        }}
        onCancel={() => void cancelSecurityStep()}
      />
    </>
  );
}
