"use client";

import { useState } from "react";
import { requestSensitiveOtp, verifySensitiveOtp } from "../lib/auth";

export default function SensitiveActionOtp({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestSensitiveOtp();
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError("");
    try {
      await verifySensitiveOtp(code);
      onVerified();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">Sensitive action verification</p>
      <p className="mt-2 text-sm text-amber-900">Request a one-time code before changing protected account settings. The code expires in 60 seconds.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => void requestCode()} disabled={loading} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Request OTP</button>
        <input aria-label="One-time password" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="w-36 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" placeholder="6-digit code" />
        <button type="button" onClick={() => void verifyCode()} disabled={loading || code.length !== 6} className="rounded-lg border border-amber-700 px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-50">Verify</button>
      </div>
      {message && <p className="mt-3 text-xs text-amber-800">{message}</p>}
      {error && <p className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}
    </div>
  );
}