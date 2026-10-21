"use client";

// Step 2 of 2 of the SPNC login: "We just sent an email" with one box per digit.
// Used by ./page.tsx. Talks to:
//   POST {BASE}/api/login/otp/verify   body: { code, deviceModel }
//   POST {BASE}/api/login/otp/send     ("Resend")
// Both routes read the "password step passed" cookie, so fetch stays same-origin.

import { useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { getDeviceHint } from "./deviceHint";

// Full URL prefix of the app. Set NEXT_PUBLIC_BASE_PATH in .env.local if it differs.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "/spnc/app";
// Must match Supabase -> Authentication -> Sign In / Providers -> Email -> "Email OTP Length"
// and the value used in api/login/otp/verify/route.ts. Set NEXT_PUBLIC_OTP_LENGTH=8 if you use 8.
const OTP_LENGTH = Number(process.env.NEXT_PUBLIC_OTP_LENGTH ?? 6);
// Matches Supabase's "Minimum interval per user" (60 seconds).
const RESEND_COOLDOWN_SEC = 60;
// Portal pink: digit box borders, pencil icon, "Resend".
const ACCENT = "#F2419B";

const emptyDigits = () => Array<string>(OTP_LENGTH).fill("");

function formatCountdown(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type OtpFormProps = {
  /** Masked address shown under the title, e.g. "ai*********@gmail.com". */
  maskedEmail: string;
  isDark: boolean;
  /** The page's client-side lockout is active: disable everything. */
  isLocked: boolean;
  /** Called after the code is accepted and the session cookie is set. Reset counters and redirect here. */
  onSuccess: () => void;
  /** Back to Employee ID + password. Pass a message to show there. */
  onBack: (message?: string | null) => void;
  /** Lets the page show its full-screen "Signing in…" overlay while a request is running. */
  onBusyChange?: (busy: boolean) => void;
};

export default function OtpForm({
  maskedEmail,
  isDark,
  isLocked,
  onSuccess,
  onBack,
  onBusyChange,
}: OtpFormProps) {
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendLeft, setResendLeft] = useState(RESEND_COOLDOWN_SEC); // a code was just sent
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");
  const muted = isDark ? "text-[#8FA0AF]" : "text-[#6B6B6B]";
  const strong = isDark ? "text-[#F2F1EC]" : "text-[#0B0B0B]";

  // Tell the page when a request is running (for its overlay), and clear it if we unmount.
  useEffect(() => {
    onBusyChange?.(loading || resending);
  }, [loading, resending, onBusyChange]);
  useEffect(() => {
    return () => onBusyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = setTimeout(() => setResendLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendLeft]);

  // ---- digit boxes -------------------------------------------------------------------------

  function focusBox(i: number) {
    boxRefs.current[Math.min(Math.max(i, 0), OTP_LENGTH - 1)]?.focus();
  }

  function setDigitAt(i: number, value: string) {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  // Puts several digits into consecutive boxes (paste, or the browser's one-time-code autofill).
  function fillFrom(start: number, raw: string) {
    const chars = raw.replace(/\D/g, "").slice(0, OTP_LENGTH - start).split("");
    if (chars.length === 0) return;
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((c, k) => {
        next[start + k] = c;
      });
      return next;
    });
    focusBox(start + chars.length);
  }

  function handleBoxChange(i: number, value: string) {
    if (value === "") {
      setDigitAt(i, "");
      return;
    }
    if (value.length > 2) {
      fillFrom(i, value); // autofill / pasted text that arrived through onChange
      return;
    }
    const d = value.replace(/\D/g, "").slice(-1); // keeps only the newest digit typed
    if (!d) return;
    setDigitAt(i, d);
    focusBox(i + 1);
  }

  function handleBoxKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      setDigitAt(i - 1, "");
      focusBox(i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    }
  }

  function handleBoxPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    // A full code always goes into the first box onward, whichever box was focused.
    fillFrom(text.replace(/\D/g, "").length >= OTP_LENGTH ? 0 : i, text);
  }

  function resetBoxes() {
    setDigits(emptyDigits());
    focusBox(0);
  }

  // ---- requests ----------------------------------------------------------------------------

  async function handleVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLocked || loading) return;
    setError(null);
    setInfo(null);

    if (code.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }

    setLoading(true);
    let redirecting = false;

    try {
      // deviceModel = real phone model / OS name from the browser. The verify route passes it to the
      // audit log so the login entry shows which device was used.
      const deviceModel = await getDeviceHint();
      const response = await fetch(`${BASE}/api/login/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, deviceModel }),
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && result?.success) {
        redirecting = true; // keep the overlay up while the browser navigates
        onSuccess();
        return;
      }

      if (response.status === 410) {
        // The password step expired (10 minutes) - start over
        onBack(result?.message || "Your sign-in session expired. Please sign in again.");
      } else if (response.status === 400 || response.status === 401) {
        // Wrong code: no attempt counter is shown on this step. The server limits code guesses itself
        // (after too many it answers 429 with a "try again in N minutes" message, shown below).
        setError(result?.message || "Invalid or expired code.");
        resetBoxes();
      } else {
        // 429 (server-side lockout), 500, etc.
        setError(result?.message || `Server error (${response.status}). Please try again or contact IT.`);
        resetBoxes();
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      if (!redirecting) setLoading(false);
    }
  }

  async function handleResend() {
    if (resendLeft > 0 || loading || resending || isLocked) return;
    setError(null);
    setInfo(null);
    setResending(true);

    try {
      // deviceModel = real phone model / OS version from the browser (shown in the OTP email).
      const deviceModel = await getDeviceHint();
      const response = await fetch(`${BASE}/api/login/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceModel }),
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 410) {
        onBack(result?.message || "Your sign-in session expired. Please sign in again.");
      } else if (result?.locked === true) {
        // Too many resends: the account is locked. Go back to the sign-in form and show why.
        onBack(result?.message || "Your account is locked. Please contact SPNC Admin.");
      } else if (!response.ok) {
        setError(result?.message || "Couldn't send a new code. Try again shortly.");
        if (response.status === 429) setResendLeft(RESEND_COOLDOWN_SEC);
      } else {
        setInfo("A new code was sent. Use the newest email.");
        setResendLeft(RESEND_COOLDOWN_SEC);
        resetBoxes();
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setResending(false);
    }
  }

  // ---- UI ----------------------------------------------------------------------------------

  return (
    <form
      onSubmit={handleVerify}
      autoComplete="off"
      style={{ "--otp-accent": ACCENT } as CSSProperties}
      className="text-center"
    >
      <h3 className={`text-2xl font-bold ${strong}`} style={{ fontFamily: "var(--font-display)" }}>
        We just sent an email
      </h3>
      <p className={`mt-2 text-sm ${muted}`}>Enter the security code we sent to</p>
      <p className={`mt-1 flex items-center justify-center gap-2 text-sm font-medium ${strong}`}>
        {maskedEmail || "your email"}
        <button
          type="button"
          onClick={() => onBack()}
          disabled={loading}
          aria-label="Go back to sign in"
          title="Go back to sign in"
          className="text-[color:var(--otp-accent)] transition hover:opacity-70 disabled:opacity-50"
        >
          <Pencil size={15} />
        </button>
      </p>

      {/* One box per digit */}
      <div className="mt-8 flex justify-center gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={i === 0}
            aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
            disabled={isLocked}
            readOnly={loading}
            suppressHydrationWarning
            value={d}
            onChange={(e) => handleBoxChange(i, e.target.value)}
            onKeyDown={(e) => handleBoxKeyDown(i, e)}
            onPaste={(e) => handleBoxPaste(i, e)}
            onFocus={(e) => e.target.select()}
            className={`h-14 max-w-[3.25rem] min-w-0 flex-1 rounded-xl border border-[color:var(--otp-accent)] text-center text-xl font-semibold outline-none transition focus:ring-2 focus:ring-[color:var(--otp-accent)] disabled:cursor-not-allowed disabled:opacity-60 ${
              isDark ? "bg-[#121B26] text-[#F2F1EC]" : "bg-[#FFF5FA] text-[#0B0B0B]"
            }`}
            style={{ fontFamily: "var(--font-mono-label)" }}
          />
        ))}
      </div>

      {/* Messages */}
      <div aria-live="polite" className="mt-4 min-h-5 text-sm">
        {error && !isLocked && (
          <p role="alert" className="text-[#E2685A]">
            {error}
          </p>
        )}
        {!error && info && <p className={muted}>{info}</p>}
      </div>

      <button
        type="submit"
        disabled={loading || isLocked || code.length !== OTP_LENGTH}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-sm font-semibold tracking-wide text-white transition disabled:cursor-not-allowed ${
          isDark ? "bg-[#F2419B] hover:bg-[#F55CAB] disabled:bg-[#4B5A68]" : "bg-[#0B0B0B] hover:bg-[#232323] disabled:bg-[#8A8A8A]"
        }`}
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? "Verifying…" : "Verify"}
      </button>

      <div className={`mt-6 text-sm ${muted}`}>
        <p>Didn&apos;t receive code?</p>
        <p className="mt-1">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLeft > 0 || loading || resending || isLocked}
            className="font-semibold text-[color:var(--otp-accent)] hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
          >
            {resending ? "Sending…" : "Resend"}
          </button>
          {resendLeft > 0 && <span className="tabular-nums"> - {formatCountdown(resendLeft)}</span>}
        </p>
      </div>
    </form>
  );
}
