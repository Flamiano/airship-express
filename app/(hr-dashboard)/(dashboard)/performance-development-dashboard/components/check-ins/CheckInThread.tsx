"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquare, X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { AcknowledgeButton } from "@/performance-development-dashboard/components/check-ins/AcknowledgeButton";
import { CheckInCommentForm } from "@/performance-development-dashboard/components/check-ins/CheckInCommentForm";
import type {
  PerformanceCheckIn,
  PerformanceCheckInMessage,
  PerformanceCheckInThread,
} from "@/performance-development-dashboard/types";
import {
  formatDateTime,
  formatDate,
} from "@/performance-development-dashboard/lib/format/date";

type Props = {
  checkIn: PerformanceCheckIn;
  employeeName: string;
  givenByName: string;
  givenByAccountName: string | null;
  isHrAdmin: boolean;
  thread: PerformanceCheckInThread | null;
  loading: boolean;
  error: string | null;
  posting: boolean;
  acknowledging: boolean;
  canComment: boolean;
  canAcknowledge: boolean;
  onPostMessage: (input: {
    parent_message_id?: string | null;
    message: string;
  }) => Promise<void>;
  onAcknowledge: () => Promise<void>;
  onClose: () => void;
};

function messageDepth(
  message: PerformanceCheckInMessage,
  byId: Map<string, PerformanceCheckInMessage>
): number {
  let depth = 0;
  let current = message;
  while (current.parent_message_id && depth < 2) {
    const parent = byId.get(current.parent_message_id);
    if (!parent) break;
    current = parent;
    depth += 1;
  }
  return depth;
}

/**
 * Private two-way conversation for a single check-in.
 *
 * The root check-in (never editable) is shown at the top with its
 * acknowledgment status, then the conversation messages (comment → reply
 * indentation), and finally the compose form. The acknowledgment is displayed
 * only as a status line — it never appears as a comment. The UI acts as a gate
 * only; the server enforces every authorization decision.
 */
export function CheckInThread({
  checkIn,
  employeeName,
  givenByName,
  givenByAccountName,
  isHrAdmin,
  thread,
  loading,
  error,
  posting,
  acknowledging,
  canComment,
  canAcknowledge,
  onPostMessage,
  onAcknowledge,
  onClose,
}: Props) {
  const [replyTarget, setReplyTarget] =
    useState<PerformanceCheckInMessage | null>(null);

  const messages = thread?.messages ?? [];
  const byId = new Map(messages.map((m) => [m.id, m]));
  const acknowledgment = thread?.acknowledgment ?? null;

  async function handleSubmit(message: string) {
    await onPostMessage({
      parent_message_id: replyTarget?.id ?? null,
      message,
    });
    setReplyTarget(null);
  }

  function authorLine(message: PerformanceCheckInMessage): string {
    const name = message.authorDisplayName ?? "Unknown employee";
    if (
      isHrAdmin &&
      message.authorAccountName &&
      message.authorAccountName !== message.authorDisplayName
    ) {
      return `${name} (${message.authorAccountName})`;
    }
    return name;
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={posting || acknowledging}
      labelledBy="check-in-thread-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="check-in-thread-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Check-in conversation
            </h2>
          </div>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={posting || acknowledging}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>

        {/* Root check-in */}
        <div className="mt-5 rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              Check-in
            </span>
            <span className="text-[12px] font-medium text-muted">
              Employee:{" "}
              <span className="text-ink">{employeeName}</span>
            </span>
            <span className="text-[12px] text-muted">|</span>
            <span className="text-[12px] font-medium text-muted">
              Given by:{" "}
              <span className="text-ink">
                {isHrAdmin && givenByAccountName
                  ? givenByAccountName
                  : givenByName}
              </span>
            </span>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            {formatDateTime(checkIn.created_at)}
          </p>
          <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {checkIn.message}
          </p>
        </div>

        {/* Acknowledgment status */}
        <div className="mt-4 flex items-center justify-between gap-3">
          {acknowledgment ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={15} strokeWidth={2} />
              Acknowledged
              {acknowledgment.acknowledgedByEmployeeName ? (
                <span className="text-muted">
                  by {acknowledgment.acknowledgedByEmployeeName} &middot;{" "}
                  {formatDate(acknowledgment.created_at)}
                </span>
              ) : null}
            </span>
          ) : canAcknowledge ? (
            <AcknowledgeButton
              acknowledged={false}
              acknowledging={acknowledging}
              onAcknowledge={onAcknowledge}
            />
          ) : (
            <span className="text-[12.5px] italic text-muted">
              Not yet acknowledged by the employee.
            </span>
          )}
        </div>

        {/* Conversation */}
        <div className="mt-5">
          <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted">
            <MessageSquare size={13} strokeWidth={1.75} />
            Comments
            <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted dark:bg-paper/10">
              {messages.length}
            </span>
          </h3>

          <div className="mt-3 space-y-3">
            {loading ? (
              <p className="py-4 text-[13px] text-muted">
                Loading conversation...
              </p>
            ) : error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-[12.5px] font-medium text-red-600">{error}</p>
              </div>
            ) : messages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[12.5px] text-muted dark:border-paper/10">
                No comments yet.
              </p>
            ) : (
              messages.map((message) => {
                const depth = messageDepth(message, byId);
                return (
                  <div
                    key={message.id}
                    style={
                      depth > 0
                        ? { marginLeft: `${Math.min(depth, 2) * 24}px` }
                        : undefined
                    }
                    className="rounded-xl border border-line bg-paper px-4 py-3 dark:border-paper/10"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                      <span className="font-semibold text-ink">
                        {authorLine(message)}
                      </span>
                      <span>{formatDateTime(message.created_at)}</span>
                      {depth > 0 && (
                        <span className="inline-flex items-center rounded-full bg-line px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide dark:bg-paper/10">
                          Reply
                        </span>
                      )}
                      {canComment && (
                        <button
                          type="button"
                          onClick={() => setReplyTarget(message)}
                          className="ml-1 text-[12px] font-medium text-accent underline-offset-2 hover:underline"
                        >
                          Reply
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                      {message.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Compose */}
        {canComment && (
          <div className="mt-5 border-t border-line pt-4 dark:border-paper/10">
            <CheckInCommentForm
              submitting={posting}
              replyingTo={replyTarget?.authorDisplayName ?? null}
              onCancelReply={() => setReplyTarget(null)}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}