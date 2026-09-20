"use client";

import { useState } from "react";
import { MAX_CHECK_IN_MESSAGE_LENGTH } from "@/performance-development-dashboard/lib/constants";

type Props = {
  submitting: boolean;
  replyingTo?: string | null;
  onCancelReply?: () => void;
  onSubmit: (message: string) => Promise<void>;
};

/**
 * Textarea + submit for posting a conversation message. The parent decides
 * whether the post is a top-level comment or a reply by combining the trimmed
 * text with its own `replyTarget`. `replyingTo` is display-only (the author
 * name of the message being replied to).
 */
export function CheckInCommentForm({
  submitting,
  replyingTo,
  onCancelReply,
  onSubmit,
}: Props) {
  const [text, setText] = useState("");

  const trimmed = text.trim();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || submitting) return;

    try {
      await onSubmit(trimmed);
      setText("");
    } catch {
      // Errors are surfaced by the parent (toast / inline); keep the draft.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      {replyingTo ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2 text-[12.5px] text-muted">
          <span>
            Replying to <span className="font-medium text-ink">{replyingTo}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 text-[12px] font-medium text-muted underline underline-offset-2 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_CHECK_IN_MESSAGE_LENGTH}
        rows={3}
        placeholder="Write a comment..."
        className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="tabular-nums text-[11px] text-muted">
          {text.length}/{MAX_CHECK_IN_MESSAGE_LENGTH}
        </span>
        <button
          type="submit"
          disabled={submitting || !trimmed}
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}