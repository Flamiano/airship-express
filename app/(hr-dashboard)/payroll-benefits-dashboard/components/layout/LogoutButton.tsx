'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/app/(hr-dashboard)/supabase/client';

export default function LogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleLogout() {
        if (loading) return;
        setLoading(true);
        try {
            await supabase.auth.signOut();
            await fetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
        } finally {
            router.push('/hrAuth');
            router.refresh();
        }
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className="flex w-full items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-60"
        >
            {loading ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            ) : (
                <LogOut size={14} strokeWidth={1.75} />
            )}
            <span>{loading ? 'Logging out…' : 'Log out'}</span>
        </button>
    );
}