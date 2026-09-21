'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Briefcase, Users } from 'lucide-react';
import ByJobPosition from './ByJobPosition';
import ByEmployee from './ByEmployee';

type SettingsTab = 'position' | 'employee';

const STORAGE_KEY = 'job-position-settings:activeTab';
const VALID_TABS: SettingsTab[] = ['position', 'employee'];

const JobPositionSettingsManager = () => {
    const [tab, setTab] = useState<SettingsTab>('position');
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const stored = window.sessionStorage.getItem(STORAGE_KEY) as SettingsTab | null;
            if (stored && VALID_TABS.includes(stored)) {
                setTab(stored);
            }
        } catch {
            // ignore
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        try {
            window.sessionStorage.setItem(STORAGE_KEY, tab);
        } catch {
            // ignore
        }
    }, [tab, hydrated]);

    useEffect(() => {
        return () => {
            try {
                window.sessionStorage.removeItem(STORAGE_KEY);
            } catch {
                // ignore
            }
        };
    }, []);

    const handleTabChange = useCallback((next: SettingsTab) => {
        setTab(next);
    }, []);

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/5 border border-line transition-colors duration-300 dark:bg-ink/10">
                    <Briefcase className="h-4.5 w-4.5 text-muted" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold font-bricolage text-ink">Salary Settings</h1>
                    <p className="mt-0.5 text-sm text-muted font-rethink">
                        Set default rates per position, or override the rate for a specific employee.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-1 border-b border-line">
                <button
                    type="button"
                    onClick={() => handleTabChange('position')}
                    className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors ${tab === 'position'
                            ? 'border-accent text-ink'
                            : 'border-transparent text-muted hover:text-ink'
                        }`}
                >
                    <Briefcase className="h-3.5 w-3.5" />
                    By Job Position
                </button>
                <button
                    type="button"
                    onClick={() => handleTabChange('employee')}
                    className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors ${tab === 'employee'
                            ? 'border-accent text-ink'
                            : 'border-transparent text-muted hover:text-ink'
                        }`}
                >
                    <Users className="h-3.5 w-3.5" />
                    By Employee
                </button>
            </div>

            {tab === 'position' ? <ByJobPosition /> : <ByEmployee />}
        </div>
    );
};

export default JobPositionSettingsManager;