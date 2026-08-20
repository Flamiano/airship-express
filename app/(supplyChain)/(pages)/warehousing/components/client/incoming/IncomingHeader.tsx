"use client";

import { useState } from "react";
import { toast } from "sonner";
import { receiveAllParcels } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/parcels";
import { user } from "@/app/(supplyChain)/lib/services/Class/user"

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
        <div className="flex flex-col gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
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
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                        Batch <span className="font-mono font-bold text-slate-900 dark:text-white">#B-2407</span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">•</span>
                    <span>Warehouse 1</span>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">•</span>
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        Operator: <strong className="font-semibold text-slate-900 dark:text-white">{user.getName()}</strong>
                    </span>
                </div>
            </div>

            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                <button
                    type="button"
                    onClick={handleReceiveAll}
                    disabled={isReceivingAll}
                    aria-busy={isReceivingAll}
                    className="group relative inline-flex w-full min-w-[140px] items-center justify-center gap-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs shadow-pink-500/20 transition-all sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                    <i
                        className={`fas ${isReceivingAll
                            ? 'fa-circle-notch fa-spin text-white'
                            : 'fa-check-circle text-pink-100'
                            } text-sm transition-colors duration-200`}
                        aria-hidden="true"
                    />
                    <span className="tracking-wide">
                        {isReceivingAll ? 'Processing...' : 'Receive All'}
                    </span>
                </button>
            </div>
        </div>
    );
}