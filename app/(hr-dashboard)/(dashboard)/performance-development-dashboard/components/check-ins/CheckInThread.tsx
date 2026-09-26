"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Target,
  X,
} from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceDialogPanel,
  PerformanceSectionHeader,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";
import { AcknowledgeButton } from "@/performance-development-dashboard/components/check-ins/AcknowledgeButton";
import { CheckInCommentForm } from "@/performance-development-dashboard/components/check-ins/CheckInCommentForm";
import type {
  PerformanceCheckIn,
  PerformanceCheckInMessage,
  PerformanceCheckInThread,
  PerformanceGoalEvidenceItem,
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

const MAX_REPLY_DEPTH = 2;

function messageDepth(
  message: PerformanceCheckInMessage,
  byId: Map<string, PerformanceCheckInMessage>
): number {
  let depth = 0;
  let current = message;
  while (current.parent_message_id && depth < MAX_REPLY_DEPTH) {
    const parent = byId.get(current.parent_message_id);
    if (!parent) break;
    current = parent;
    depth += 1;
  }
  return depth;
}

/**
 * Goal-evidence context for one evidence row linked to the open check-in.
 *
 * Images render a thumbnail that opens the viewer; PDFs (and any other
 * attachment without a previewable signed URL) render the filename with a
 * "View Evidence" action over the authorized signed URL. Rows without an
 * attachment show goal + progress only.
 */
function EvidenceSection({
  item,
  onViewImage,
}: {
  item: PerformanceGoalEvidenceItem;
  onViewImage: (url: string, name: string) => void;
}) {
  const isImage = (item.attachment_mime ?? "").startsWith("image/");
  const fileName = item.attachment_name ?? "Attachment";

  return (
    <div className="rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        <Target size={13} strokeWidth={1.75} />
        Goal
      </p>
      <p className="mt-1 text-[14px] font-medium text-ink">
        {item.goal_title ?? "Goal"}
      </p>

      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        Progress snapshot
      </p>
      <p className="mt-1 text-[13px] font-semibold tabular-nums text-ink">
        {item.progress_percent}%
      </p>

      {item.attachment_name && (
        <>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Evidence
          </p>
          {isImage && item.fileUrl ? (
            <button
              type="button"
              onClick={() =>
                item.fileUrl && onViewImage(item.fileUrl, fileName)
              }
              className="mt-2 block overflow-hidden rounded-xl border border-line transition-colors hover:border-accent/40 dark:border-paper/15"
              aria-label={`Open ${fileName} preview`}
            >
              {/* Remote signed URL: next/image cannot optimize short-lived
                  Storage URLs (no remotePatterns configured). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.fileUrl}
                alt={fileName}
                className="max-h-48 w-auto object-cover"
              />
            </button>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 dark:border-paper/15">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-muted dark:border-paper/15">
                <FileText size={16} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {fileName}
              </span>
              {item.fileUrl && (
                <a
                  href={item.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
                >
                  <ExternalLink size={13} strokeWidth={1.75} />
                  View Evidence
                </a>
              )}
            </div>
          )}
          {(!isImage || !item.fileUrl) && (
            <p className="mt-1.5 text-[12px] text-muted">{fileName}</p>
          )}
        </>
      )}
    </div>
  );
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
  const [viewer, setViewer] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const messages = thread?.messages ?? [];
  const byId = new Map(messages.map((m) => [m.id, m]));
  const acknowledgment = thread?.acknowledgment ?? null;
  const evidence = thread?.evidence ?? [];
  const linkedEvidence = evidence.length > 0 ? evidence : null;
  const latestEvidence = linkedEvidence
    ? linkedEvidence[linkedEvidence.length - 1]
    : null;

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
    <>
    <Modal
      onClose={onClose}
      closeDisabled={posting || acknowledging}
      labelledBy="check-in-thread-title"
    >
      <PerformanceDialogPanel labelledBy="check-in-thread-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              {employeeName}
            </p>
            <h2
              id="check-in-thread-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Check-in
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {linkedEvidence ? (
              <PerformanceStatusBadge tone="bg-accent/10 text-accent">
                Goal-linked
              </PerformanceStatusBadge>
            ) : (
              <PerformanceStatusBadge tone="bg-line text-muted">
                General
              </PerformanceStatusBadge>
            )}
            <Tooltip label="Close" side="bottom">
              <button
                type="button"
                onClick={onClose}
                disabled={posting || acknowledging}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </Tooltip>
          </div>
        </div>

        <p className="mt-1.5 text-[12.5px] text-muted">
          {formatDateTime(checkIn.created_at)}
          {" · By "}
          <span className="font-medium text-ink">
            {isHrAdmin && givenByAccountName ? givenByAccountName : givenByName}
          </span>
        </p>

        {/* Linked goal + historical progress snapshot. The snapshot belongs
            to this check-in — it is not the goal's current progress. */}
        {latestEvidence ? (
          <div className="mt-4 rounded-xl border border-line bg-ink/[0.02] px-4 py-3 dark:border-paper/10 dark:bg-paper/[0.04]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Goal
            </p>
            <p className="mt-0.5 truncate text-[13.5px] font-medium text-ink">
              {latestEvidence.goal_title ?? "Goal"}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              Progress snapshot{" "}
              <span className="font-semibold tabular-nums text-ink">
                {latestEvidence.progress_percent}%
              </span>{" "}
              · recorded with this check-in
            </p>
          </div>
        ) : null}

        {/* Root check-in update */}
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Update
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {checkIn.message}
          </p>
        </div>

        {/* Goal evidence linked to this check-in. Absent for general
            check-ins, which render exactly as before. */}
        {evidence.length > 0 ? (
          <div className="mt-5 border-t border-line pt-5 dark:border-paper/10">
            <PerformanceSectionHeader
              eyebrow="Evidence"
              title="Attachments"
            />
            <div className="mt-3 space-y-3">
              {evidence.map((item) => (
                <EvidenceSection
                  key={item.id}
                  item={item}
                  onViewImage={(url, name) => setViewer({ url, name })}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Acknowledgment status */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 dark:border-paper/10">
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
        <div className="mt-5 border-t border-line pt-5 dark:border-paper/10">
          <PerformanceSectionHeader
            eyebrow="Conversation"
            title="Comments"
            action={
              <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted dark:bg-paper/10">
                {messages.length}
              </span>
            }
          />

          <div className="mt-3 space-y-3">
            {loading ? (
              <p role="status" className="py-4 text-[13px] text-muted">
                Loading conversation...
              </p>
            ) : error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
              >
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
                        ? { marginLeft: `${Math.min(depth, MAX_REPLY_DEPTH) * 24}px` }
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
                          aria-label={`Reply to ${authorLine(message)}`}
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
          <div className="mt-5 border-t border-line pt-5 dark:border-paper/10">
            <CheckInCommentForm
              submitting={posting}
              replyingTo={replyTarget?.authorDisplayName ?? null}
              onCancelReply={() => setReplyTarget(null)}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </PerformanceDialogPanel>
    </Modal>

    {/* Evidence lightbox: sibling of the conversation modal (not nested) so
        Escape/backdrop only dismiss the viewer, never the conversation. */}
    {viewer && (
      <Modal onClose={() => setViewer(null)} labelledBy="evidence-viewer-title">
        <PerformanceDialogPanel size="lg" labelledBy="evidence-viewer-title">
          <div className="flex items-start justify-between gap-4">
            <h2
              id="evidence-viewer-title"
              className="mt-1 max-w-full truncate font-bricolage text-[18px] font-medium tracking-tight text-ink"
            >
              {viewer.name}
            </h2>
            <Tooltip label="Close" side="bottom">
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </Tooltip>
          </div>
          {/* Remote signed URL: next/image cannot optimize short-lived Storage
              URLs (no remotePatterns configured), so a plain img is used. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewer.url}
            alt={viewer.name}
            className="mt-4 max-h-[70vh] w-full rounded-xl border border-line object-contain dark:border-paper/15"
          />
        </PerformanceDialogPanel>
      </Modal>
    )}
    </>
  );
}