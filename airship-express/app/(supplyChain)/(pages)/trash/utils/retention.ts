// trash retention policy utilities (10-day automatic purge)

export interface TrashRetentionInfo {
    daysRemaining: number;
    hoursRemaining: number;
    isExpired: boolean;
    isUrgent: boolean;
    label: string;
    badgeClass: string;
    exactExpiryDate: string;
}

export const TRASH_RETENTION_DAYS = 10;

// calculates days remaining until record is permanently deleted
export function getTrashRetentionInfo(deletedAt: string, retentionDays = TRASH_RETENTION_DAYS): TrashRetentionInfo {
    const deletedTime = new Date(deletedAt).getTime();
    if (!deletedAt || isNaN(deletedTime)) {
        return {
            daysRemaining: retentionDays,
            hoursRemaining: retentionDays * 24,
            isExpired: false,
            isUrgent: false,
            label: `${retentionDays} days left`,
            badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
            exactExpiryDate: ''
        };
    }

    const expiryTime = deletedTime + retentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const msRemaining = expiryTime - now;
    const hoursRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60)));
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    const isExpired = msRemaining <= 0;
    const isUrgent = daysRemaining <= 2;

    let label = '';
    let badgeClass = '';

    if (isExpired) {
        label = 'Purging soon';
        badgeClass = 'bg-rose-100/90 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50';
    } else if (daysRemaining === 1) {
        label = hoursRemaining <= 12 ? '< 12h left' : '1 day left';
        badgeClass = 'bg-rose-100/90 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 animate-pulse';
    } else if (daysRemaining === 2) {
        label = '2 days left';
        badgeClass = 'bg-amber-100/90 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
    } else if (daysRemaining <= 5) {
        label = `${daysRemaining} days left`;
        badgeClass = 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/70 dark:border-amber-900/40';
    } else {
        label = `${daysRemaining} days left`;
        badgeClass = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-900/40';
    }

    const exactExpiryDate = new Date(expiryTime).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    return {
        daysRemaining,
        hoursRemaining,
        isExpired,
        isUrgent,
        label,
        badgeClass,
        exactExpiryDate
    };
}
