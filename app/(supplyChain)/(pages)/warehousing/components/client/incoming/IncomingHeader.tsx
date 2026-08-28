"use client";

import { useState } from "react";
import { toast } from "sonner";
import { receiveAllParcels } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/parcels";
import { user } from "@/app/(supplyChain)/lib/services/Class/user";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";

interface IncomingHeaderProps {
    onReceiveAll?: () => void;
}

export default function IncomingHeader({ onReceiveAll }: IncomingHeaderProps) {
    const [isReceivingAll, setIsReceivingAll] = useState(false);

    const handleReceiveAll = async () => {
        if (isReceivingAll) return;

        setIsReceivingAll(true);
        const toastId = toast.loading('Processing receive all...');

        try {
            const result = await receiveAllParcels();

            if (!result.success) {
                toast.error(result.error || 'Failed to receive parcels', {
                    id: toastId,
                    duration: 5000,
                });
                return;
            }

            if (result.data?.warning) {
                toast.warning(`Received ${result.data.received} parcels with warnings`, {
                    id: toastId,
                    duration: 3000,
                });
            } else {
                toast.success(`Successfully received ${result.data?.received || 0} parcels`, {
                    id: toastId,
                    duration: 3000,
                });
            }

            onReceiveAll?.();
        } catch (error) {
            console.error('Error receiving all:', error);
            toast.error('Failed to receive parcels', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        } finally {
            setIsReceivingAll(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 pb-4 border-b border-slate-200/80 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 ring-1 ring-inset ring-pink-500/10 dark:ring-pink-500/20">
                        <i className="fas fa-arrow-down text-sm" aria-hidden="true" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                        Incoming Receiving
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                    <StatusBadge tone="pink" size="xs">
                        Batch <strong className="font-mono font-bold">#B-2407</strong>
                    </StatusBadge>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">•</span>
                    <span>Warehouse 1</span>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">•</span>
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        Operator: <strong className="font-semibold text-slate-900 dark:text-white">{user.getName()}</strong>
                    </span>
                </div>
            </div>

            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                <AppButton
                    type="button"
                    variant="pink"
                    size="md"
                    onClick={handleReceiveAll}
                    disabled={isReceivingAll}
                    loading={isReceivingAll}
                    className="w-full sm:w-auto min-w-[140px]"
                >
                    <i className="fas fa-check-circle text-xs" />
                    <span>{isReceivingAll ? 'Processing...' : 'Receive All'}</span>
                </AppButton>
            </div>
        </div>
    );
}