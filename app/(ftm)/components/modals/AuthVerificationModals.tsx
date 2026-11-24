"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Fingerprint, MailCheck, Timer, X } from "lucide-react";

type ModalShellProps = { children: React.ReactNode; labelledBy: string; onCancel: () => void };

function ModalShell({ children, labelledBy, onCancel }: ModalShellProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md sm:p-5"
      role="presentation"
    >
      <button type="button" aria-label="Cancel sign in" onClick={onCancel} className="absolute inset-0 cursor-default" />
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative my-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/80 bg-[#EEF2F6] text-slate-900 shadow-[12px_12px_32px_rgba(15,23,42,0.22),-8px_-8px_24px_rgba(255,255,255,0.9)] dark:border-white/[0.08] dark:bg-[#161A23] dark:text-white dark:shadow-[14px_14px_36px_rgba(0,0,0,0.7)]"
      >
        {children}
      </motion.section>
    </motion.div>
  );
}

type OtpModalProps = {
  open: boolean; email: string; code: string; busy: boolean; deliveryState: "sending" | "sent" | "failed"; error: string; attemptsRemaining: number | null;
  secondsRemaining: number; resendSeconds: number; onCodeChange: (code: string) => void;
  onVerify: () => void; onResend: () => void; onCancel: () => void;
};

