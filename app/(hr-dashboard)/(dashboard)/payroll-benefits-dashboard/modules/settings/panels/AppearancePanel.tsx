'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'airy:theme';

export default function AppearancePanel() {
    const [theme, setTheme] = useState<Theme>('system');

    useEffect(() => {
        const stored = (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
        setTheme(stored);
    }, []);

    const apply = (next: Theme) => {
        setTheme(next);
        localStorage.setItem(STORAGE_KEY, next);

        const root = document.documentElement;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldDark = next === 'dark' || (next === 'system' && prefersDark);

        root.classList.toggle('dark', shouldDark);
    };

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-base font-semibold text-ink font-rethink">
                    Appearance
                </h2>
                <p className="mt-1 text-[12px] text-muted font-rethink">
                    Choose how Airship Express looks on your device.
                </p>
            </header>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Choice
                    icon={Sun}
                    label="Light"
                    active={theme === 'light'}
                    onClick={() => apply('light')}
                />
                <Choice
                    icon={Moon}
                    label="Dark"
                    active={theme === 'dark'}
                    onClick={() => apply('dark')}
                />
                <Choice
                    icon={Monitor}
                    label="System"
                    active={theme === 'system'}
                    onClick={() => apply('system')}
                />
            </div>
        </div>
    );
}

function Choice({
    icon: Icon,
    label,
    active,
    onClick,
}: {
    icon: React.ComponentType<{ className?: string; size?: number; title?: string }>;
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${active
                    ? 'border-accent bg-accent/5'
                    : 'border-line bg-paper hover:bg-ink/[0.02] dark:border-line/40'
                }`}
        >
            <Icon className={`h-5 w-5 ${active ? 'text-accent' : 'text-muted'}`} />
            <span
                className={`text-[12.5px] font-medium font-rethink ${active ? 'text-accent' : 'text-ink'
                    }`}
            >
                {label}
            </span>
        </button>
    );
}