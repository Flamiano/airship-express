'use client';

import { useEffect, useState } from 'react';
import {
    Loader2,
    Shield,
    ShieldCheck,
    ShieldAlert,
    LogIn,
    LogOut,
    KeyRound,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Smartphone,
    Tablet,
    Laptop,
    Monitor,
    Lock,
    Unlock,
    Mail,
    Trash2,
    Ban,
} from 'lucide-react';
import { createClient } from '@/app/(hr-dashboard)/supabase/client';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';

type SessionEvent = {
    id: string;
    event: string;
    ip: string | null;
    user_agent: string | null;
    metadata: any;
    created_at: string;
};

type SecurityEvent = {
    id: string;
    event_type: string;
    trigger_intent: string | null;
    severity: 'warning' | 'critical';
    trigger_message: string | null;
    created_at: string;
};

type ActiveSession = {
    session_id: string;
    created_at: string;
    updated_at: string;
    not_after: string | null;
    ip: string | null;
    device: string;
    user_agent: string | null;
};

type SecurityData = {
    admin: { id: string; email: string; fullName: string; role: string };
    lastLogin: SessionEvent | null;
    failedAttempts24h: number;
    securityEvents: SecurityEvent[];
    sessionLog: SessionEvent[];
    otp: {
        activeSessions: Array<{ id: string; scope: string; expires_at: string; created_at: string }>;
        pending: Array<{ id: string; purpose: string; expires_at: string; attempts: number; resend_count: number; created_at: string }>;
        locks: Array<{ admin_id: string; purpose: string; locked_until: string; locked_at: string }>;
        locked: boolean;
    };
    bank: {
        attempts: number;
        lastAttemptAt: string | null;
        lockedUntil: string | null;
        locked: boolean;
        createAttempts: number;
        createLockedUntil: string | null;
        createLocked: boolean;
    };
    emailChange: {
        id: string;
        old_email: string;
        new_email: string;
        new_email_expires_at: string;
        attempts: number;
        created_at: string;
    } | null;
    healthScore: number;
    eventLabels: Record<string, string>;
    fetchedAt: string;
};

type DeviceInfo = {
    label: string;
    type: 'phone' | 'tablet' | 'laptop' | 'desktop' | 'unknown';
};

const EVENT_ICONS: Record<string, React.ElementType> = {
    login_success: LogIn,
    login_failed: AlertTriangle,
    logout_manual: LogOut,
    logout_inactivity: LogOut,
    logout_absolute: LogOut,
    otp_sent: KeyRound,
    otp_verified: CheckCircle2,
    otp_failed: XCircle,
};

const EVENT_TONES: Record<string, string> = {
    login_success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    login_failed: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
    logout_manual: 'text-muted bg-ink/[0.05] dark:bg-paper/[0.06]',
    logout_inactivity: 'text-muted bg-ink/[0.05] dark:bg-paper/[0.06]',
    logout_absolute: 'text-muted bg-ink/[0.05] dark:bg-paper/[0.06]',
    otp_sent: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40',
    otp_verified: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    otp_failed: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
};

function formatWhen(iso: string) {
    return new Date(iso).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
    });
}

