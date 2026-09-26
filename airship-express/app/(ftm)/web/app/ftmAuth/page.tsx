// @ts-nocheck
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { signInWithPassword } from "../lib/auth";
import { getDashboardRouteForRole, normalizeRole } from "../lib/roleAccess";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    window.dispatchEvent(new CustomEvent("ftm:loading", { detail: { mode: "start" } }));

    const { user, error: authError } = await signInWithPassword(email.trim(), password);
    if (authError) {
      setLoading(false);
      window.dispatchEvent(new CustomEvent("ftm:loading", { detail: { mode: "stop" } }));
      setError(authError.message || "Unable to sign in. Please check your credentials.");
      return;
    }

    if (!user) {
      setLoading(false);
      window.dispatchEvent(new CustomEvent("ftm:loading", { detail: { mode: "stop" } }));
      setError("No user was returned. Try again or register a new account.");
      return;
    }

    const role = normalizeRole(user.role);
    if (!role) {
      setLoading(false);
      window.dispatchEvent(new CustomEvent("ftm:loading", { detail: { mode: "stop" } }));
      setError("This account does not have an approved FTM role.");
      return;
    }

    window.dispatchEvent(new CustomEvent("ftm:loading", { detail: { destination: getDashboardRouteForRole(role) } }));
  };

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="relative min-h-screen overflow-hidden bg-[#090b12] pt-9 text-white">
      <div className="absolute inset-x-0 top-0 z-40 flex h-9 items-center justify-between border-b border-white/10 bg-[#17151a] px-4 text-[11px] text-white/70 sm:px-7">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <a href="tel:+639454418789" className="whitespace-nowrap hover:text-white">☎ 0945 441 8789</a>
          <a href="mailto:airshipexpress.s@gmail.com" className="hidden truncate hover:text-white sm:inline">✉ airshipexpress.s@gmail.com</a>
        </div>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e2165f]" />
          Live network · Manila
        </span>
      </div>
      <div className="relative min-h-screen w-full">
        <section className="absolute inset-0 z-0 block min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/vehicle.png.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080a10]/75 via-[#080a10]/20 to-[#080a10]/55" />

          <div className="relative z-10 flex items-center justify-between p-6 sm:p-10 xl:p-14">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-pink-600/30">
                <Image src="/airship-logo.png" alt="Airship Express" width={48} height={48} className="h-full w-full object-contain p-1" priority />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-pink-300">Airship Express</p>
                <h1 className="text-xl font-black tracking-tight">Fleet Command</h1>
              </div>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-black/25 px-3.5 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-md lg:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Fleet online
            </span>
          </div>

          <div className="absolute bottom-8 left-6 z-10 max-w-lg sm:left-10 sm:bottom-12 xl:left-14">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.32em] text-pink-300">Airship Express / Fleet Operations</p>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl xl:text-6xl">Command every vehicle<br /><span className="text-pink-300">with clarity.</span></h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/70">Monitor vehicles, dispatch operations, and fleet performance from one command workspace.</p>
          </div>
        </section>

        <section className="relative z-20 flex min-h-screen w-full items-center justify-end overflow-hidden px-5 py-10 sm:px-8 lg:px-16 xl:px-24">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-black/20 to-[#090b12]/70" />
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="relative ml-auto w-full max-w-md space-y-8 rounded-[28px] border border-white/20 bg-transparent p-7 shadow-none backdrop-blur-sm sm:p-9"
          >
            <div className="space-y-2">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
                  <Image src="/airship-logo.png" alt="Airship Express" width={40} height={40} className="h-full w-full object-contain p-1" priority />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">Airship Express</span>
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Fleet and Transportation Management</h2>
              <p className="text-sm text-white/55">Enter your corporate credentials to access the fleet operations workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5"><label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-white/65">Email Address</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-pink-400 focus:bg-black/30 focus:ring-4 focus:ring-pink-500/10" placeholder="name@company.com" required /></div>
              <div className="space-y-1.5"><label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-white/65">Password</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-pink-400 focus:bg-black/30 focus:ring-4 focus:ring-pink-500/10" placeholder="••••••••••••" required /></div>
              <AnimatePresence>{error && <motion.div initial={{ height: 0, opacity: 1 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden"><div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-200">{error}</div></motion.div>}</AnimatePresence>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading} aria-busy={loading} className="w-full rounded-2xl bg-[#d41471] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-pink-600/25 transition-colors hover:bg-[#b80049] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Connecting to fleet..." : "Sign In"}</motion.button>
            </form>
            <div className="flex items-center justify-between text-[11px] text-white/35"><span>Secure enterprise workspace</span><span>Telemetry protected</span></div>
          </motion.div>
        </section>
      </div>
    </motion.main>
  );
}
