'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, KeyRound } from 'lucide-react';

type ProviderInfo = {
    configured: boolean;
    model: string;
};

export default function ApiKeysPanel() {
    const [loading, setLoading] = useState(true);
    const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    '/payroll-benefits-dashboard/ai/api/health'
                );
                if (!res.ok) throw new Error('Failed to load provider status.');
                const data = await res.json();
                setProviders(data?.providers ?? {});
            } catch {
                setProviders({});
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-14">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-base font-semibold text-ink font-rethink">
                    API Keys
                </h2>
                <p className="mt-1 text-[12px] text-muted font-rethink">
                    Read-only status. Keys are set in the server environment, not
                    here.
                </p>
            </header>

            <div className="space-y-2">
                {Object.entries(providers).map(([name, info]) => (
                    <div
                        key={name}
                        className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper p-4 dark:border-line/40"
                    >
                        <div className="flex items-start gap-3 min-w-0">
                            <KeyRound className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
                            <div className="min-w-0">
                                <p className="text-[13px] font-medium capitalize text-ink font-rethink">
                                    {name}
                                </p>
                                <p className="text-[10.5px] font-mono text-muted truncate">
                                    {info.model || '—'}
                                </p>
                            </div>
                        </div>
                        {info.configured ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-rethink">
                                <CheckCircle2 className="h-3 w-3" />
                                Configured
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700 dark:bg-red-950/40 dark:text-red-400 font-rethink">
                                <XCircle className="h-3 w-3" />
                                Missing
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <p className="text-[11px] text-muted font-rethink">
                To rotate keys, update <code>.env.local</code> on the server and
                restart the app. Never share keys in chat or email.
            </p>
        </div>
    );
}