'use client';

import { useEffect, useState } from 'react';
import {
    Loader2,
    Save,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    AlertTriangle,
    Mail,
    ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/app/(hr-dashboard)/supabase/client';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';

type AdminProfile = {
    id: string;
    employee_id: string;
    email: string;
    full_name: string;
    role: string;
    created_at: string;
    receives_security_alerts: boolean;
};

type PasswordModalState = {
    newFullName: string;
    newEmail: string | null;
};

type OtpModalState = {
    newEmail: string;
    oldEmail: string;
};

export default function AccountPanel() {
    const supabase = createClient();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<AdminProfile | null>(null);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');

    const [passwordModal, setPasswordModal] =
        useState<PasswordModalState | null>(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [saving, setSaving] = useState(false);

    const [otpModal, setOtpModal] = useState<OtpModalState | null>(null);
    const [otpCode, setOtpCode] = useState('');
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [otpResendIn, setOtpResendIn] = useState(0);
    const [otpError, setOtpError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data: session } = await supabase.auth.getSession();
                const userId = session.session?.user?.id;
                if (!userId) {
                    toast.showError('Not signed in.');
                    return;
                }

                const { data, error } = await supabase
                    .from('hr_admin')
                    .select(
                        'id, employee_id, email, full_name, role, created_at, receives_security_alerts'
                    )
                    .eq('id', userId)
                    .maybeSingle();

                if (error) throw error;
                if (!data) throw new Error('Admin record not found.');
                if (cancelled) return;

                setProfile(data as AdminProfile);
                setFullName(data.full_name ?? '');
                setEmail(data.email ?? '');
            } catch (err: any) {
                toast.showError(err?.message || 'Failed to load profile.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [supabase, toast]);

    useEffect(() => {
        if (otpResendIn <= 0) return;
        const id = setInterval(
            () => setOtpResendIn((v) => (v > 0 ? v - 1 : 0)),
            1000
        );
        return () => clearInterval(id);
    }, [otpResendIn]);

    const dirty =
        !!profile &&
        (fullName.trim() !== profile.full_name ||
            email.trim().toLowerCase() !== profile.email.toLowerCase());

    const emailChanged =
        !!profile &&
        email.trim().toLowerCase() !== profile.email.toLowerCase();

    const requestSave = () => {
        if (!profile) return;
        if (!fullName.trim()) {
            toast.showError('Full name cannot be empty.');
            return;
        }
        if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
            toast.showError('Enter a valid email address.');
            return;
        }
        setPassword('');
        setShowPassword(false);
        setPasswordModal({
            newFullName: fullName.trim(),
            newEmail: emailChanged ? email.trim().toLowerCase() : null,
        });
    };

    const verifyPasswordThenProceed = async () => {
        if (!passwordModal || !profile) return;
        if (!password) {
            toast.showError('Enter your password.');
            return;
        }

        setVerifying(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const authEmail = sessionData.session?.user?.email;
            if (!authEmail) throw new Error('Session expired. Please sign in again.');

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: authEmail,
                password,
            });

            if (signInError) {
                toast.showError('Incorrect password.');
                return;
            }

            if (passwordModal.newEmail) {
                await startEmailChange(
                    passwordModal.newEmail,
                    passwordModal.newFullName
                );
            } else {
                await saveNameOnly(passwordModal.newFullName);
            }
        } catch (err: any) {
            toast.showError(err?.message || 'Verification failed.');
        } finally {
            setVerifying(false);
        }
    };

    const saveNameOnly = async (newFullName: string) => {
        if (!profile) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('hr_admin')
                .update({ full_name: newFullName })
                .eq('id', profile.id);

            if (error) throw error;

            setProfile({ ...profile, full_name: newFullName });
            setFullName(newFullName);
            setPasswordModal(null);
            setPassword('');
            toast.showSuccess('Profile updated.');
        } catch (err: any) {
            toast.showError(err?.message || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const startEmailChange = async (newEmail: string, newFullName: string) => {
        if (!profile) return;
        setSaving(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            if (!token) throw new Error('Session expired.');

            const res = await fetch(
                '/payroll-benefits-dashboard/api/settings/email-change',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ newEmail }),
                }
            );

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to start email change.');

            const oldEmail = profile.email;

            setPasswordModal(null);
            setPassword('');
            setOtpCode('');
            setOtpError(null);
            setOtpResendIn(30);
            setOtpModal({ newEmail, oldEmail });

            toast.showSuccess(
                `Verification code sent to ${newEmail}. A warning was sent to ${oldEmail}.`
            );
        } catch (err: any) {
            toast.showError(err?.message || 'Failed to start email change.');
        } finally {
            setSaving(false);
        }
    };

    const confirmEmailChange = async () => {
        if (!otpModal || !profile) return;
        if (!/^\d{6}$/.test(otpCode.trim())) {
            setOtpError('Enter the 6-digit code.');
            return;
        }

        setOtpVerifying(true);
        setOtpError(null);

        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            if (!token) throw new Error('Session expired.');

            const res = await fetch(
                '/payroll-benefits-dashboard/api/settings/email-change',
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ code: otpCode.trim() }),
                }
            );

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Verification failed.');

            const finalEmail = data.email as string;

            if (passwordModal && passwordModal.newFullName !== profile.full_name) {
                const { error: nameUpdateError } = await supabase
                    .from('hr_admin')
                    .update({ full_name: passwordModal.newFullName })
                    .eq('id', profile.id);

                if (nameUpdateError) {
                    console.warn('[account] name update after email change failed:', nameUpdateError);
                }
            }

            const finalName =
                passwordModal?.newFullName ?? profile.full_name;

            setProfile({
                ...profile,
                email: finalEmail,
                full_name: finalName,
            });
            setEmail(finalEmail);
            setFullName(finalName);
            setOtpModal(null);
            setOtpCode('');
            setPasswordModal(null);
            toast.showSuccess('Email updated successfully.');
        } catch (err: any) {
            setOtpError(err?.message || 'Verification failed.');
            toast.showError(err?.message || 'Verification failed.');
        } finally {
            setOtpVerifying(false);
        }
    };

    const resendCode = async () => {
        if (!otpModal || otpResendIn > 0) return;
        setSaving(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            if (!token) throw new Error('Session expired.');

            const res = await fetch(
                '/payroll-benefits-dashboard/api/settings/email-change',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ newEmail: otpModal.newEmail }),
                }
            );

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to resend code.');

            setOtpCode('');
            setOtpError(null);
            setOtpResendIn(30);
            toast.showSuccess(`A new code was sent to ${otpModal.newEmail}.`);
        } catch (err: any) {
            toast.showError(err?.message || 'Failed to resend code.');
        } finally {
            setSaving(false);
        }
    };

    const cancelEmailChange = async () => {
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            if (token) {
                await fetch(
                    '/payroll-benefits-dashboard/api/settings/email-change',
                    {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
            }
        } catch {
            // best-effort
        } finally {
            setOtpModal(null);
            setOtpCode('');
            setOtpError(null);
            setEmail(profile?.email ?? '');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-14">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-800/40 dark:bg-red-950/30">
                <p className="text-sm text-red-800 dark:text-red-300 font-rethink">
                    Could not load your admin profile.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-base font-semibold text-ink font-rethink">
                    Account
                </h2>
                <p className="mt-1 text-[12px] text-muted font-rethink">
                    Update your name or email. Both require password
                    verification. Email changes also require a one-time code sent
                    to your new address.
                </p>
            </header>

            <div className="rounded-xl border border-line bg-paper p-4 dark:border-line/40">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-semibold text-paper">
                        {(profile.full_name || '?')
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink font-rethink">
                            {profile.full_name}
                        </p>
                        <p className="truncate text-[11.5px] text-muted font-rethink">
                            {profile.email}
                        </p>
                        <p className="mt-1 text-[10.5px] uppercase tracking-wider text-accent font-rethink">
                            {profile.role.replace(/_/g, ' ')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 rounded-xl border border-line bg-paper p-4 dark:border-line/40">
                <Field label="Employee ID">
                    <input
                        value={profile.employee_id}
                        disabled
                        className="w-full rounded-lg border border-line bg-ink/[0.03] px-3 py-2 text-sm text-muted font-rethink dark:border-line/40"
                    />
                </Field>

                <Field label="Full name">
                    <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/40 font-rethink"
                    />
                </Field>

                <Field label="Email">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/40 font-rethink"
                    />
                    {emailChanged && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-rethink">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            You will need to verify the new address with a code
                            sent to it. A warning will also be sent to your
                            current email.
                        </p>
                    )}
                </Field>

                <Field label="Password">
                    <div className="flex items-center justify-between rounded-lg border border-line bg-ink/[0.02] px-3 py-2 dark:border-line/40 dark:bg-paper/[0.04]">
                        <span className="text-sm text-muted font-rethink">
                            ••••••••••
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                toast.showError(
                                    'Password reset uses your existing OTP flow.'
                                )
                            }
                            className="text-[11px] font-medium text-accent hover:underline font-rethink"
                        >
                            Change password
                        </button>
                    </div>
                </Field>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        disabled={!dirty || saving}
                        onClick={() => {
                            setFullName(profile.full_name);
                            setEmail(profile.email);
                        }}
                        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-ink/[0.03] disabled:opacity-50 dark:border-line/40 font-rethink"
                    >
                        Discard changes
                    </button>
                    <button
                        type="button"
                        disabled={!dirty || saving}
                        onClick={requestSave}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent/90 disabled:opacity-50 font-rethink"
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save changes
                    </button>
                </div>
            </div>

            {passwordModal && (
                <PasswordModal
                    emailChanged={!!passwordModal.newEmail}
                    password={password}
                    setPassword={setPassword}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    verifying={verifying || saving}
                    onCancel={() => {
                        setPasswordModal(null);
                        setPassword('');
                    }}
                    onConfirm={verifyPasswordThenProceed}
                />
            )}

            {otpModal && (
                <OtpModal
                    newEmail={otpModal.newEmail}
                    oldEmail={otpModal.oldEmail}
                    code={otpCode}
                    setCode={(v) => {
                        setOtpCode(v);
                        if (otpError) setOtpError(null);
                    }}
                    error={otpError}
                    verifying={otpVerifying}
                    resendIn={otpResendIn}
                    onResend={resendCode}
                    onCancel={cancelEmailChange}
                    onConfirm={confirmEmailChange}
                />
            )}
        </div>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted font-rethink">
                {label}
            </label>
            {children}
        </div>
    );
}

function PasswordModal({
    emailChanged,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    verifying,
    onCancel,
    onConfirm,
}: {
    emailChanged: boolean;
    password: string;
    setPassword: (v: string) => void;
    showPassword: boolean;
    setShowPassword: (v: boolean) => void;
    verifying: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-line bg-paper p-5 shadow-xl dark:border-line/40">
                <div className="mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-accent" />
                    <p className="text-sm font-semibold text-ink font-rethink">
                        Confirm your password
                    </p>
                </div>
                <p className="mb-4 text-[12px] leading-relaxed text-muted font-rethink">
                    {emailChanged
                        ? 'Enter your password. We will then send a code to your new email and a warning to your current email.'
                        : 'Enter your password to save changes to your profile.'}
                </p>

                <div className="relative mb-3">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                        placeholder="Your password"
                        className="w-full rounded-lg border border-line bg-paper px-3 py-2 pr-10 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/40 font-rethink"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onConfirm();
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                        {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                        ) : (
                            <Eye className="h-4 w-4" />
                        )}
                    </button>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={verifying}
                        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-ink/[0.03] disabled:opacity-50 dark:border-line/40 font-rethink"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={verifying || !password}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent/90 disabled:opacity-50 font-rethink"
                    >
                        {verifying ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {verifying ? 'Verifying…' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function OtpModal({
    newEmail,
    oldEmail,
    code,
    setCode,
    error,
    verifying,
    resendIn,
    onResend,
    onCancel,
    onConfirm,
}: {
    newEmail: string;
    oldEmail: string;
    code: string;
    setCode: (v: string) => void;
    error: string | null;
    verifying: boolean;
    resendIn: number;
    onResend: () => void;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-line bg-paper p-5 shadow-xl dark:border-line/40">
                <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    <p className="text-sm font-semibold text-ink font-rethink">
                        Verify your new email
                    </p>
                </div>

                <div className="mb-4 space-y-2 text-[12px] leading-relaxed text-muted font-rethink">
                    <p className="flex items-start gap-2">
                        <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
                        <span>
                            We sent a 6-digit code to{' '}
                            <strong className="text-ink break-all">
                                {newEmail}
                            </strong>
                            .
                        </span>
                    </p>
                    <p className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                        <span>
                            A warning was sent to{' '}
                            <strong className="text-ink break-all">
                                {oldEmail}
                            </strong>
                            .
                        </span>
                    </p>
                </div>

                <input
                    value={code}
                    onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full rounded-lg border border-line bg-paper px-3 py-3 text-center text-xl tracking-[0.6em] text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/40 font-mono"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && code.length === 6) onConfirm();
                    }}
                />

                {error && (
                    <p className="mt-2 text-[11px] text-red-600 dark:text-red-400 font-rethink">
                        {error}
                    </p>
                )}

                <div className="mt-3 flex items-center justify-between text-[11px] text-muted font-rethink">
                    <span>Code expires in 10 minutes.</span>
                    <button
                        type="button"
                        onClick={onResend}
                        disabled={resendIn > 0 || verifying}
                        className="font-medium text-accent hover:underline disabled:opacity-50"
                    >
                        {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                    </button>
                </div>

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={verifying}
                        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-ink/[0.03] disabled:opacity-50 dark:border-line/40 font-rethink"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={verifying || code.length !== 6}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent/90 disabled:opacity-50 font-rethink"
                    >
                        {verifying ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {verifying ? 'Verifying…' : 'Confirm email change'}
                    </button>
                </div>
            </div>
        </div>
    );
}