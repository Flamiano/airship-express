"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Oswald, IBM_Plex_Mono, Inter } from "next/font/google";
import { Eye, EyeOff, Loader2, Sun, Moon } from "lucide-react";

const display = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const monoLabel = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-label" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export default function LoginPage() {
  const router = useRouter();

  const [theme, setTheme] = useState<"dark" | "light">("light");
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  }

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
      {loading && (
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
        className={`relative flex flex-col justify-between overflow-hidden px-10 py-10 sm:px-16 sm:py-16 ${
          isDark ? "bg-[#0B1220]" : "bg-[#FAFAF9]"
        }`}
      >
        {/* Logo mark */}
        <img
          src="/logo.png"
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
            Use your company email and password.
          </p>

          {error && (
            <div role="alert" className="mb-5 border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className={`mb-1.5 block text-[11px] font-semibold tracking-[0.15em] uppercase ${
                  isDark ? "text-[#8FA0AF]" : "text-[#6B6B6B]"
                }`}
                style={{ fontFamily: "var(--font-mono-label)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className={`w-full border-b bg-transparent pb-2 outline-none focus:border-[#F2419B] ${
                  isDark
                    ? "border-[#2C4356] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                    : "border-[#E5E5E3] text-[#0B0B0B] placeholder:text-[#B8B8B5]"
                }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
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
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`w-full bg-transparent pb-2 outline-none ${
                    isDark ? "text-[#F2F1EC] placeholder:text-[#4B5A68]" : "text-[#0B0B0B] placeholder:text-[#B8B8B5]"
                  }`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className={`pb-2 transition ${
                    isDark ? "text-[#4B5A68] hover:text-[#8FA0AF]" : "text-[#B8B8B5] hover:text-[#6B6B6B]"
                  }`}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold tracking-wide text-white transition disabled:cursor-not-allowed ${
                isDark ? "bg-[#F2419B] hover:bg-[#F55CAB] disabled:bg-[#4B5A68]" : "bg-[#0B0B0B] hover:bg-[#232323] disabled:bg-[#8A8A8A]"
              }`}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div
            className={`mt-6 px-4 py-4 text-center text-sm ${
              isDark ? "bg-[#121B26] text-[#8FA0AF]" : "bg-[#F4F4FB] text-[#6B6B6B]"
            }`}
          >
            Trouble accessing your account? Contact HR at{" "}
            
             <a href="mailto:hr@airshipexpress.com"
              suppressHydrationWarning
              className="font-semibold text-[#F2419B] hover:underline"
            >
              hr@airshipexpress.com
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}