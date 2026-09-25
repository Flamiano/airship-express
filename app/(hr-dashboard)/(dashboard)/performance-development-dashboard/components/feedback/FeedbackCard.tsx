"use client";

import { ArrowRight, MessageSquareText } from "lucide-react";
import type { FeedbackRequestListItem } from "@/performance-development-dashboard/types";
import { FEEDBACK_REQUEST_STATUS_LABELS } from "@/performance-development-dashboard/types";
import { formatDate } from "@/performance-development-dashboard/lib/format/date";
import {
  PerformancePanel,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";

export const FEEDBACK_STATUS_TONES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  fulfilled: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  declined: "bg-red-500/10 text-red-600 dark:text-red-400",
};

type FeedbackCardProps = {
  request: FeedbackRequestListItem;
  /** "received" (requested by me) or "given" (requested of me) or "all" (HR org view). */
  direction: "received" | "given" | "all";
  primaryActionLabel?: string;
  onPrimaryAction: () => void;
};

/**
 * One feedback request card. Content shown depends on direction: the HR
 * organization view intentionally omits message content from summary cards
 * (full content is visible in the detail dialog, which the API authorizes).
 */
export function FeedbackCard({
  request,
  direction,
  primaryActionLabel,
  onPrimaryAction,
}: FeedbackCardProps) {
  const statusLabel =
    FEEDBACK_REQUEST_STATUS_LABELS[request.status] ?? request.status;
  const tone = FEEDBACK_STATUS_TONES[request.status] ?? "bg-line text-muted";

  const title =
    direction === "received"
      ? request.recipientName
      : direction === "given"
        ? request.requesterName
        : `${request.requesterName} → ${request.recipientName}`;

  const eyebrow =
    direction === "received"
      ? "Feedback from"
      : direction === "given"
        ? "Feedback for"
        : "Feedback request";

  const subheading =
    direction === "received"
      ? request.recipientNumber || undefined
      : direction === "given"
        ? request.requesterNumber || undefined
        : undefined;

  return (
    <PerformancePanel>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {eyebrow}
          </p>
          <p className="mt-1 truncate font-bricolage text-[17px] font-medium tracking-tight text-ink">
            {title}
          </p>
          {subheading ? (
            <p className="mt-0.5 truncate text-[12px] text-muted">{subheading}</p>
          ) : null}
        </div>
        <PerformanceStatusBadge tone={tone} className="shrink-0">
          {statusLabel}
        </PerformanceStatusBadge>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
        <span>
          Requested{" "}
          <span className="font-medium text-ink">
            {formatDate(request.requested_at)}
          </span>
        </span>
        {request.responded_at ? (
          <span>
            Responded{" "}
            <span className="font-medium text-ink">
              {formatDate(request.responded_at)}
            </span>
          </span>
        ) : null}
      </div>

      {direction !== "all" && request.request_message ? (
        <p className="mt-3 border-l-2 border-line pl-3 text-[13px] leading-relaxed text-ink dark:border-paper/15">
          &ldquo;{request.request_message}&rdquo;
        </p>
      ) : null}

      {direction !== "all" &&
      request.status === "fulfilled" &&
      request.response_message ? (
        <div className="mt-3 rounded-xl bg-ink/[0.03] px-4 py-3 dark:bg-paper/[0.04]">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            <MessageSquareText size={13} strokeWidth={1.75} />
            Response
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
            &ldquo;{request.response_message}&rdquo;
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={onPrimaryAction}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            request.status === "pending" && direction === "given"
              ? "bg-accent text-paper hover:bg-accent-dark"
              : "border border-line text-muted hover:text-ink dark:border-paper/15"
          }`}
        >
          {primaryActionLabel ??
            (request.status === "pending" && direction === "given"
              ? "Provide Feedback"
              : "View request")}
          <ArrowRight size={14} strokeWidth={1.75} />
        </button>
      </div>
    </PerformancePanel>
  );
}
