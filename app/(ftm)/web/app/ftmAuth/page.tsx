"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signInWithPassword } from "../lib/auth";
import { getDashboardRouteForRole } from "../lib/roleAccess";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { user, error: authError } = await signInWithPassword(email.trim(), password);

    if (authError) {
      setLoading(false);
      setError(authError.message || "Unable to sign in. Please check your credentials.");
      return;
    }

    if (!user) {
      setLoading(false);
      setError("No user was returned. Try again or register a new account.");
      return;
    }

    setIsNavigating(true);
    const destination = getDashboardRouteForRole(user.role ?? "customer");

    setTimeout(() => {
      router.push(destination);
    }, 400);
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: isNavigating ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-pink-50/80 via-white to-rose-100/60"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-pink-300/30 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-rose-400/20 blur-3xl"
      />

      <div className="grid h-full w-full lg:grid-cols-2">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-[#141d23] p-12 text-white lg:flex xl:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#b80049_1px,transparent_1px)] opacity-10 [background-size:24px_24px]" />
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative z-10 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b80049] text-xl font-black text-white shadow-lg shadow-pink-600/30"
              >
                AE
              </motion.div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-pink-300">Airship Express</p>
                <h1 className="text-xl font-black tracking-tight">Fleet Command</h1>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Telemetry Online
            </span>
          </motion.div>

          <div className="relative z-10 my-auto py-8 flex flex-col items-center">
            <div className="relative h-64 w-full max-w-md mx-auto rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 overflow-hidden shadow-2xl flex items-center justify-center">
              <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 pointer-events-none opacity-10">
                <div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div>
                <div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div>
              </div>
              <svg className="absolute inset-0 w-full h-full p-6 overflow-visible" viewBox="0 0 400 200">
                <defs>
                  <linearGradient id="exactRouteGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#b80049" /><stop offset="50%" stopColor="#ff75a0" /><stop offset="100%" stopColor="#34d399" /></linearGradient>
                  <g id="deliveryTruck" className="drop-shadow-lg"><rect x="-16" y="-12" width="32" height="24" rx="6" fill="#b80049" stroke="#ff75a0" strokeWidth="1.5" /><path d="M 8 -12 L 14 -4 L 14 12 L -14 12 L -14 -12 Z" fill="#9a003c" opacity="0.5" /><circle cx="-8" cy="13" r="3.5" fill="#1e293b" /><circle cx="8" cy="13" r="3.5" fill="#1e293b" /></g>
                </defs>
                <path d="M 40,150 Q 140,20 220,110 T 360,50" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="4" strokeLinecap="round" />
                <motion.path d="M 40,150 Q 140,20 220,110 T 360,50" fill="none" stroke="url(#exactRouteGradient)" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
                <circle cx="40" cy="150" r="6" fill="#b80049" /><circle cx="40" cy="150" r="12" stroke="#b80049" strokeWidth="1.5" fill="none" className="animate-ping opacity-75" />
                <circle cx="360" cy="50" r="6" fill="#34d399" /><circle cx="360" cy="50" r="12" stroke="#34d399" strokeWidth="1.5" fill="none" className="animate-ping opacity-75" />
                <use href="#deliveryTruck"><animateMotion dur="4s" repeatCount="indefinite" rotate="auto" path="M 40,150 Q 140,20 220,110 T 360,50" calcMode="spline" keySplines="0.42 0 0.58 1; 0.42 0 0.58 1" /></use>
              </svg>
            </div>
            <div className="text-center mt-6 space-y-1"><h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-pink-100 to-pink-300 bg-clip-text text-transparent">Active Telemetry & Transit Vector</h2><p className="text-xs text-slate-400 max-w-sm mx-auto">Real-time route optimization, tracking shipments dynamically across regional hubs.</p></div>
          </div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }} className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-500"><span>Secure Enterprise Workspace</span><span className="font-medium text-pink-400">v2.4 Live</span></motion.div>
        </section>

        <section className="flex h-full w-full flex-col justify-center bg-white/60 px-8 backdrop-blur-xl sm:px-16 lg:px-20 xl:px-28">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="mx-auto w-full max-w-md space-y-8">
            <div className="space-y-2"><div className="mb-6 flex items-center gap-3 lg:hidden"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b80049] font-black text-white">AE</div><span className="text-xs font-bold uppercase tracking-[0.2em] text-pink-600">Airship Express</span></div><h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Sign in to portal</h2><p className="text-sm text-slate-500">Enter your corporate credentials to access your dashboard.</p></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5"><label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-600">Email Address</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/50 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-100" placeholder="name@company.com" required /></div>
              <div className="space-y-1.5"><label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-600">Password</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/50 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-100" placeholder="••••••••••••" required /></div>
              <AnimatePresence>{error && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden"><div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">{error}</div></motion.div>}</AnimatePresence>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading || isNavigating} className="w-full rounded-2xl bg-[#b80049] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-pink-600/25 transition-colors hover:bg-[#9a003c] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">{loading || isNavigating ? <span className="flex items-center justify-center gap-2"><svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>{isNavigating ? "Redirecting..." : "Authenticating..."}</span> : "Sign In"}</motion.button>
            </form>
            <div className="rounded-2xl border border-pink-100/60 bg-pink-50/40 p-4 text-xs text-slate-600 backdrop-blur-sm"><p className="font-semibold text-slate-800">Need assistance?</p><p className="mt-1 text-slate-500">Contact your IT support desk or system dispatcher for account provisioning.</p></div>
          </motion.div>
        </section>
      </div>
    </motion.main>
  );
}
