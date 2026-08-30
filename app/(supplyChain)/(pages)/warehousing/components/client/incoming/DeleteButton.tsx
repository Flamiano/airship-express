"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { deleteParcel } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/delete";

interface DeleteButtonProps {
    parcelId: string;
    onDelete?: () => void;
}

export default function DeleteButton({ parcelId, onDelete }: DeleteButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const { confirm } = useConfirm();

    const handleDelete = async () => {
        if (isDeleting) return;

        const confirmed = await confirm({
            title: "Delete Parcel",
            message: "Are you sure you want to delete this parcel? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;

        setIsDeleting(true);
        const toastId = toast.loading('Removing parcel...');

        try {
            const result = await deleteParcel(parseInt(parcelId));

            if (!result.success) {
                toast.error(result.error || 'Failed to remove parcel', {
                    id: toastId,
                    duration: 5000,
                });
                return;
            }

            toast.success('Parcel removed successfully', {
                id: toastId,
                duration: 3000,
            });

            onDelete?.();
        } catch (error) {
            console.error('Error removing parcel:', error);
            toast.error('Failed to remove parcel', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete parcel"
        >
            <i className={`fas ${isDeleting ? 'fa-spinner fa-spin' : 'fa-times'} text-xs`}></i>
        </button>
    );
}