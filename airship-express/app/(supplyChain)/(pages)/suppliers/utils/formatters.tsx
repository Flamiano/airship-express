// helper formatters and status badges for suppliers module

import React from "react";
import { StatusBadge, getPOStatusTone } from "../../../components/ui/StatusBadge";

// status badge renderer for purchase orders
export function getStatusBadge(status: string) {
    return (
        <StatusBadge tone={getPOStatusTone(status)} dot size="xs">
            {status}
        </StatusBadge>
    );
}

// paid badge renderer for purchase orders
export function getPaidBadge(paid: boolean) {
    return paid ? (
        <StatusBadge tone="purple" icon="fas fa-check-circle" size="xs">
            Paid ✓
        </StatusBadge>
    ) : (
        <StatusBadge tone="neutral" icon="fas fa-lock" size="xs">
            Unpaid
        </StatusBadge>
    );
}
