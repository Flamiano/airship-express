'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../../../supabase/client';

export default function UserMenu() {
  const { profile, role, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      await supabase.auth.signOut();
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      router.push('/hrAuth');
      router.refresh();
    }
  };

  if (loading && !profile) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-line dark:bg-paper/10" />;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-accent/[0.06]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-paper">
          {profile?.avatar_initials ?? 'U'}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-medium leading-tight text-ink">
            {profile?.full_name ?? 'User'}
          </span>
          <span className="block text-[11px] leading-tight text-muted">
            {role ?? 'Staff'}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="hidden text-muted sm:block"
        >
          <ChevronDown size={14} strokeWidth={1.75} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-line bg-paper py-2 shadow-lg dark:border-line"
          >
            <div className="px-3 pb-2 sm:hidden">
              <p className="text-[13px] font-medium text-ink">{profile?.full_name ?? 'User'}</p>
              <p className="text-[11px] text-muted">{role ?? 'Staff'}</p>
            </div>
            {profile?.email && (
              <p className="truncate border-t border-line px-3 py-2 text-[11.5px] text-muted">
                {profile.email}
              </p>
            )}
            <div className="border-t border-line px-3 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-60"
              >
                {loggingOut ? (
                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                ) : (
                  <LogOut size={14} strokeWidth={1.75} />
                )}
                <span>{loggingOut ? 'Logging out…' : 'Log out'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
