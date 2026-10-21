"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Oswald, IBM_Plex_Mono, Inter } from "next/font/google";
import { Eye, EyeOff, Loader2, Sun, Moon } from "lucide-react";
import airshiplogo from "../../../../public/images/logo-remove-bg.png";
import OtpForm from "./OtpForm";
import { getDeviceHint } from "./deviceHint";

const display = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const monoLabel = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-label" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

// Full URL prefix of the app. Set NEXT_PUBLIC_BASE_PATH in .env.local if it differs.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "/spnc/app";

// Masks a plain text input with dots. Used instead of type="password" so Chrome does not
// treat the field as a credential field (no saved logins, no "Suggest strong password",
// no "Save password?" prompt).
const MASK_STYLE = { WebkitTextSecurity: "disc" } as React.CSSProperties;

// The USER ID box only accepts letters, numbers, "-", "_" and ".". Anything else (quotes ' ",
// semicolons, spaces, < > and so on) is removed as it is typed or pasted. The server checks this
// again, because browser-side limits can be bypassed.
const ID_MAX_LENGTH = 64;
const cleanId = (value: string) => value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, ID_MAX_LENGTH);

// ---- Page lock (display only; the server still enforces its own locks) -----------------------
// The whole login page (User ID, password, button) is locked until the countdown ends, and the
// lock survives a refresh because the unlock time is saved in the browser.
const LOCK_STORAGE_KEY = "spnc-page-lock-until";
// The User ID the server locked (only set for server locks). While the page is locked, the page
// asks the server every few seconds whether that account is still locked, so an admin unlock
// opens the page straight away instead of waiting out the 5 minutes.
const LOCK_ID_KEY = "spnc-page-lock-id";
const LOCK_CHECK_INTERVAL_MS = 3000;
const ATTEMPTS_STORAGE_KEY = "spnc-page-attempts";
// After this many wrong User ID / password tries (any IDs), the page locks.
const MAX_PAGE_ATTEMPTS = 5;
// Used when the server gives no timer (employee accounts stay locked until an admin unlocks
// them) and for the browser-side attempt counter.
const PAGE_LOCK_COOLDOWN_SEC = 5 * 60;

const formatCountdown = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

