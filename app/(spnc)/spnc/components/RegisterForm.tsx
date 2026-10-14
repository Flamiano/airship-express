"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import airshiplogo from "../../../../public/images/logo-remove-bg.png"; // same path the Sidebar uses (same folder)

const labelClass = "mb-1.5 block text-[11px] font-medium tracking-[0.15em] text-[#8FA0AF] uppercase";
const inputClass =
  "w-full rounded-md border border-[#2C4356] bg-[#0B1220] px-3 py-2.5 text-sm text-[#F2F1EC] outline-none transition placeholder:text-[#4B5A68] focus:border-[#F2419B] focus-visible:ring-2 focus-visible:ring-[#F2419B]/30";

type RegisterFormProps = {
  /**
   * Called after the account is created. When given, the form stays where it is
   * (e.g. a pop-up on the Employee Activity page) instead of going to the dashboard.
   */
  onSuccess?: (created: { email: string; fullName: string }) => void;
  /** Shows a close (×) button and calls this when it is clicked. */
  onCancel?: () => void;
  /** Admin pop-up mode: "Create employee account" heading, no "Sign in" link. */
  embedded?: boolean;
};

export default function RegisterForm({ onSuccess, onCancel, embedded = false }: RegisterFormProps = {}) {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/spnc/app/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // From the admin pop-up (onSuccess given): create the account but stay logged in as the admin
        body: JSON.stringify({ email, password, full_name: fullName, keep_current_session: !!onSuccess }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Couldn't create account.");
        return;
      }

      if (onSuccess) {
        onSuccess({ email, fullName });
        setFullName("");
        setEmail("");
        setPassword("");
        setShowPassword(false);
        return;
      }

      router.push("/spnc/app/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#23303D] bg-[#121B26] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Brand accent bar */}
      <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #F2419B, #FF8CC6 55%, #3A1229)" }} />

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          aria-label="Close"
          className="absolute right-3 top-4 rounded-md p-1.5 text-[#8FA0AF] transition hover:bg-[#1A2530] hover:text-[#F2F1EC] disabled:opacity-50"
        >
          <X size={18} />
        </button>
      )}

      <div className="px-8 pb-8 pt-7">
        {/* Brand */}
        <div className="mb-6 flex items-center gap-3">
          <span
            className="shrink-0 rounded-[14px] p-[2px] shadow-[0_0_22px_rgba(242,65,155,0.35)]"
            style={{ background: "linear-gradient(135deg, #F2419B, #FF8CC6 55%, #3A1229)" }}
          >
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#F2F1EC]">
              <Image src={airshiplogo} alt="Airship Express" width={40} height={40} priority className="h-10 w-10 object-contain" />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block text-[18px] leading-tight font-bold tracking-tight text-[#F2F1EC]" style={{ fontFamily: "var(--font-display)" }}>
              Airship{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, #F2419B, #FF8CC6)" }}>
                Express
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] text-[#8FA0AF]">Network Control Suite</span>
          </span>
        </div>

        <div className="mb-6 h-px w-full" style={{ background: "linear-gradient(90deg, rgba(242,65,155,0.6), #23303D 60%, transparent)" }} />

        <p className="mb-1 text-[11px] font-medium tracking-[0.25em] text-[#F2419B] uppercase" style={{ fontFamily: "var(--font-mono-label)" }}>
          New Account
        </p>
        <h1 className="text-[26px] leading-tight font-semibold text-[#F2F1EC]" style={{ fontFamily: "var(--font-display)" }}>
          {embedded ? "Create employee account" : "Create your account"}
        </h1>
        <p className="mt-1 mb-6 text-sm text-[#8FA0AF]">
          {embedded ? "Enter the employee's details. They can sign in with this email and password." : "Enter your details to get started."}
        </p>

        {error && (
          <div role="alert" className="mb-5 rounded-md border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label htmlFor="full_name" className={labelClass} style={{ fontFamily: "var(--font-mono-label)" }}>
              Full Name
            </label>
            <input id="full_name" type="text" autoComplete="name" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div>
            <label htmlFor="email" className={labelClass} style={{ fontFamily: "var(--font-mono-label)" }}>
              Email
            </label>
            <input id="email" type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <label htmlFor="password" className={labelClass} style={{ fontFamily: "var(--font-mono-label)" }}>
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                placeholder="At least 8 characters"
                className={`${inputClass} pr-10`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#8FA0AF] transition hover:text-[#F2419B]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#F2419B] py-3 text-sm font-semibold tracking-[0.1em] text-[#0B1220] uppercase transition hover:bg-[#FF8CC6] focus-visible:ring-2 focus-visible:ring-[#F2419B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121B26] disabled:cursor-not-allowed disabled:bg-[#4B5A68] disabled:text-[#8FA0AF]"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {!embedded && (
          <p className="mt-6 text-center text-sm text-[#8FA0AF]">
            Already have an account?{" "}
            <Link href="/spncAuth/login" className="font-medium text-[#F2419B] transition hover:text-[#FF8CC6]">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}