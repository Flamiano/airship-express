"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ModalShellProps = { children: React.ReactNode; labelledBy: string; onCancel: () => void };

function ModalShell({ children, labelledBy, onCancel }: ModalShellProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="presentation">
      <button type="button" aria-label="Cancel sign in" onClick={onCancel} className="absolute inset-0 cursor-default" />
      <motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.18 }} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="relative w-full max-w-lg rounded-[30px] border border-white/15 bg-[#11131d]/95 p-7 text-white shadow-[0_24px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-9">
        {children}
      </motion.section>
    </motion.div>
  );
}

type OtpModalProps = {
  open: boolean; email: string; code: string; busy: boolean; error: string; attemptsRemaining: number | null;
  secondsRemaining: number; resendSeconds: number; onCodeChange: (code: string) => void;
  onVerify: () => void; onResend: () => void; onCancel: () => void;
};

export function OtpVerificationModal({ open, email, code, busy, error, attemptsRemaining, secondsRemaining, resendSeconds, onCodeChange, onVerify, onResend, onCancel }: OtpModalProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => { if (open) window.setTimeout(() => inputs.current[0]?.focus(), 100); }, [open]);
  const expired = secondsRemaining <= 0;
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
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-pink-300">Step 2 of 3</p><h2 id="otp-modal-title" className="mt-2 text-2xl font-black">Verify your email</h2></div><button type="button" onClick={onCancel} disabled={busy} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Cancel sign in"><span className="material-symbols-outlined">close</span></button></div>
    <p className="mt-4 text-sm leading-6 text-slate-300">Enter the 6-digit code sent to <strong className="text-white">{email}</strong>.</p>
    <p className="mt-2 text-xs leading-5 text-slate-400">The code is sent from the Airship Express security mailbox. If it is not in your inbox, check Spam, Junk, Promotions, and your Gmail filters before requesting another code.</p>
    <div className={`mt-6 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold ${expired ? "border-rose-300/40 bg-rose-500/10 text-rose-100" : "border-pink-300/25 bg-pink-500/10 text-pink-100"}`} aria-live="polite"><span className="material-symbols-outlined text-lg" aria-hidden="true">timer</span><span>{expired ? "This code has expired. Request a new code to continue." : <>Code expires in <strong className="ml-1 text-white">{clock}</strong></>}</span></div>
    <div className="mt-7 grid grid-cols-6 gap-2.5 sm:gap-3" role="group" aria-label="Six-digit email verification code">{Array.from({ length: 6 }, (_, index) => <input key={index} ref={(element) => { inputs.current[index] = element; }} value={code[index] || ""} onChange={(event) => updateDigit(index, event.target.value)} onPaste={paste} onKeyDown={(event) => { if (event.key === "Backspace" && !code[index] && index > 0) inputs.current[index - 1]?.focus(); }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} aria-label={`Verification digit ${index + 1}`} disabled={busy || expired} maxLength={1} className="h-14 min-w-0 rounded-2xl border border-white/20 bg-[#090b12] text-center font-mono text-xl font-black text-white outline-none transition placeholder:text-slate-500 hover:border-white/35 focus:border-pink-400 focus:ring-4 focus:ring-pink-500/20 disabled:cursor-not-allowed disabled:opacity-45 sm:h-16" />)}</div>
    {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm font-semibold leading-5 text-rose-100"><span className="material-symbols-outlined text-base" aria-hidden="true">error</span><span>{error}</span></p>}
    {attemptsRemaining !== null && !error.includes("Too many") && <p className="mt-4 text-center text-sm font-medium text-slate-300">{attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining</p>}
    <button type="button" onClick={onVerify} disabled={busy || expired || code.length !== 6} className="mt-7 w-full rounded-2xl bg-[#e60067] px-5 py-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(230,0,103,0.25)] transition hover:bg-[#c90059] focus:outline-none focus:ring-4 focus:ring-pink-400/30 disabled:cursor-not-allowed disabled:opacity-50" aria-busy={busy}>{busy ? "Verifying secure code..." : "Verify code"}</button>
    <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-sm"><button type="button" onClick={onCancel} disabled={busy} className="rounded-lg px-1 font-semibold text-slate-300 underline decoration-white/25 underline-offset-4 transition hover:text-white hover:decoration-white disabled:opacity-40">Use another account</button><button type="button" onClick={onResend} disabled={busy || resendSeconds > 0} className="rounded-lg px-1 font-bold text-pink-300 underline decoration-pink-300/30 underline-offset-4 transition hover:text-pink-100 hover:decoration-pink-100 disabled:text-slate-500">{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}</button></div>
  </ModalShell>}</AnimatePresence>;
}