function readAttempts(): number {
  try {
    const n = Number(window.localStorage.getItem(ATTEMPTS_STORAGE_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeAttempts(n: number) {
  try {
    if (n <= 0) window.localStorage.removeItem(ATTEMPTS_STORAGE_KEY);
    else window.localStorage.setItem(ATTEMPTS_STORAGE_KEY, String(n));
  } catch {}
}

export default function LoginPage() {
  // Start with "light" so server HTML and first client render match (fixes hydration warning).
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const isDark = theme === "dark";

  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two-step sign-in: "credentials" (Employee ID + password), then "otp" (email code, see ./OtpForm).
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [maskedEmail, setMaskedEmail] = useState("");
  // True while OtpForm is verifying or resending (drives the full-screen overlay).
  const [otpBusy, setOtpBusy] = useState(false);

  // Fields stay read-only until the user clicks/focuses them. This stops Chrome from
  // auto-filling them on page load. They become editable on first focus.
  const [idLocked, setIdLocked] = useState(true);
  const [pwLocked, setPwLocked] = useState(true);

  // If the browser can't mask a text input (e.g. some Firefox versions), fall back to a real
  // password input so the password is never shown in plain text.
  const [maskSupported, setMaskSupported] = useState(true);

  // Page lock: true while the login page is locked (countdown running).
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [lockedId, setLockedId] = useState<string | null>(null);
  const secondsLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;

  // Locks the whole page. `retryAfterSeconds` comes from the server when it has a timer;
  // otherwise the default cooldown is used.
  function startPageLock(retryAfterSeconds?: unknown, serverLockedId?: string) {
    const sec =
      typeof retryAfterSeconds === "number" && retryAfterSeconds > 0 ? retryAfterSeconds : PAGE_LOCK_COOLDOWN_SEC;
    const until = Date.now() + sec * 1000;

    setLockedUntil(until);
    setNow(Date.now());
    setIsLocked(true);
    setPassword("");
    setIdNumber("");
    setError(null);
    writeAttempts(0);

    setLockedId(serverLockedId ?? null);

    try {
      window.localStorage.setItem(LOCK_STORAGE_KEY, String(until));
      if (serverLockedId) window.localStorage.setItem(LOCK_ID_KEY, serverLockedId);
      else window.localStorage.removeItem(LOCK_ID_KEY);
    } catch {}
  }

  function clearPageLock() {
    setLockedUntil(null);
    setLockedId(null);
    setIsLocked(false);
    writeAttempts(0);
    try {
      window.localStorage.removeItem(LOCK_STORAGE_KEY);
      window.localStorage.removeItem(LOCK_ID_KEY);
    } catch {}
  }

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("theme");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);

      // Clean up the "remember Employee ID" value saved by the previous version of this page.
      window.localStorage.removeItem("spnc-remember-id");

      // Remove the old browser-side lock/attempt values from the previous version of this page.
      window.localStorage.removeItem("spnc-login-attempts");
      window.localStorage.removeItem("spnc-login-locked-until");

      // Restore the page lock after a refresh.
      const savedLock = Number(window.localStorage.getItem(LOCK_STORAGE_KEY));
      if (savedLock > Date.now()) {
        setLockedUntil(savedLock);
        setLockedId(window.localStorage.getItem(LOCK_ID_KEY));
        setNow(Date.now());
        setIsLocked(true);
      } else {
        window.localStorage.removeItem(LOCK_STORAGE_KEY);
        window.localStorage.removeItem(LOCK_ID_KEY);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) - keep defaults
    }

    try {
      if (typeof CSS !== "undefined" && CSS.supports) {
        setMaskSupported(CSS.supports("-webkit-text-security", "disc"));
      }
    } catch {
      setMaskSupported(false);
    }
  }, []);

  // Countdown ticker: unlocks the page when the time is up.
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) clearPageLock();
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  // While the page is locked because of a server lock, ask the server every few seconds whether
  // that account is still locked. If an admin unlocked it, the page opens straight away.
  useEffect(() => {
    if (!lockedUntil || !lockedId) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${BASE}/api/login/lock-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idNumber: lockedId }),
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.locked === false) clearPageLock();
      } catch {
        // Network problem: keep the lock and try again on the next tick.
      }
    };

    check();
    const timer = setInterval(check, LOCK_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [lockedUntil, lockedId]);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem("theme", next);
    } catch {}
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLocked) return;
    setError(null);

    const trimmedId = idNumber.trim();
    if (!trimmedId) {
      setError("Please enter your User ID.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // deviceModel = real phone model / OS version from the browser (shown in the OTP email).
        body: JSON.stringify({ idNumber: trimmedId, password, deviceModel: await getDeviceHint() }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (result.locked === true) {
          // The server locked this account after too many failed logins: lock the whole page.
          startPageLock(result.retryAfterSeconds, trimmedId);
        } else if (response.status === 401) {
          // Wrong User ID or password. Count it in the browser too, so five wrong tries with
          // ANY IDs lock the page (the server only counts failures per ID).
          const attempts = readAttempts() + 1;
          if (attempts >= MAX_PAGE_ATTEMPTS) {
            startPageLock();
          } else {
            writeAttempts(attempts);
            setPassword("");
            setError(result.message || "Incorrect User ID or password.");
          }
        } else if (response.status === 400) {
          setPassword("");
          setError(result.message || "Incorrect User ID or password.");
        } else {
          setError(result.message || `Server error (${response.status}). Please try again or contact IT.`);
        }
        setLoading(false);
        return;
      }

      // Password accepted: reset the browser-side attempt counter.
      writeAttempts(0);

      // Password accepted and the server emailed a code -> switch to the OTP step.
      if (result.otpRequired) {
        setPassword("");
        setMaskedEmail(result.maskedEmail ?? "");
        setStep("otp");
        setLoading(false);
        return;
      }

      try {
        sessionStorage.setItem("spnc-last-activity", String(Date.now()));
      } catch {}

      // Clear the fields from memory before leaving the page.
      setPassword("");

      // Full navigation to the complete URL (avoids the double base-path problem of router.push).
      // The overlay stays visible until the browser leaves the page.
      window.location.assign(`${BASE}/dashboard`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  function backToCredentials(message: string | null = null) {
    setStep("credentials");
    setError(message);
  }

  // Called by OtpForm once the emailed code is accepted.
  function handleOtpSuccess() {
    writeAttempts(0);
    try {
      sessionStorage.setItem("spnc-last-activity", String(Date.now()));
    } catch {}

    window.location.assign(`${BASE}/dashboard`);
  }

  return (
    <main
      className={`${display.variable} ${monoLabel.variable} ${body.variable} relative grid min-h-screen grid-cols-1 lg:grid-cols-2 ${
        isDark ? "bg-[#0B1220]" : "bg-white"
      }`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Light/dark toggle — top right */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className={`fixed top-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-md border transition ${
          isDark
            ? "border-[#23303D] bg-[#121B26] text-[#F2A23B] hover:border-[#F2A23B]/40"
            : "border-[#E5E5E3] bg-[#FAFAF9] text-[#0B0B0B] hover:border-[#F2419B]/60"
        }`}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Full-screen loading overlay */}
      {(loading || otpBusy) && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm ${
            isDark ? "bg-[#0B1220]/70" : "bg-white/70"
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={36} className="animate-spin text-[#F2419B]" />
            <p className={`text-sm font-medium ${isDark ? "text-[#8FA0AF]" : "text-[#6B6B6B]"}`}>Signing in…</p>
          </div>
        </div>
      )}

      {/* Left panel — brand / marketing side */}
      <div
        className={`relative hidden flex-col justify-between overflow-hidden px-10 py-10 sm:px-16 sm:py-16 lg:flex ${
          isDark ? "bg-[#0B1220]" : "bg-[#FAFAF9]"
        }`}
      >
        {/* Logo mark */}
        <Image
          src={airshiplogo}
          alt="Airship Express"
          width={220}
          height={80}
          className={`h-14 w-auto self-start object-contain object-left ${isDark ? "rounded bg-white/90 p-2" : ""}`}
        />

        {/* Headline block */}
        <div className="max-w-md">
          <p
            className="mb-3 text-xs font-semibold tracking-[0.25em] text-[#F2419B] uppercase"
            style={{ fontFamily: "var(--font-mono-label)" }}
          >
            Secure Access
          </p>
          <h1
            className={`text-4xl leading-[1.1] font-bold sm:text-5xl ${isDark ? "text-[#F2F1EC]" : "text-[#0B0B0B]"}`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            Service Provider & Network Control Portal
          </h1>
          <p className={`mt-5 text-base leading-relaxed ${isDark ? "text-[#8FA0AF]" : "text-[#6B6B6B]"}`}>
            Access the Service Provider & Network Control for managing service providers, planning transportation routes,
            monitoring rates and tariffs, maintaining standard operating procedures, and organizing schedules and transit
            timetables.
          </p>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <p className={`flex items-center gap-2 text-xs ${isDark ? "text-[#8FA0AF]" : "text-[#6B6B6B]"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#F2419B]" />
            Internal use only · Airship Express Service Provider & Network Control
          </p>
          <span
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide uppercase ${
              isDark ? "border-[#23303D] text-[#F2F1EC]" : "border-[#E5E5E3] text-[#0B0B0B]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#F2419B]" />
            Service Provider & Network Control
          </span>
        </div>
      </div>

      {/* Right panel — sign in form */}
      <div
        className={`flex items-center justify-center border-t px-6 py-12 lg:border-t-0 lg:border-l ${
          isDark ? "border-[#23303D] bg-[#0B1220]" : "border-[#E5E5E3] bg-white"
        }`}
      >
        <div className="w-full max-w-sm">
          {/* Heading only on the first step; the code step is a self-contained card (see ./OtpForm). */}
          {step === "credentials" && (
            <>
              <p
                className="mb-2 text-xs font-semibold tracking-[0.25em] text-[#F2419B] uppercase"
                style={{ fontFamily: "var(--font-mono-label)" }}
              >
                Welcome Back
              </p>
              <h2
                className={`text-3xl font-bold ${isDark ? "text-[#F2F1EC]" : "text-[#0B0B0B]"}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                Sign in to Service Provider & Network Control
              </h2>
              <p className={`mt-2 mb-8 text-sm ${isDark ? "text-[#8FA0AF]" : "text-[#6B6B6B]"}`}>
                Use your User ID and password.
              </p>
            </>
          )}

          {/* Lockout banner with countdown */}
          {isLocked && (
            <div role="alert" className="mb-5 border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
              Too many failed attempts. Sign-in is locked. Contact SPNC Admin if your account stays locked.
            </div>
          )}

          {error && !isLocked && (
            <div role="alert" className="mb-5 border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
              {error}
            </div>
          )}

          {/* Both fields are plain text inputs (the password is masked with CSS), the form has
              autoComplete="off", field names are non-standard, and password-manager ignore
              attributes are set. Together these stop saved-login lists, "Suggest strong
              password", autofill and "Save password?" prompts. */}
          {step === "credentials" ? (
            <form
              onSubmit={handleLogin}
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              className="space-y-6"
            >
              <div>
                <label
                  htmlFor="ae-employee-ref"
                  className={`mb-1.5 block text-[11px] font-semibold tracking-[0.15em] uppercase ${
                    isDark ? "text-[#8FA0AF]" : "text-[#6B6B6B]"
                  }`}
                  style={{ fontFamily: "var(--font-mono-label)" }}
                >
                  USER ID
                </label>
                <input
                  id="ae-employee-ref"
                  name="ae-employee-ref"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  readOnly={idLocked}
                  disabled={isLocked}
                  onFocus={() => setIdLocked(false)}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  suppressHydrationWarning
                  placeholder="e.g. AE-000123"
                  className={`w-full border-b bg-transparent pb-2 outline-none focus:border-[#F2419B] disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDark
                      ? "border-[#2C4356] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "border-[#E5E5E3] text-[#0B0B0B] placeholder:text-[#B8B8B5]"
                  }`}
                  style={{ fontFamily: "var(--font-mono-label)" }}
                  maxLength={ID_MAX_LENGTH}
                  value={idNumber}
                  onChange={(e) => setIdNumber(cleanId(e.target.value))}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="ae-secret-key"
                  className={`mb-1.5 block text-[11px] font-semibold tracking-[0.15em] uppercase ${
                    isDark ? "text-[#8FA0AF]" : "text-[#6B6B6B]"
                  }`}
                  style={{ fontFamily: "var(--font-mono-label)" }}
                >
                  Password
                </label>
                <div
                  className={`flex items-center border-b focus-within:border-[#F2419B] ${
                    isDark ? "border-[#2C4356]" : "border-[#E5E5E3]"
                  }`}
                >
                  <input
                    id="ae-secret-key"
                    name="ae-secret-key"
                    // Plain text input masked with CSS, so Chrome does not see a password field.
                    // Falls back to a real password input only if the browser can't mask text.
                    type={maskSupported || showPassword ? "text" : "password"}
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    readOnly={pwLocked}
                    disabled={isLocked}
                    onFocus={() => setPwLocked(false)}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    suppressHydrationWarning
                    className={`w-full bg-transparent pb-2 outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                      isDark ? "text-[#F2F1EC] placeholder:text-[#4B5A68]" : "text-[#0B0B0B] placeholder:text-[#B8B8B5]"
                    }`}
                    style={maskSupported && !showPassword ? MASK_STYLE : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLocked}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className={`pb-2 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isDark ? "text-[#4B5A68] hover:text-[#8FA0AF]" : "text-[#B8B8B5] hover:text-[#6B6B6B]"
                    }`}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isLocked}
                className={`flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold tracking-wide text-white transition disabled:cursor-not-allowed ${
                  isDark ? "bg-[#F2419B] hover:bg-[#F55CAB] disabled:bg-[#4B5A68]" : "bg-[#0B0B0B] hover:bg-[#232323] disabled:bg-[#8A8A8A]"
                }`}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? "Signing in…" : isLocked ? "Locked" : "Sign in"}
              </button>
            </form>
          ) : (
            <OtpForm
              maskedEmail={maskedEmail}
              isDark={isDark}
              isLocked={isLocked}
              onSuccess={handleOtpSuccess}
              onBack={backToCredentials}
              onBusyChange={setOtpBusy}
            />
          )}

          <div
            className={`mt-6 px-4 py-4 text-center text-sm ${
              isDark ? "bg-[#121B26] text-[#8FA0AF]" : "bg-[#F4F4FB] text-[#6B6B6B]"
            }`}
          >
            Trouble accessing your account? Contact SPNC Admin at{" "}
            {/* suppressHydrationWarning: browser extensions (e.g. Keychainify) add classes to mailto links
                before React hydrates, which triggers a harmless mismatch warning. */}
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=airshipexpress9@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#F2419B] hover:underline"
              suppressHydrationWarning
            >
              airshipexpress9@gmail.com
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
