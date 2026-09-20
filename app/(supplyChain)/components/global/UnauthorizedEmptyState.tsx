'use client';

import React from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { user } from '@/app/(supplyChain)/lib/services/Class/user';

export const isPrivilegedRole = (role?: string | null): boolean => {
    if (!role) return false;
    const normalized = role.trim().toLowerCase();
    return normalized === 'admin' || normalized === 'manager' || normalized === 'executive';
};

export function useUserRole() {
    const [role, setRole] = React.useState<string>(() => {
        if (typeof window !== 'undefined') return user.getRole() || '';
        return '';
    });
    const [userId, setUserId] = React.useState<string>(() => {
        if (typeof window !== 'undefined') return user.getUserId() || '';
        return '';
    });
    const [userName, setUserName] = React.useState<string>(() => {
        if (typeof window !== 'undefined') return user.getName() || '';
        return '';
    });
    const [userEmail, setUserEmail] = React.useState<string>(() => {
        if (typeof window !== 'undefined') return user.getEmail() || '';
        return '';
    });
    const [isLoaded, setIsLoaded] = React.useState(false);

    React.useEffect(() => {
        const storedRole = user.getRole();
        const storedUserId = user.getUserId() || '';
        const storedName = user.getName() || '';
        const storedEmail = user.getEmail() || '';
        setRole(storedRole);
        setUserId(storedUserId);
        setUserName(storedName);
        setUserEmail(storedEmail);
        setIsLoaded(true);

        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'user_role') {
                setRole(e.newValue || user.getRole());
            }
            if (e.key === 'user_id') {
                setUserId(e.newValue || user.getUserId() || '');
            }
            if (e.key === 'user_name') {
                setUserName(e.newValue || user.getName() || '');
            }
            if (e.key === 'user_email') {
                setUserEmail(e.newValue || user.getEmail() || '');
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return {
        role,
        userId,
        userName,
        userEmail,
        isPrivileged: isPrivilegedRole(role),
        isLoaded,
    };
}

export interface UnauthorizedEmptyStateProps {
    title?: string;
    description?: string;
    currentRole?: string;
    requiredRoles?: string[];
    className?: string;
}

export default function UnauthorizedEmptyState({
    title = "Unauthorized Access",
    description = "You do not have the required permissions to view this content. This section is restricted to authorized personnel only.",
    currentRole,
    requiredRoles = ["Admin", "Manager", "Executive"],
    className = "",
}: UnauthorizedEmptyStateProps) {
    const role = currentRole || user.getRole() || 'User';

    return (
        <div
            className={`w-full p-8 sm:p-14 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] text-center space-y-5 animate-in fade-in duration-300 my-4 select-none ${className}`}
        >
            {/* Neumorphic Recessed Icon Well */}
            <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_3px_3px_6px_rgba(166,175,195,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center">
                <div className="relative">
                    <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-pink-600 dark:text-pink-400" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-60"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                    </span>
                </div>
            </div>

            {/* 401 Recessed Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-1px_-1px_4px_rgba(255,255,255,0.02)] border border-pink-500/20">
                <ShieldAlert className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                <span className="font-mono text-xs font-bold tracking-wider text-pink-600 dark:text-pink-400 uppercase">
                    401 • Unauthorized
                </span>
            </div>

            {/* Heading & Details */}
            <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white font-bricolage tracking-tight">
                    {title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    {description}
                </p>
            </div>

            {/* Current Role & Required Roles Badges */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
                <div className="px-3.5 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] border border-slate-200/50 dark:border-slate-800">
                    <span>Your Current Role: </span>
                    <strong className="text-slate-900 dark:text-white font-semibold">{role}</strong>
                </div>

                <div className="px-3.5 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] border border-slate-200/50 dark:border-slate-800">
                    <span>Allowed Roles: </span>
                    <strong className="text-pink-600 dark:text-pink-400 font-semibold">
                        {requiredRoles.join(', ')}
                    </strong>
                </div>
            </div>
        </div>
    );
}