type PasskeyModalProps = { open: boolean; mode: "verify" | "register"; busy: boolean; error: string; onVerify: () => void; onRegister: () => void; onUseNew: () => void; onUseExisting?: () => void; onCancel: () => void };

export function PasskeyVerificationModal({ open, mode, busy, error, onVerify, onRegister, onUseNew, onUseExisting = onVerify, onCancel }: PasskeyModalProps) {
  const registering = mode === "register";
  return <AnimatePresence>{open && <ModalShell labelledBy="passkey-modal-title" onCancel={onCancel}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-pink-300">Step 3 of 3</p><h2 id="passkey-modal-title" className="mt-2 text-2xl font-black">{registering ? "Create your passkey" : "Verify your passkey"}</h2></div><button type="button" onClick={onCancel} disabled={busy} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Cancel sign in"><span className="material-symbols-outlined">close</span></button></div>
    <div className="mt-6 rounded-2xl border border-pink-300/25 bg-pink-500/10 p-5"><div className="flex gap-3"><span className="material-symbols-outlined text-2xl text-pink-300" aria-hidden="true">fingerprint</span><p className="text-sm leading-6 text-slate-200">Use Windows Hello PIN, fingerprint, face recognition, or another device biometric when your browser opens the secure passkey prompt.</p></div></div>
    {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm font-semibold leading-5 text-rose-100"><span className="material-symbols-outlined text-base" aria-hidden="true">error</span><span>{error}</span></p>}
    <button type="button" onClick={registering ? onRegister : onVerify} disabled={busy} className="mt-7 w-full rounded-2xl bg-[#e60067] px-5 py-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(230,0,103,0.25)] transition hover:bg-[#c90059] focus:outline-none focus:ring-4 focus:ring-pink-400/30 disabled:cursor-not-allowed disabled:opacity-50" aria-busy={busy}>{busy ? "Waiting for your device..." : registering ? "Create device passkey" : "Continue with passkey"}</button>
    {!registering && error && <button type="button" onClick={onUseNew} disabled={busy} className="mt-4 w-full rounded-xl border border-white/20 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-white/40 hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-pink-400/20">Create a new passkey on this device</button>}
    {registering && error && <>
      <button type="button" onClick={onRegister} disabled={busy} className="mt-4 w-full rounded-xl border border-white/20 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-white/40 hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-pink-400/20">Try registration again</button>
      <button type="button" onClick={onUseExisting} disabled={busy} className="mt-3 w-full rounded-xl border border-pink-300/30 px-4 py-3 text-sm font-bold text-pink-200 transition hover:border-pink-300/60 hover:bg-pink-500/10 focus:outline-none focus:ring-4 focus:ring-pink-400/20">Use an existing passkey</button>
    </>}
    <button type="button" onClick={onCancel} disabled={busy} className="mt-5 w-full rounded-lg py-2 text-sm font-semibold text-slate-300 underline decoration-white/25 underline-offset-4 transition hover:text-white hover:decoration-white disabled:opacity-40">Cancel and sign out</button>
  </ModalShell>}</AnimatePresence>;
}
