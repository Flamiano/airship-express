"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { cancelBookingRequest } from "../../actions/booking-request";

export default function CancelBookingButton({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    if (!confirm("Cancel this shipment request? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelBookingRequest(requestId);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleCancel}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:border-red-300 hover:text-red-600 dark:hover:border-red-800 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
        Cancel
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