function shortWhen(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function parseDevice(ua: string | null): DeviceInfo {
    if (!ua) return { label: 'Unknown device', type: 'unknown' };

    const lc = ua.toLowerCase();

    let os: string | null = null;
    let osVersion: string | null = null;

    if (lc.includes('windows nt 11')) {
        os = 'Windows';
        osVersion = '11';
    } else if (lc.includes('windows nt 10')) {
        os = 'Windows';
        osVersion = '10';
    } else if (lc.includes('windows nt 6.3')) {
        os = 'Windows';
        osVersion = '8.1';
    } else if (lc.includes('windows nt 6.2')) {
        os = 'Windows';
        osVersion = '8';
    } else if (lc.includes('windows nt 6.1')) {
        os = 'Windows';
        osVersion = '7';
    } else if (lc.includes('windows')) {
        os = 'Windows';
    } else if (lc.includes('android')) {
        os = 'Android';
        const m = ua.match(/Android\s+([\d.]+)/i);
        if (m) osVersion = m[1];
    } else if (lc.includes('iphone')) {
        os = 'iPhone';
        const m = ua.match(/OS\s+([\d_]+)/i);
        if (m) osVersion = m[1].replace(/_/g, '.');
    } else if (lc.includes('ipad')) {
        os = 'iPad';
        const m = ua.match(/OS\s+([\d_]+)/i);
        if (m) osVersion = m[1].replace(/_/g, '.');
    } else if (lc.includes('ipod')) {
        os = 'iPod';
    } else if (lc.includes('cros')) {
        os = 'ChromeOS';
    } else if (lc.includes('mac os x') || lc.includes('macintosh')) {
        os = 'macOS';
    } else if (lc.includes('linux')) {
        os = 'Linux';
    }

    let browser: string | null = null;
    if (lc.includes('edg/')) browser = 'Edge';
    else if (lc.includes('opr/') || lc.includes('opera')) browser = 'Opera';
    else if (lc.includes('chrome/')) browser = 'Chrome';
    else if (lc.includes('firefox/')) browser = 'Firefox';
    else if (lc.includes('safari/')) browser = 'Safari';

    let type: DeviceInfo['type'] = 'desktop';
    if (lc.includes('ipad') || (lc.includes('android') && !lc.includes('mobile'))) {
        type = 'tablet';
    } else if (
        lc.includes('mobile') ||
        lc.includes('iphone') ||
        lc.includes('ipod') ||
        lc.includes('android')
    ) {
        type = 'phone';
    } else if (
        lc.includes('macintosh') ||
        lc.includes('windows') ||
        lc.includes('linux') ||
        lc.includes('cros')
    ) {
        type = 'laptop';
    }

    const osLabel = os ? (osVersion ? `${os} ${osVersion}` : os) : 'Unknown OS';
    const browserLabel = browser ?? 'Browser';

    return { label: `${browserLabel} on ${osLabel}`, type };
}

function deviceIconFor(type: DeviceInfo['type']) {
    switch (type) {
        case 'phone':
            return Smartphone;
        case 'tablet':
            return Tablet;
        case 'laptop':
            return Laptop;
        default:
            return Monitor;
    }
}

function locationLabel(metadata: any): string | null {
    if (!metadata) return null;
    const city = metadata.city;
    const region = metadata.region;
    const country = metadata.country_name;

    if (city && region) return `${city}, ${region}`;
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (region) return region;
    if (country) return country;
    return null;
}

async function authedFetch(
    supabase: ReturnType<typeof createClient>,
    input: string,
    init: RequestInit = {}
) {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const headers: Record<string, string> = {
        ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(input, { ...init, headers });

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
        const text = await res.text().catch(() => '');
        throw new Error(
            `Bad response from ${input} (status ${res.status}). ${res.status === 404
                ? 'Route not found.'
                : res.status === 401
                    ? 'Not authenticated.'
                    : text.slice(0, 120).replace(/\s+/g, ' ')
            }`
        );
    }

    return res;
}

export default function SecurityPanel() {
    const supabase = createClient();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<SecurityData | null>(null);
    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const load = async () => {
        try {
            const res = await authedFetch(
                supabase,
                '/payroll-benefits-dashboard/api/settings/security'
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Failed to load security data.');
            setData(json as SecurityData);
        } catch (err: any) {
            toast.showError(err?.message || 'Failed to load security data.');
        } finally {
            setLoading(false);
        }
    };

    const loadSessions = async () => {
        try {
            setSessionsLoading(true);
            const res = await authedFetch(
                supabase,
                '/payroll-benefits-dashboard/api/settings/sessions'
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Failed to load sessions.');
            setSessions(json.sessions ?? []);
        } catch (err: any) {
            toast.showError(err?.message || 'Failed to load sessions.');
        } finally {
            setSessionsLoading(false);
        }
    };

    useEffect(() => {
        load();
        loadSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const runAction = async (action: string, label: string) => {
        setActionLoading(action);
        try {
            const res = await authedFetch(
                supabase,
                '/payroll-benefits-dashboard/api/settings/security',
                { method: 'POST', body: JSON.stringify({ action }) }
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || `Failed to ${label}.`);
            toast.showSuccess(`${label} done.`);
            await load();
            await loadSessions();
        } catch (err: any) {
            toast.showError(err?.message || `Failed to ${label}.`);
        } finally {
            setActionLoading(null);
        }
    };

    const signOutSession = async (sessionId: string) => {
        if (!window.confirm('Sign out this device? It will need to log in again.')) {
            return;
        }
        setActionLoading(`session:${sessionId}`);
        try {
            const res = await authedFetch(
                supabase,
                '/payroll-benefits-dashboard/api/settings/sessions',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'sign_out_session',
                        session_id: sessionId,
                    }),
                }
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Failed to sign out.');
            toast.showSuccess('Device signed out.');
            await load();
            await loadSessions();
        } catch (err: any) {
            toast.showError(err?.message || 'Failed to sign out.');
        } finally {
            setActionLoading(null);
        }
    };

    const signOutAll = async () => {
        if (
            !window.confirm(
                'Sign out every device including this one? You will need to log in again.'
            )
        ) {
            return;
        }
        setActionLoading('sign_out_all');
        try {
            const res = await authedFetch(
                supabase,
                '/payroll-benefits-dashboard/api/settings/sessions',
                {
                    method: 'POST',
                    body: JSON.stringify({ action: 'sign_out_all' }),
                }
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Failed to sign out.');
            toast.showSuccess('All devices signed out.');
            window.location.href = '/hrAuth';
        } catch (err: any) {
            toast.showError(err?.message || 'Failed to sign out.');
            setActionLoading(null);
        }
    };

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center py-14">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
        );
    }

    const scoreTone =
        data.healthScore >= 80
            ? 'text-emerald-600 dark:text-emerald-400'
            : data.healthScore >= 60
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';

    const scoreBar =
        data.healthScore >= 80
            ? 'bg-emerald-500'
            : data.healthScore >= 60
                ? 'bg-amber-500'
                : 'bg-red-500';

    const HealthIcon =
        data.healthScore >= 80
            ? ShieldCheck
            : data.healthScore >= 60
                ? Shield
                : ShieldAlert;

    const bankLocked = data.bank.locked;
    const bankCreateLocked = data.bank.createLocked;

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-base font-semibold text-ink font-rethink">
                    Security
                </h2>
                <p className="mt-1 text-[12px] text-muted font-rethink">
                    Monitor your account, review activity, and manage active
                    sessions.
                </p>
            </header>

            <div className="rounded-xl border border-line bg-paper p-4 dark:border-line/40">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <HealthIcon className={`h-5 w-5 mt-0.5 ${scoreTone}`} />
                        <div>
                            <p className="text-[13px] font-semibold text-ink font-rethink">
                                Account health
                            </p>
                            <p className="mt-0.5 text-[11.5px] text-muted font-rethink">
                                {data.healthScore >= 80
                                    ? 'No unusual activity in the last 24 hours.'
                                    : data.healthScore >= 60
                                        ? 'A few items need your attention.'
                                        : 'Several security signals detected. Review below.'}
                            </p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className={`text-xl font-semibold ${scoreTone} font-mono tabular-nums`}>
                            {data.healthScore}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted font-rethink">
                            score
                        </p>
                    </div>
                </div>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink/[0.06] dark:bg-paper/[0.08]">
                    <div
                        className={`h-full transition-all duration-500 ${scoreBar}`}
                        style={{ width: `${data.healthScore}%` }}
                    />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-rethink">
                    <Stat label="Failed 24h" value={String(data.failedAttempts24h)} tone={data.failedAttempts24h > 0 ? 'warning' : 'normal'} />
                    <Stat label="Critical events" value={String(data.securityEvents.filter((e) => e.severity === 'critical').length)} tone={data.securityEvents.some((e) => e.severity === 'critical') ? 'danger' : 'normal'} />
                    <Stat label="Active sessions" value={String(sessions.length)} tone={sessions.length > 1 ? 'warning' : 'normal'} />
                </div>
            </div>

            <Section
                title="Active devices"
                subtitle="Every device currently signed in to your account."
                right={
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={async () => {
                                await loadSessions();
                                await load();
                            }}
                            disabled={actionLoading !== null || sessionsLoading}
                            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-ink/[0.03] disabled:opacity-50 dark:border-line/40 font-rethink"
                        >
                            <RefreshCw className={`h-3 w-3 ${sessionsLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        {sessions.length > 1 && (
                            <button
                                type="button"
                                onClick={signOutAll}
                                disabled={actionLoading !== null}
                                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300 font-rethink"
                            >
                                {actionLoading === 'sign_out_all' ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <LogOut className="h-3 w-3" />
                                )}
                                Sign out all
                            </button>
                        )}
                    </div>
                }
            >
                {sessionsLoading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted" />
                    </div>
                ) : sessions.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-muted font-rethink">
                        No active sessions found.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {sessions.map((s, idx) => {
                            const isCurrent = idx === 0;
                            const isRevoking = actionLoading === `session:${s.session_id}`;
                            const device = parseDevice(s.user_agent);
                            const DeviceIcon = deviceIconFor(device.type);
                            const location = locationLabel(s.metadata ?? null);
                            return (
                                <li
                                    key={s.session_id}
                                    className={`flex items-start gap-3 rounded-lg border p-3 ${isCurrent
                                        ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-950/20'
                                        : 'border-line/60 dark:border-line/30'
                                        }`}
                                >
                                    <span
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isCurrent
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                            : 'bg-accent/10 text-accent'
                                            }`}
                                    >
                                        <DeviceIcon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[12.5px] font-medium text-ink font-rethink truncate">
                                                {device.label}
                                            </p>
                                            {isCurrent && (
                                                <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                    This device
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-muted font-rethink">
                                            Signed in {formatWhen(s.created_at)}
                                        </p>
                                        <p className="mt-0.5 text-[10.5px] text-muted/80 font-rethink">
                                            Last active {shortWhen(s.updated_at)}
                                            {location ? ` · ${location}` : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => signOutSession(s.session_id)}
                                        disabled={actionLoading !== null}
                                        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10.5px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300 font-rethink"
                                    >
                                        {isRevoking ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <LogOut className="h-3 w-3" />
                                        )}
                                        Sign out
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>

            <Section
                title="One-time passwords"
                subtitle="Pending codes and active unlock sessions."
                right={
                    <button
                        type="button"
                        onClick={() => runAction('revoke_otp_sessions', 'Revoking OTP sessions')}
                        disabled={actionLoading !== null}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-ink/[0.03] disabled:opacity-50 dark:border-line/40 font-rethink"
                    >
                        {actionLoading === 'revoke_otp_sessions' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Trash2 className="h-3 w-3" />
                        )}
                        Revoke all
                    </button>
                }
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MiniCard
                        icon={Lock}
                        title="Active sessions"
                        value={String(data.otp.activeSessions.length)}
                        subtitle={
                            data.otp.activeSessions.length > 0
                                ? `Latest scope: ${data.otp.activeSessions[0].scope}`
                                : 'No active OTP sessions'
                        }
                        tone={data.otp.activeSessions.length > 0 ? 'warning' : 'normal'}
                    />
                    <MiniCard
                        icon={KeyRound}
                        title="Pending codes"
                        value={String(data.otp.pending.length)}
                        subtitle={
                            data.otp.pending.length > 0
                                ? `${data.otp.pending[0].purpose.replace(/_/g, ' ')} · ${data.otp.pending[0].attempts} attempt${data.otp.pending[0].attempts === 1 ? '' : 's'}`
                                : 'No pending verifications'
                        }
                        tone={data.otp.pending.length > 0 ? 'warning' : 'normal'}
                    />
                </div>

                {data.otp.locked && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-800/40 dark:bg-amber-950/30">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 font-rethink">
                            OTP is locked due to too many incorrect attempts. It will
                            unlock automatically, or you can revoke the lock.
                        </p>
                    </div>
                )}
            </Section>

            <Section
                title="Bank reveal"
                subtitle="Password attempts on sensitive bank account data."
                right={
                    (bankLocked || bankCreateLocked || data.bank.attempts > 0 || data.bank.createAttempts > 0) ? (
                        <button
                            type="button"
                            onClick={() => runAction('clear_bank_lock', 'Clearing bank lock')}
                            disabled={actionLoading !== null}
                            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-ink/[0.03] disabled:opacity-50 dark:border-line/40 font-rethink"
                        >
                            {actionLoading === 'clear_bank_lock' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Unlock className="h-3 w-3" />
                            )}
                            Clear attempts
                        </button>
                    ) : null
                }
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MiniCard
                        icon={bankLocked ? Lock : Unlock}
                        title="Reveal attempts"
                        value={String(data.bank.attempts)}
                        subtitle={
                            data.bank.lockedUntil
                                ? `Locked until ${formatWhen(data.bank.lockedUntil)}`
                                : data.bank.lastAttemptAt
                                    ? `Last attempt ${shortWhen(data.bank.lastAttemptAt)}`
                                    : 'No attempts recorded'
                        }
                        tone={bankLocked ? 'danger' : data.bank.attempts > 0 ? 'warning' : 'normal'}
                    />
                    <MiniCard
                        icon={bankCreateLocked ? Lock : Unlock}
                        title="Create attempts"
                        value={String(data.bank.createAttempts)}
                        subtitle={
                            data.bank.createLockedUntil
                                ? `Locked until ${formatWhen(data.bank.createLockedUntil)}`
                                : 'No create attempts'
                        }
                        tone={bankCreateLocked ? 'danger' : data.bank.createAttempts > 0 ? 'warning' : 'normal'}
                    />
                </div>
            </Section>

            {data.emailChange && (
                <Section
                    title="Pending email change"
                    subtitle="A change is in progress and not yet verified."
                    right={
                        <button
                            type="button"
                            onClick={() => runAction('cancel_email_change', 'Cancelling email change')}
                            disabled={actionLoading !== null}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300 font-rethink"
                        >
                            {actionLoading === 'cancel_email_change' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Ban className="h-3 w-3" />
                            )}
                            Cancel change
                        </button>
                    }
                >
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800/40 dark:bg-amber-950/30">
                        <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="min-w-0 text-[11.5px] text-amber-800 dark:text-amber-300 font-rethink">
                            <p className="break-all">
                                <span className="font-semibold">From:</span> {data.emailChange.old_email}
                            </p>
                            <p className="mt-0.5 break-all">
                                <span className="font-semibold">To:</span> {data.emailChange.new_email}
                            </p>
                            <p className="mt-1 text-[10.5px] opacity-80">
                                Requested {shortWhen(data.emailChange.created_at)} · {data.emailChange.attempts} attempt{data.emailChange.attempts === 1 ? '' : 's'}
                            </p>
                        </div>
                    </div>
                </Section>
            )}

            <Section
                title="Recent activity"
                subtitle="Last 30 events on your admin account."
                right={
                    <button
                        type="button"
                        onClick={load}
                        disabled={actionLoading !== null}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-ink/[0.03] disabled:opacity-50 dark:border-line/40 font-rethink"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Refresh
                    </button>
                }
            >
                {data.sessionLog.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-muted font-rethink">
                        No activity recorded yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-line dark:divide-line/40">
                        {data.sessionLog.map((e) => {
                            const Icon = EVENT_ICONS[e.event] ?? Shield;
                            const tone = EVENT_TONES[e.event] ?? 'text-muted bg-ink/[0.05]';
                            const label = data.eventLabels[e.event] ?? e.event;
                            const device = parseDevice(e.user_agent);
                            const location = locationLabel(e.metadata);
                            return (
                                <li key={e.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone}`}>
                                        <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12.5px] font-medium text-ink font-rethink">
                                            {label}
                                        </p>
                                        <p className="mt-0.5 text-[10.5px] text-muted font-rethink">
                                            {formatWhen(e.created_at)}
                                            {location ? ` · ${location}` : ''}
                                        </p>
                                        {e.user_agent && (
                                            <p className="mt-0.5 text-[10px] text-muted/80 font-rethink truncate">
                                                {device.label}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>

            <Section
                title="Airy security events"
                subtitle="Restricted requests detected by the AI assistant."
            >
                {data.securityEvents.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-muted font-rethink">
                        No security events. Airy has not blocked any requests.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {data.securityEvents.map((ev) => {
                            const isCritical = ev.severity === 'critical';
                            return (
                                <li
                                    key={ev.id}
                                    className={`rounded-lg border p-3 ${isCritical
                                        ? 'border-red-200 bg-red-50/60 dark:border-red-800/40 dark:bg-red-950/30'
                                        : 'border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/30'
                                        }`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle
                                            className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isCritical
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-amber-600 dark:text-amber-400'
                                                }`}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p
                                                    className={`text-[12px] font-semibold ${isCritical
                                                        ? 'text-red-800 dark:text-red-300'
                                                        : 'text-amber-800 dark:text-amber-300'
                                                        } font-rethink`}
                                                >
                                                    {(ev.trigger_intent ?? ev.event_type).replace(/_/g, ' ')}
                                                </p>
                                                <span
                                                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${isCritical
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-amber-500 text-white'
                                                        }`}
                                                >
                                                    {ev.severity}
                                                </span>
                                            </div>
                                            {ev.trigger_message && (
                                                <p className="mt-1 break-words font-mono text-[10.5px] opacity-90">
                                                    {ev.trigger_message.slice(0, 200)}
                                                </p>
                                            )}
                                            <p className="mt-1 text-[10px] opacity-75 font-rethink">
                                                {formatWhen(ev.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>

            <Section
                title="Emergency"
                subtitle="Force logout across every device if you suspect unauthorized access."
            >
                <button
                    type="button"
                    onClick={signOutAll}
                    disabled={actionLoading !== null}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300 font-rethink"
                >
                    {actionLoading === 'sign_out_all' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <LogOut className="h-3.5 w-3.5" />
                    )}
                    Sign out of all devices
                </button>
                <p className="mt-2 text-[10.5px] text-muted font-rethink">
                    Revokes OTP sessions and every active refresh token on your
                    account. You will be returned to the login screen.
                </p>
            </Section>
        </div>
    );
}

function Section({
    title,
    subtitle,
    right,
    children,
}: {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-line bg-paper p-4 dark:border-line/40">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <p className="text-[13px] font-semibold text-ink font-rethink">
                        {title}
                    </p>
                    {subtitle && (
                        <p className="mt-0.5 text-[11px] text-muted font-rethink">
                            {subtitle}
                        </p>
                    )}
                </div>
                {right}
            </div>
            {children}
        </div>
    );
}

function Stat({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone: 'normal' | 'warning' | 'danger';
}) {
    const toneCls =
        tone === 'danger'
            ? 'text-red-600 dark:text-red-400'
            : tone === 'warning'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-ink';
    return (
        <div className="rounded-md border border-line/60 px-2.5 py-1.5 dark:border-line/30">
            <p className="text-[9.5px] uppercase tracking-wider text-muted font-rethink">
                {label}
            </p>
            <p className={`text-[13px] font-semibold font-mono tabular-nums ${toneCls}`}>
                {value}
            </p>
        </div>
    );
}

function MiniCard({
    icon: Icon,
    title,
    value,
    subtitle,
    tone,
}: {
    icon: React.ElementType;
    title: string;
    value: string;
    subtitle: string;
    tone: 'normal' | 'warning' | 'danger';
}) {
    const iconTone =
        tone === 'danger'
            ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40'
            : tone === 'warning'
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
                : 'text-accent bg-accent/10';

    return (
        <div className="rounded-lg border border-line/60 p-3 dark:border-line/30">
            <div className="flex items-start gap-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconTone}`}>
                    <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                    <p className="text-[10.5px] uppercase tracking-wider text-muted font-rethink">
                        {title}
                    </p>
                    <p className="mt-0.5 text-[15px] font-semibold font-mono tabular-nums text-ink">
                        {value}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-muted font-rethink">
                        {subtitle}
                    </p>
                </div>
            </div>
        </div>
    );
}