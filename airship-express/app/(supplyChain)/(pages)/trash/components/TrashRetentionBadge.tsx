'use client';

import { getTrashRetentionInfo } from '../utils/retention';

// reusable retention badge displaying days left until auto-removal
interface TrashRetentionBadgeProps {
    deletedAt: string;
    className?: string;
}

export function TrashRetentionBadge({ deletedAt, className = '' }: TrashRetentionBadgeProps) {
    const info = getTrashRetentionInfo(deletedAt);

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${info.badgeClass} ${className}`}
            title={`Auto-deletes after 10 days (estimated purge: ${info.exactExpiryDate})`}
        >
            <i className="fa-regular fa-clock text-[9px]" />
            <span>{info.label}</span>
        </span>
    );
}
