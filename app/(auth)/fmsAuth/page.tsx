'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

export default function fmsAuth() {
    const router = useRouter();
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!employeeId || !password) {
            setError('Enter your employee ID and password to continue.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/auth/payroll-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId, password }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setError(data?.message ?? 'Employee ID or password is incorrect.');
                return;
            }

            router.push('/payroll');
        } catch {
            setError('Something went wrong. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="h-dvh w-full bg-paper text-ink font-rethink grid grid-cols-1 lg:grid-cols-[1fr_460px]">
            {/* Left: editorial panel */}
            <div className="relative hidden lg:flex flex-col justify-between border-r border-line px-16 py-14 overflow-hidden">
                {/* Signature: a small rotated access tag, kept quiet so the logo leads */}
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
                    transition={{ duration: 0.5, ease: 'easeOut' }}
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
                    transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
                >
                    <p className="font-rethink text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
                        HR &amp; Payroll
                    </p>
                    <h1 className="mt-5 font-bricolage text-[44px] font-medium leading-[1.05] tracking-tight">
                        Every route starts
                        <br />
                        with the crew
                        <br />
                        behind it.
                    </h1>
                    <p className="mt-5 text-[15px] leading-relaxed text-muted">
                        Sign in to process payslips, review attendance, and keep the
                        people who move every package, moving.
                    </p>
                </motion.div>

                <div className="flex items-center gap-2 text-[12px] text-muted">
                    <span className="h-1 w-1 rounded-full bg-accent" />
                    Internal use only &middot; Airship Express Payroll System
                </div>
            </div>

            {/* Right: form panel */}
            <div className="h-dvh overflow-y-auto flex items-center justify-center px-5 py-8 sm:px-12 sm:py-16">
                <motion.div
                    className="w-full max-w-sm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
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

                    <p className="font-rethink text-[12px] sm:text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
                        Welcome back
                    </p>
                    <h2 className="mt-2 sm:mt-3 font-bricolage text-[24px] sm:text-[28px] lg:text-[30px] font-medium tracking-tight">
                        Sign in to Payroll
                    </h2>
                    <p className="mt-2 sm:mt-2.5 text-[13.5px] sm:text-[14.5px] leading-relaxed text-muted">
                        Use the employee ID and password issued by HR.
                    </p>

                    <form
                        onSubmit={handleSubmit}
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
                                placeholder="AX-01234"
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
                                    type={showPassword ? 'text' : 'password'}
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
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                            {isSubmitting ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>

                    <p className="mt-6 sm:mt-9 lg:mt-12 text-center text-[12px] sm:text-[12.5px] text-muted">
                        Trouble accessing your account? Contact HR at{' '}
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