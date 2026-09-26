"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/app/(hr-dashboard)/supabase/client";
import ToastProvider, {
    useToast,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast";
import Loader from "@/app/components/Loader";
import {
    OTP_LENGTH,
    LOGIN_OTP_TTL_SECONDS,
    OTP_RESEND_COOLDOWN_SECONDS,
    SESSION_START_KEY,
} from "@/lib/hr-dashboard/constants/session";

type Step = "credentials" | "otp";

async function logSessionEvent(
    event:
        | "login_success"
        | "login_failed"
        | "logout_manual"
        | "logout_inactivity"
        | "logout_absolute"
        | "otp_sent"
        | "otp_verified"
        | "otp_failed",
    metadata: Record<string, unknown> = {},
    accessToken?: string | null
) {
    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
        }
        await fetch("/payroll-benefits-dashboard/api/settings/security", {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "log_event", event, metadata }),
        });
    } catch {
        // Logging must never block the login flow.
    }
}

function HRLoginContent() {
    const router = useRouter();
    const toast = useToast();

    const [step, setStep] = useState<Step>("credentials");
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
    const [otpExpiry, setOtpExpiry] = useState(LOGIN_OTP_TTL_SECONDS);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [authSnapshot, setAuthSnapshot] = useState<any>(null);

    const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        const cleanup = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                localStorage.removeItem(SESSION_START_KEY);
            }
        };
        cleanup();
    }, []);

    useEffect(() => {
        if (step !== "otp") return;
        if (otpExpiry <= 0) {
            setError("OTP expired. Please request a new one.");
            return;
        }
        const t = setInterval(() => setOtpExpiry((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [step, otpExpiry]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [resendCooldown]);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const { data: userRole } = await supabase
                    .from("hr_admin")
                    .select("role")
                    .eq("id", session.user.id)
                    .single();
                if (!userRole) return;
                const dashboardMap: Record<string, string> = {
                    super_admin: "/payroll-benefits-dashboard",
                    hr_payroll_admin: "/payroll-benefits-dashboard",
                    hr_performance_admin: "/performance-development-dashboard",
                    hr_recruitment_admin: "/recruitment-dashboard",
                    hr_workforce_admin: "/workforce-management-dashboard",
                };
                const dashboard = dashboardMap[userRole.role];
                if (dashboard) router.push(dashboard);
            } catch (err) {
                console.error("Session check error:", err);
            }
        };
        checkSession();
    }, [router]);

    async function handleCredentialsSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!employeeId || !password) {
            setError("Enter your employee ID and password to continue.");
            toast.showWarning("Please fill in all fields", "Validation Error");
            return;
        }

        setIsSubmitting(true);
        try {
            const roleRes = await fetch("/api/auth/role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId }),
            });
            const roleData = await roleRes.json();
            if (!roleRes.ok) {
                const msg = roleData?.message ?? "Invalid credentials.";
                setError(msg);
                toast.showError(msg, "Login Failed");
                await logSessionEvent("login_failed", {
                    employee_id_attempted: employeeId,
                    stage: "role_lookup",
                    reason: msg,
                });
                return;
            }

            const authRes = await fetch("/api/auth/hrAuth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId, password }),
            });
            const authData = await authRes.json();
            if (!authRes.ok) {
                const msg = authData?.message ?? "Invalid credentials.";
                setError(msg);
                toast.showError(msg, "Login Failed");
                await logSessionEvent(
                    "login_failed",
                    {
                        employee_id_attempted: employeeId,
                        stage: "password_check",
                        reason: msg,
                    },
                    authData?.session?.access_token ?? null
                );
                return;
            }

            const otpRes = await fetch("/api/auth/otp/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId }),
            });
            const otpData = await otpRes.json();
            if (!otpRes.ok) {
                const msg = otpData?.message ?? "Failed to send OTP.";
                setError(msg);
                toast.showError(msg, "OTP Error");
                await logSessionEvent(
                    "otp_failed",
                    {
                        employee_id: employeeId,
                        stage: "send_otp",
                        reason: msg,
                    },
                    authData?.session?.access_token ?? null
                );
                return;
            }

            await logSessionEvent(
                "otp_sent",
                { employee_id: employeeId, stage: "login_otp" },
                authData?.session?.access_token ?? null
            );

            setAuthSnapshot(authData);
            setStep("otp");
            setOtp(Array(OTP_LENGTH).fill(""));
            setOtpExpiry(otpData.expiresInSeconds ?? LOGIN_OTP_TTL_SECONDS);
            setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
            toast.showSuccess("Code sent to your registered email.", "OTP Sent");
            setTimeout(() => otpInputs.current[0]?.focus(), 100);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Something went wrong.";
            setError(msg);
            toast.showError(msg, "Error");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleOtpSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const code = otp.join("");
        if (code.length !== OTP_LENGTH) {
            setError(`Enter the ${OTP_LENGTH}-digit code.`);
            return;
        }
        if (!authSnapshot) {
            setError("Session lost. Please sign in again.");
            setStep("credentials");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/auth/otp/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId, otpCode: code }),
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = data?.message ?? "Invalid code.";
                setError(msg);
                toast.showError(msg, "OTP Failed");
                await logSessionEvent(
                    "otp_failed",
                    {
                        employee_id: employeeId,
                        stage: "verify_otp",
                        reason: msg,
                    },
                    authSnapshot?.session?.access_token ?? null
                );
                return;
            }

            if (authSnapshot.session) {
                const { error: setErr } = await supabase.auth.setSession({
                    access_token: authSnapshot.session.access_token,
                    refresh_token: authSnapshot.session.refresh_token,
                });
                if (setErr) {
                    setError("Failed to establish session.");
                    toast.showError("Failed to establish session.", "Session Error");
                    return;
                }
            }

            await logSessionEvent(
                "otp_verified",
                { employee_id: employeeId },
                authSnapshot?.session?.access_token ?? null
            );

            await logSessionEvent(
                "login_success",
                {
                    employee_id: employeeId,
                    role: authSnapshot?.role ?? null,
                    redirect_to: authSnapshot?.redirectTo ?? null,
                },
                authSnapshot?.session?.access_token ?? null
            );

            localStorage.setItem(SESSION_START_KEY, Date.now().toString());

            toast.showSuccess(
                authSnapshot.message || `Welcome back!`,
                "Login Successful"
            );

            const redirectUrl =
                authSnapshot.redirectTo || "/payroll-benefits-dashboard";

            setTimeout(() => {
                router.push(redirectUrl);
                router.refresh();
            }, 400);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Something went wrong.";
            setError(msg);
            toast.showError(msg, "Error");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleResendOtp() {
        if (resendCooldown > 0) return;
        setError(null);
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/auth/otp/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.message ?? "Failed to resend OTP.");
                return;
            }
            await logSessionEvent(
                "otp_sent",
                { employee_id: employeeId, stage: "resend_otp" },
                authSnapshot?.session?.access_token ?? null
            );
            toast.showSuccess("New code sent.", "OTP Resent");
            setOtpExpiry(data.expiresInSeconds ?? LOGIN_OTP_TTL_SECONDS);
            setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
            setOtp(Array(OTP_LENGTH).fill(""));
            otpInputs.current[0]?.focus();
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleOtpChange(index: number, value: string) {
        if (!/^\d*$/.test(value)) return;
        const next = [...otp];
        next[index] = value.slice(-1);
        setOtp(next);
        if (value && index < OTP_LENGTH - 1) {
            otpInputs.current[index + 1]?.focus();
        }
    }

    function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            otpInputs.current[index - 1]?.focus();
        }
    }

    function handleOtpPaste(e: React.ClipboardEvent) {
        const text = e.clipboardData.getData("text").replace(/\D/g, "");
        if (!text) return;
        const next = Array(OTP_LENGTH).fill("");
        for (let i = 0; i < Math.min(OTP_LENGTH, text.length); i++) {
            next[i] = text[i];
        }
        setOtp(next);
        otpInputs.current[Math.min(OTP_LENGTH - 1, text.length - 1)]?.focus();
        e.preventDefault();
    }

    const mm = String(Math.floor(otpExpiry / 60)).padStart(2, "0");
    const ss = String(otpExpiry % 60).padStart(2, "0");

    return (
        <div className="h-dvh w-full bg-paper text-ink font-rethink grid grid-cols-1 lg:grid-cols-[1fr_460px]">
            <div className="relative hidden lg:flex flex-col justify-between border-r border-line px-16 py-14 overflow-hidden">
                <div className="absolute bottom-14 right-14 rotate-[-6deg] select-none">
                    <div className="flex items-center gap-2 rounded-full border border-line px-4 py-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        <span className="font-rethink text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                            HR Access
                        </span>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    <Image
                        src="/images/logo-remove-bg.png"
                        alt="Airship Express"
                        width={168}
                        height={48}
                        className="h-10 w-auto"
                        priority
                    />
                </motion.div>

                <motion.div
                    className="max-w-lg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
                >
                    <p className="font-rethink text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
                        Human Resources
                    </p>
                    <h1 className="mt-5 font-bricolage text-[44px] font-medium leading-[1.05] tracking-tight">
                        Every route starts
                        <br />
                        with the crew
                        <br />
                        behind it.
                    </h1>
                    <p className="mt-5 text-[15px] leading-relaxed text-muted">
                        Sign in to manage recruitment, attendance, performance, and
                        payroll &mdash; everything for the people who move every
                        package, moving.
                    </p>
                </motion.div>

                <div className="flex items-center gap-2 text-[12px] text-muted">
                    <span className="h-1 w-1 rounded-full bg-accent" />
                    Internal use only &middot; Airship Express HR System
                </div>
            </div>

            <div className="h-dvh overflow-y-auto flex items-center justify-center px-5 py-8 sm:px-12 sm:py-16 relative">
                <AnimatePresence>
                    {isSubmitting && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 flex items-center justify-center bg-paper/80 backdrop-blur-sm"
                        >
                            <Loader />
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div
                    className="w-full max-w-sm relative z-10"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
                >
                    <div className="mb-6 sm:mb-10 lg:hidden">
                        <Image
                            src="/images/logo-remove-bg.png"
                            alt="Airship Express"
                            width={144}
                            height={40}
                            className="h-8 w-auto sm:h-9"
                            priority
                        />
                    </div>

                    {step === "credentials" && (
                        <>
                            <p className="font-rethink text-[12px] sm:text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
                                Welcome back
                            </p>
                            <h2 className="mt-2 sm:mt-3 font-bricolage text-[24px] sm:text-[28px] lg:text-[30px] font-medium tracking-tight">
                                Sign in to HR
                            </h2>
                            <p className="mt-2 sm:mt-2.5 text-[13.5px] sm:text-[14.5px] leading-relaxed text-muted">
                                Use the employee ID and password issued by HR.
                            </p>

                            <form
                                onSubmit={handleCredentialsSubmit}
                                className="mt-6 sm:mt-9 lg:mt-11 space-y-5 sm:space-y-7 lg:space-y-8"
                                noValidate
                            >
                                <div>
                                    <label
                                        htmlFor="employeeId"
                                        className="block text-[11.5px] sm:text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted"
                                    >
                                        Employee ID
                                    </label>
                                    <input
                                        id="employeeId"
                                        name="employeeId"
                                        type="text"
                                        autoComplete="username"
                                        value={employeeId}
                                        onChange={(e) => setEmployeeId(e.target.value)}
                                        placeholder="AX-01001"
                                        className="mt-2 block w-full border-0 border-b border-line bg-transparent px-0 py-2 text-[14px] sm:text-[15px] text-ink placeholder:text-line outline-none transition focus:border-accent"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-baseline justify-between">
                                        <label
                                            htmlFor="password"
                                            className="block text-[11.5px] sm:text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted"
                                        >
                                            Password
                                        </label>
                                        <a
                                            href="/forgot-password"
                                            className="text-[11.5px] sm:text-[12.5px] font-medium text-accent hover:text-accent-dark"
                                        >
                                            Forgot?
                                        </a>
                                    </div>

                                    <div className="relative">
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="current-password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="mt-2 block w-full border-0 border-b border-line bg-transparent px-0 py-2 pr-12 text-[14px] sm:text-[15px] text-ink placeholder:text-line outline-none transition focus:border-accent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute bottom-1.5 right-0 text-muted transition-colors hover:text-ink"
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? (
                                                <EyeOff size={17} strokeWidth={1.75} />
                                            ) : (
                                                <Eye size={17} strokeWidth={1.75} />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <div
                                        role="alert"
                                        className="border-l-2 border-accent pl-3 text-[13px] text-accent-dark"
                                    >
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-ink px-4 py-3.5 text-[14px] font-medium tracking-wide text-paper transition-colors duration-200 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSubmitting ? "Verifying…" : "Continue"}
                                </button>
                            </form>
                        </>
                    )}

                    {step === "otp" && (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("credentials");
                                    setError(null);
                                }}
                                className="flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"
                            >
                                <ArrowLeft size={14} /> Back
                            </button>

                            <div className="mt-4 mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                                <ShieldCheck className="w-6 h-6 text-accent" />
                            </div>

                            <p className="mt-4 font-rethink text-[12px] sm:text-[13px] font-medium uppercase tracking-[0.2em] text-accent text-center">
                                Security Check
                            </p>
                            <h2 className="mt-2 text-center font-bricolage text-[24px] sm:text-[28px] font-medium tracking-tight">
                                Enter OTP
                            </h2>
                            <p className="mt-2 text-center text-[13.5px] sm:text-[14.5px] leading-relaxed text-muted">
                                We sent a {OTP_LENGTH}-digit code to your registered email.
                            </p>

                            <form onSubmit={handleOtpSubmit} className="mt-6 space-y-6" noValidate>
                                <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
                                    {otp.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={(el) => {
                                                otpInputs.current[i] = el;
                                            }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(i, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                            className="w-full h-12 text-center text-[18px] font-medium border border-line rounded-lg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                                        />
                                    ))}
                                </div>

                                <div className="flex items-center justify-between text-[12.5px]">
                                    <span className={otpExpiry < 30 ? "text-red-600" : "text-muted"}>
                                        Expires in {mm}:{ss}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={resendCooldown > 0 || isSubmitting}
                                        className="font-medium text-accent hover:text-accent-dark disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {resendCooldown > 0
                                            ? `Resend in ${resendCooldown}s`
                                            : "Resend OTP"}
                                    </button>
                                </div>

                                {error && (
                                    <div
                                        role="alert"
                                        className="border-l-2 border-accent pl-3 text-[13px] text-accent-dark"
                                    >
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-ink px-4 py-3.5 text-[14px] font-medium tracking-wide text-paper transition-colors duration-200 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSubmitting ? "Verifying…" : "Verify & Sign in"}
                                </button>
                            </form>
                        </>
                    )}

                    <p className="mt-6 sm:mt-9 lg:mt-12 text-center text-[12px] sm:text-[12.5px] text-muted">
                        Trouble accessing your account? Contact HR at{" "}
                        <a
                            href="mailto:hr@airshipexpress.com"
                            className="font-medium text-accent transition-colors hover:text-accent-dark"
                        >
                            hr@airshipexpress.com
                        </a>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}

export default function HRLoginPage() {
    return (
        <ToastProvider position="top-right" maxToasts={5}>
            <HRLoginContent />
        </ToastProvider>
    );
}