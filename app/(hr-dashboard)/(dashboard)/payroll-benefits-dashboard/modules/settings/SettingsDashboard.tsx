'use client';

import { useState } from 'react';
import {
    User,
    Bell,
    Shield,
    Bot,
    Palette,
    Database,
    KeyRound,
    Settings as SettingsIcon,
} from 'lucide-react';
import AccountPanel from './panels/AccountPanel';
import NotificationsPanel from './panels/NotificationsPanel';
import SecurityPanel from './panels/SecurityPanel';
import AiryPanel from './panels/AiryPanel';
import AppearancePanel from './panels/AppearancePanel';
import DataPanel from './panels/DataPanel';
import ApiKeysPanel from './panels/ApiKeysPanel';

type Tab =
    | 'account'
    | 'notifications'
    | 'security'
    | 'airy'
    | 'appearance'
    | 'data'
    | 'api-keys';

const TABS: {
    id: Tab;
    icon: React.ElementType;
    label: string;
    description: string;
}[] = [
        {
            id: 'account',
            icon: User,
            label: 'Account',
            description: 'Profile, name, email, password.',
        },
        {
            id: 'notifications',
            icon: Bell,
            label: 'Notifications',
            description: 'Email alerts and briefings.',
        },
        {
            id: 'security',
            icon: Shield,
            label: 'Security',
            description: 'OTP, session timeout, activity log.',
        },
        {
            id: 'airy',
            icon: Bot,
            label: 'Airy Assistant',
            description: 'AI providers and receipt scanning.',
        },
        {
            id: 'appearance',
            icon: Palette,
            label: 'Appearance',
            description: 'Theme and density.',
        },
        {
            id: 'data',
            icon: Database,
            label: 'Data & Reports',
            description: 'Exports and retention.',
        },
        {
            id: 'api-keys',
            icon: KeyRound,
            label: 'API Keys',
            description: 'Groq, DeepSeek, Gemini.',
        },
    ];

export default function SettingsDashboard() {
    const [active, setActive] = useState<Tab>('account');

    return (
        <div className="flex h-full min-h-0 w-full overflow-hidden bg-paper dark:bg-paper">
            <aside className="hidden w-64 shrink-0 border-r border-line p-4 dark:border-line/40 md:block">
                <div className="mb-6 flex items-center gap-2.5 px-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <SettingsIcon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-ink font-rethink">
                            Settings
                        </p>
                        <p className="text-[10.5px] text-muted font-rethink">
                            Workspace configuration
                        </p>
                    </div>
                </div>

                <nav className="flex flex-col gap-1">
                    {TABS.map(({ id, icon: Icon, label }) => {
                        const isActive = active === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setActive(id)}
                                className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${isActive
                                        ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                                        : 'text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]'
                                    }`}
                            >
                                <Icon
                                    className="h-4 w-4"
                                    strokeWidth={1.9}
                                />
                                {label}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            <main className="flex-1 min-w-0 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mb-6 md:hidden">
                        <select
                            value={active}
                            onChange={(e) => setActive(e.target.value as Tab)}
                            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink font-rethink dark:border-line/40"
                        >
                            {TABS.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {active === 'account' && <AccountPanel />}
                    {active === 'notifications' && <NotificationsPanel />}
                    {active === 'security' && <SecurityPanel />}
                    {active === 'airy' && <AiryPanel />}
                    {active === 'appearance' && <AppearancePanel />}
                    {active === 'data' && <DataPanel />}
                    {active === 'api-keys' && <ApiKeysPanel />}
                </div>
            </main>
        </div>
    );
}