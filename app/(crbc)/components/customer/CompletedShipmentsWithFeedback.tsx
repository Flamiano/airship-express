"use client";

import { useState, useTransition } from "react";
import { Star, CheckCircle2, MessageSquare, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { submitFeedback } from "../../actions/feedback";
import type { FeedbackShipment, Feedback } from "../../types/feedback";
import { StatusPill } from "./PortalUI";

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-colors ${readonly ? "cursor-default" : "cursor-pointer"}`}
          aria-label={`${n} star`}
        >
          <Star
            size={readonly ? 14 : 20}
            className={
              n <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-foreground/20"
            }
          />
        </button>
      ))}
    </div>
  );
}

function FeedbackForm({
  shipment,
  onSuccess,
}: {
  shipment: FeedbackShipment;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitFeedback({
        shipmentId: shipment.shipment_id,
        rating,
        comment,
      });
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error ?? "Failed to submit feedback.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 pl-4 border-l-2 border-accent/30">
      <div>
        <p className="text-xs text-muted mb-1.5">How was your delivery experience?</p>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a comment (optional)…"
        rows={3}
        maxLength={500}
        className="w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50 placeholder:text-foreground/30 resize-none"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {isPending && <Loader2 size={13} className="animate-spin" />}
          Submit Feedback
        </button>
      </div>
    </form>
  );
}

function SubmittedBadge({ feedback }: { feedback: Feedback }) {
  return (
    <div className="mt-3 pl-4 border-l-2 border-emerald-400/40 space-y-1">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Feedback submitted</span>
        <StarRating value={feedback.rating} readonly />
      </div>
      {feedback.comment && (
        <p className="text-xs text-muted italic">&ldquo;{feedback.comment}&rdquo;</p>
      )}
    </div>
  );
}

interface Props {
  shipments: FeedbackShipment[];
  submittedIds: string[];
  existingFeedback: Feedback[];
}

export function CompletedShipmentsWithFeedback({ shipments, submittedIds, existingFeedback }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localSubmitted, setLocalSubmitted] = useState<Set<string>>(
    new Set(submittedIds)
  );

  function shortDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (shipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 size={16} className="text-muted mb-3" />
        <h3 className="text-sm font-medium text-foreground">No completed shipments yet</h3>
        <p className="mt-1 text-sm text-muted">
          Once a parcel is delivered, it appears here with its full tracking history.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {shipments.map((s) => {
        const isSubmitted = localSubmitted.has(s.shipment_id);
        const isExpanded = expandedId === s.shipment_id;
        const fb = existingFeedback.find((f) => f.shipment_id === s.shipment_id);

        return (
          <li key={s.shipment_id} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-accent">{s.tracking_number}</span>
                  <StatusPill status="Delivered" />
                  {isSubmitted && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <CheckCircle2 size={9} /> Reviewed
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  Delivered {shortDate(s.delivered_at)} · {s.origin} → {s.destination}
                </p>
              </div>

              <button
                onClick={() => setExpandedId(isExpanded ? null : s.shipment_id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground bg-background border border-line rounded-lg hover:bg-line/50 transition-colors"
              >
                <MessageSquare size={13} />
                {isSubmitted ? "View Feedback" : "Leave Feedback"}
                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {isExpanded && (
              <div className="mt-3">
                {isSubmitted && fb ? (
                  <SubmittedBadge feedback={fb} />
                ) : isSubmitted ? (
                  <div className="pl-4 border-l-2 border-emerald-400/40">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Feedback submitted successfully. Thank you!
                    </p>
                  </div>
                ) : (
                  <FeedbackForm
                    shipment={s}
                    onSuccess={() => {
                      setLocalSubmitted((prev) => new Set(prev).add(s.shipment_id));
                      setExpandedId(null);
                    }}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
