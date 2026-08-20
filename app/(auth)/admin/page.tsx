"use client";

import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Users, Clock, FileCheck } from "lucide-react";

const shiftStats = [
    { icon: Users, value: "48", label: "Riders on shift" },
    { icon: Clock, value: "6", label: "Late clock-ins today" },
    { icon: FileCheck, value: "12", label: "Leave requests pending" },
];

export default function HRAdminLogin() {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    function handleSubmit(e) {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Enter your work email and password to sign in.");
            return;
        }

        setSubmitting(true);
        setTimeout(() => {
            setSubmitting(false);
        }, 1200);
    }

    return (
        <div className="min-h-screen w-full bg-[#FCFBF9] flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(28,27,31,0.25)]">
                <div className="hidden md:flex flex-col justify-between bg-[#1C1B1F] p-10 relative overflow-hidden">
                    <div
                        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl opacity-20"
                        style={{ background: "#E5167E" }}
                    />

                    <div className="relative z-10">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-[#E5167E] flex items-center justify-center">
                                <span className="text-white font-extrabold text-sm">A</span>
                            </div>
                            <span className="text-white font-extrabold tracking-[-0.02em] text-lg">
                                Airship Express
                            </span>
                        </div>

                        <h1 className="mt-14 text-white text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em]">
                            HR Admin
                            <br />
                            Workspace
                        </h1>
                        <p className="mt-4 text-sm text-white/50 leading-relaxed max-w-xs">
                            Manage riders, attendance, and leave requests across every branch from one dashboard.
                        </p>
                    </div>

                    <div className="relative z-10 flex flex-col gap-3 rounded-2xl bg-white/[0.04] border border-white/10 p-5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                            Today at a glance
                        </span>
                        {shiftStats.map((s) => (
                            <div key={s.label} className="flex items-center gap-3">
                                <div className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.06] flex items-center justify-center">
                                    <s.icon className="h-4 w-4 text-[#E5167E]" strokeWidth={2.25} />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-white font-bold text-base">{s.value}</span>
                                    <span className="text-white/50 text-xs">{s.label}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-8 sm:p-10 flex flex-col justify-center">
                    <div className="md:hidden flex items-center gap-2.5 mb-8">
                        <div className="h-8 w-8 rounded-lg bg-[#E5167E] flex items-center justify-center">
                            <span className="text-white font-extrabold text-sm">A</span>
                        </div>
                        <span className="text-[#1C1B1F] font-extrabold tracking-[-0.02em] text-lg">
                            Airship Express
                        </span>
                    </div>

                    <h2 className="text-[#1C1B1F] text-2xl font-extrabold tracking-[-0.02em]">
                        Sign in to HR Admin
                    </h2>
                    <p className="mt-1.5 text-sm text-[#6B6B76]">
                        Use your work email to access the HR dashboard.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="hr-email" className="text-xs font-semibold text-[#1C1B1F]">
                                Work email
                            </label>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9B9BA5]" />
                                <input
                                    id="hr-email"
                                    type="email"
                                    autoComplete="username"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@airshipexpress.ph"
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#EAEAEA] bg-[#FCFBF9] text-sm text-[#1C1B1F] placeholder:text-[#9B9BA5] outline-none transition-colors focus:border-[#E5167E] focus:bg-white focus:ring-2 focus:ring-[#E5167E]/15"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label htmlFor="hr-password" className="text-xs font-semibold text-[#1C1B1F]">
                                    Password
                                </label>
                                <a href="#" className="text-xs font-medium text-[#E5167E] hover:underline">
                                    Forgot password?
                                </a>
                            </div>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9B9BA5]" />
                                <input
                                    id="hr-password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full h-11 pl-10 pr-11 rounded-xl border border-[#EAEAEA] bg-[#FCFBF9] text-sm text-[#1C1B1F] placeholder:text-[#9B9BA5] outline-none transition-colors focus:border-[#E5167E] focus:bg-white focus:ring-2 focus:ring-[#E5167E]/15"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9BA5] hover:text-[#1C1B1F] transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-[#E5167E]/8 border border-[#E5167E]/20 px-3.5 py-2.5 text-xs font-medium text-[#B3115F]">
                                {error}
                            </div>
                        )}

                        <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                                className="h-4 w-4 rounded border-[#EAEAEA] text-[#E5167E] focus:ring-[#E5167E]/30 accent-[#E5167E]"
                            />
                            <span className="text-xs text-[#6B6B76]">Keep me signed in on this device</span>
                        </label>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="group mt-2 h-11 rounded-xl bg-[#1C1B1F] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-[#E5167E] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {submitting ? "Signing in…" : "Sign in"}
                            {!submitting && (
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-xs text-[#9B9BA5]">
                        Access is limited to authorized HR staff. Contact your administrator if you need an account.
                    </p>
                </div>
            </div>
        </div>
    );
}