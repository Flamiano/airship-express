'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SignOutButtonProps {
  isExpanded?: boolean;
}

export function SignOutButton({ isExpanded = true }: SignOutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      const [signOutResult] = await Promise.all([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 300)),
      ]);

      if (signOutResult.error) {
        console.error('Error during sign out:', signOutResult.error);
        setIsSigningOut(false);
        return;
      }

      router.push('/fmsAuth');
      router.refresh();
    } catch (err) {
      console.error('Unexpected error during sign out:', err);
      setIsSigningOut(false);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      title={!isExpanded ? (isSigningOut ? 'Signing Out...' : 'Sign Out') : undefined}
      className={`w-full flex items-center rounded-full text-xs font-semibold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        isExpanded ? 'px-3.5 py-2.5 gap-2.5' : 'p-3 justify-center'
      }`}
    >
      {isExpanded ? (
        <>
          <span className="flex-1 text-left whitespace-nowrap">
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </span>
          {isSigningOut ? (
            <Loader2 size={14} className="animate-spin flex-shrink-0" />
          ) : (
            <LogOut size={14} className="flex-shrink-0" />
          )}
        </>
      ) : isSigningOut ? (
        <Loader2 size={18} className="animate-spin flex-shrink-0" />
      ) : (
        <LogOut size={18} className="flex-shrink-0" />
      )}
    </button>
  );
}