export function OtpVerificationModal({ open, email, code, busy, deliveryState, error, attemptsRemaining, secondsRemaining, resendSeconds, onCodeChange, onVerify, onResend, onCancel }: OtpModalProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => { if (open) window.setTimeout(() => inputs.current[0]?.focus(), 100); }, [open]);
  const expired = deliveryState === "sent" && secondsRemaining <= 0;
  const codeUnavailable = deliveryState !== "sent" || expired;
  const updateDigit = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "").slice(-1);
    const next = code.padEnd(6, " ").split("");
    next[index] = digits;
    onCodeChange(next.join("").replace(/\s/g, ""));
    if (digits && index < 5) inputs.current[index + 1]?.focus();
  };
  const paste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onCodeChange(pasted);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };
  const clock = `${Math.floor(Math.max(0, secondsRemaining) / 60)}:${String(Math.max(0, secondsRemaining) % 60).padStart(2, "0")}`;

  return <AnimatePresence>{open && <ModalShell labelledBy="otp-modal-title" onCancel={onCancel}>
    <div className="p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-pink-500/20 bg-[#EEF2F6] text-pink-600 shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:bg-[#1A1F2B] dark:text-pink-300 dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)]">
            <MailCheck size={23} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pink-600 dark:text-pink-300">Step 2 of 3</p>
            <h2 id="otp-modal-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Verify your email</h2>
          </div>
        </div>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Cancel sign in">
          <X size={18} />
        </button>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">Enter the 6-digit code sent to <strong className="break-all text-slate-900 dark:text-white">{email}</strong>.</p>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">The code is sent from the Airship Express security mailbox. If it is not in your inbox, check Spam, Junk, Promotions, and your Gmail filters before requesting another code.</p>
      <div className={`mt-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${deliveryState === "failed" || expired ? "border-rose-300/50 bg-rose-500/10 text-rose-700 dark:text-rose-200" : "border-amber-400/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"}`} aria-live="polite">
        <Timer size={18} className="shrink-0" aria-hidden="true" />
        <span>{deliveryState === "sending" ? "Sending your verification code…" : deliveryState === "failed" ? "We couldn’t send a code. Retry to continue." : expired ? "This code has expired. Request a new code to continue." : <>Code expires in <strong className="ml-1 text-slate-900 dark:text-white">{clock}</strong></>}</span>
      </div>
      <div className="mt-6 grid grid-cols-6 gap-2 sm:gap-3" role="group" aria-label="Six-digit email verification code">
        {Array.from({ length: 6 }, (_, index) => <input key={index} ref={(element) => { inputs.current[index] = element; }} value={code[index] || ""} onChange={(event) => updateDigit(index, event.target.value)} onPaste={paste} onKeyDown={(event) => { if (event.key === "Backspace" && !code[index] && index > 0) inputs.current[index - 1]?.focus(); }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} aria-label={`Verification digit ${index + 1}`} disabled={busy || codeUnavailable} maxLength={1} className="h-12 min-w-0 rounded-xl border border-transparent bg-[#EAF0F6] text-center font-mono text-xl font-bold text-slate-900 shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] outline-none transition focus:border-pink-500/40 focus:ring-2 focus:ring-pink-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#13161F] dark:text-white dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] sm:h-14" />)}
      </div>
      {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300/50 bg-rose-500/10 px-3.5 py-3 text-sm font-semibold leading-5 text-rose-700 dark:text-rose-200"><AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{error}</span></p>}
      {attemptsRemaining !== null && !error.includes("Too many") && <p className="mt-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400">{attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining</p>}
      <button type="button" onClick={onVerify} disabled={busy || codeUnavailable || code.length !== 6} className="mt-6 w-full rounded-xl bg-[#e60067] px-5 py-3.5 text-sm font-bold text-white shadow-[5px_5px_12px_rgba(230,0,103,0.22)] transition hover:bg-[#c90059] focus:outline-none focus:ring-4 focus:ring-pink-400/30 disabled:cursor-not-allowed disabled:opacity-50" aria-busy={busy}>{busy ? deliveryState === "sending" ? "Sending verification code..." : "Verifying secure code..." : "Verify code"}</button>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-300/70 pt-4 text-sm dark:border-white/10">
        <button type="button" onClick={onCancel} disabled={busy} className="font-semibold text-slate-600 underline decoration-slate-400/50 underline-offset-4 transition hover:text-slate-900 disabled:opacity-40 dark:text-slate-300 dark:decoration-white/25 dark:hover:text-white">Use another account</button>
        <button type="button" onClick={onResend} disabled={busy || resendSeconds > 0} className="font-bold text-pink-700 underline decoration-pink-500/30 underline-offset-4 transition hover:text-pink-900 disabled:text-slate-400 dark:text-pink-300 dark:hover:text-pink-100 dark:disabled:text-slate-500">{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}</button>
      </div>
    </div>
  </ModalShell>}</AnimatePresence>;
}

type PasskeyModalProps = { open: boolean; mode: "verify" | "register"; busy: boolean; error: string; onVerify: () => void; onRegister: () => void; onUseNew: () => void; onUseExisting?: () => void; onCancel: () => void };

export function PasskeyVerificationModal({ open, mode, busy, error, onVerify, onRegister, onUseNew, onUseExisting = onVerify, onCancel }: PasskeyModalProps) {
  const registering = mode === "register";
  return <AnimatePresence>{open && <ModalShell labelledBy="passkey-modal-title" onCancel={onCancel}>
    <div className="p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-pink-500/20 bg-[#EEF2F6] text-pink-600 shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:bg-[#1A1F2B] dark:text-pink-300 dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)]">
            <Fingerprint size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pink-600 dark:text-pink-300">Step 3 of 3</p>
            <h2 id="passkey-modal-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{registering ? "Create your passkey" : "Verify your passkey"}</h2>
          </div>
        </div>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Cancel sign in">
          <X size={18} />
        </button>
      </div>
      <div className="mt-6 rounded-xl border border-pink-500/20 bg-[#EAF0F6] p-4 shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:bg-[#13161F] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)]">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Use Windows Hello PIN, fingerprint, face recognition, or another device biometric when your browser opens the secure passkey prompt.</p>
      </div>
      {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300/50 bg-rose-500/10 px-3.5 py-3 text-sm font-semibold leading-5 text-rose-700 dark:text-rose-200"><AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{error}</span></p>}
      <button type="button" onClick={registering ? onRegister : onVerify} disabled={busy} className="mt-6 w-full rounded-xl bg-[#e60067] px-5 py-3.5 text-sm font-bold text-white shadow-[5px_5px_12px_rgba(230,0,103,0.22)] transition hover:bg-[#c90059] focus:outline-none focus:ring-4 focus:ring-pink-400/30 disabled:cursor-not-allowed disabled:opacity-50" aria-busy={busy}>{busy ? "Waiting for your device..." : registering ? "Create device passkey" : "Continue with passkey"}</button>
      {!registering && error && <button type="button" onClick={onUseNew} disabled={busy} className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60 focus:outline-none focus:ring-4 focus:ring-pink-400/20 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">Create a new passkey on this device</button>}
      {registering && error && <>
        <button type="button" onClick={onRegister} disabled={busy} className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60 focus:outline-none focus:ring-4 focus:ring-pink-400/20 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">Try registration again</button>
        <button type="button" onClick={onUseExisting} disabled={busy} className="mt-3 w-full rounded-xl border border-pink-500/30 px-4 py-3 text-sm font-bold text-pink-700 transition hover:bg-pink-500/10 focus:outline-none focus:ring-4 focus:ring-pink-400/20 dark:text-pink-200">Use an existing passkey</button>
      </>}
      <div className="mt-5 border-t border-slate-300/70 pt-4 dark:border-white/10">
        <button type="button" onClick={onCancel} disabled={busy} className="w-full py-1 text-sm font-semibold text-slate-600 underline decoration-slate-400/50 underline-offset-4 transition hover:text-slate-900 disabled:opacity-40 dark:text-slate-300 dark:decoration-white/25 dark:hover:text-white">Cancel and sign out</button>
      </div>
    </div>
  </ModalShell>}</AnimatePresence>;
}
