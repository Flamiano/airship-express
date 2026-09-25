"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceStatusBadge,
  PerformanceTextarea,
} from "@/performance-development-dashboard/components/ui/performance";
import { MAX_FEEDBACK_RESPONSE_MESSAGE_LENGTH } from "@/performance-development-dashboard/lib/constants";
import { formatDate } from "@/performance-development-dashboard/lib/format/date";
import type { FeedbackRequestListItem } from "@/performance-development-dashboard/types";
import { FEEDBACK_REQUEST_STATUS_LABELS } from "@/performance-development-dashboard/types";
import { FEEDBACK_STATUS_TONES } from "@/performance-development-dashboard/components/feedback/FeedbackCard";

type Props = {
  request: FeedbackRequestListItem;
  /** True only when the viewer is the recipient and the request is pending. */
  canRespond: boolean;
  submitting: boolean;
  onRespond: (decision: "fulfilled" | "declined", message: string | null) => Promise<void>;
  onClose: () => void;
};

/**
 * Request detail dialog. Read-only for requesters and terminal requests;
 * the addressed recipient of a pending request gets the response form
 * (fulfill with required feedback, or decline). The API authorizes every
 * action — this dialog only reflects the `canRespond` affordance.
 */
export function FeedbackDetailDialog({
  request,
  canRespond,
  submitting,
  onRespond,
  onClose,
}: Props) {
  const [response, setResponse] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const statusLabel =
    FEEDBACK_REQUEST_STATUS_LABELS[request.status] ?? request.status;
  const tone = FEEDBACK_STATUS_TONES[request.status] ?? "bg-line text-muted";

  async function handleDecision(decision: "fulfilled" | "declined") {
    setFormError(null);
    const trimmed = response.trim();
    if (decision === "fulfilled" && !trimmed) {
      setFormError("Write your feedback before submitting.");
      return;
    }
    try {
      await onRespond(decision, trimmed || null);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save the response."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="feedback-detail-dialog-title"
    >
      <PerformanceDialogPanel labelledBy="feedback-detail-dialog-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Feedback request
            </p>
            <h2
              id="feedback-detail-dialog-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {request.requesterName} → {request.recipientName}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PerformanceStatusBadge tone={tone}>
              {statusLabel}
            </PerformanceStatusBadge>
            <Tooltip label="Close" side="bottom">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </Tooltip>
          </div>
        </div>

        <dl className="mt-6 space-y-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Requester
            </dt>
            <dd className="mt-1 text-[13.5px] font-medium text-ink">
              {request.requesterName}
              {request.requesterNumber ? (
                <span className="ml-1.5 font-normal text-muted">
                  · {request.requesterNumber}
                </span>
              ) : null}
            </dd>
          </div>
          {request.request_message ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Request
              </dt>
              <dd className="mt-1 border-l-2 border-line pl-3 text-[13.5px] leading-relaxed text-ink dark:border-paper/15">
                &ldquo;{request.request_message}&rdquo;
              </dd>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-muted">
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
          {request.response_message ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Response
              </dt>
              <dd className="mt-1 rounded-xl bg-ink/[0.03] px-4 py-3 text-[13.5px] leading-relaxed text-ink dark:bg-paper/[0.04]">
                &ldquo;{request.response_message}&rdquo;
              </dd>
            </div>
          ) : null}
        </dl>

        {canRespond ? (
          <div className="mt-6 border-t border-line pt-5 dark:border-paper/10">
            <PerformanceField
              label="Your response"
              htmlFor="feedback-response"
              hint="Be specific and constructive. Submitting records your feedback and closes the request."
            >
              <PerformanceTextarea
                id="feedback-response"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                maxLength={MAX_FEEDBACK_RESPONSE_MESSAGE_LENGTH}
                rows={5}
                placeholder="Write your feedback..."
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {response.length}/{MAX_FEEDBACK_RESPONSE_MESSAGE_LENGTH}
            </p>

            {formError && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
              >
                <p className="text-[12.5px] font-medium text-red-600">
                  {formError}
                </p>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <PerformanceButton
                variant="ghost"
                onClick={() => handleDecision("declined")}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Decline"}
              </PerformanceButton>
              <PerformanceButton
                onClick={() => handleDecision("fulfilled")}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Submit Feedback"}
              </PerformanceButton>
            </div>
          </div>
        ) : (
          formError && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
            >
              <p className="text-[12.5px] font-medium text-red-600">
                {formError}
              </p>
            </div>
          )
        )}
      </PerformanceDialogPanel>
    </Modal>
  );
}
