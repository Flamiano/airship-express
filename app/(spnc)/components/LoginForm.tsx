"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Invalid email or password.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative w-[380px] rounded-sm border border-[#23303D] bg-[#121B26] pl-9 pr-8 py-9 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* punched perforation edge */}
      <div
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-4 -translate-x-1/2"
        style={{
          backgroundImage:
            "radial-gradient(circle, #0B1220 3px, transparent 3.5px)",
          backgroundSize: "100% 18px",
          backgroundPosition: "0 6px",
        }}
      />

      <p
        className="mb-1 text-[11px] font-medium tracking-[0.25em] text-[#F2A23B] uppercase"
        style={{ fontFamily: "var(--font-mono-label)" }}
      >
        Manifest // Access
      </p>

      <h1
        className="text-[32px] leading-tight font-semibold text-[#F2F1EC]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Airship Express
      </h1>
      <p className="mt-1 mb-6 text-sm text-[#8FA0AF]">
        Airship Express
      </p>

      {/* signature: origin-to-destination route line */}
      <svg viewBox="0 0 320 24" className="mb-6 h-6 w-full" aria-hidden="true">
        <circle cx="10" cy="12" r="4" fill="#F2A23B" />
        <line
          x1="18"
          y1="12"
          x2="298"
          y2="12"
          stroke="#2C4356"
          strokeWidth="2"
          strokeDasharray="5 7"
          className="route-line"
        />
        <path d="M298 12 L288 6 L288 18 Z" fill="#F2A23B" />
      </svg>

      <div className="mb-6 border-t border-dashed border-[#23303D]" aria-hidden="true" />

      {error && (
        <div
          role="alert"
          className="mb-5 border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[11px] font-medium tracking-[0.15em] text-[#8FA0AF] uppercase"
            style={{ fontFamily: "var(--font-mono-label)" }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full border-b border-[#2C4356] bg-transparent pb-2 text-[#F2F1EC] outline-none placeholder:text-[#4B5A68] focus:border-[#F2A23B] focus-visible:ring-2 focus-visible:ring-[#F2A23B]/40"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-[11px] font-medium tracking-[0.15em] text-[#8FA0AF] uppercase"
            style={{ fontFamily: "var(--font-mono-label)" }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="w-full border-b border-[#2C4356] bg-transparent pb-2 text-[#F2F1EC] outline-none placeholder:text-[#4B5A68] focus:border-[#F2A23B] focus-visible:ring-2 focus-visible:ring-[#F2A23B]/40"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full bg-[#F2A23B] py-3 text-sm font-semibold tracking-[0.1em] text-[#0B1220] uppercase transition hover:bg-[#F5B25C] focus-visible:ring-2 focus-visible:ring-[#F2A23B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121B26] disabled:cursor-not-allowed disabled:bg-[#4B5A68] disabled:text-[#8FA0AF]"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p
        className="mt-6 text-center text-sm text-[#8FA0AF]"
        suppressHydrationWarning
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-[#F2A23B] hover:text-[#F5B25C] underline-offset-2 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}