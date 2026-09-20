"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  BadgeListItem,
  EmployeeOption,
  RecognitionInput,
} from "@/performance-development-dashboard/types";
import {
  REWARDS_REASON_CATEGORY_SUGGESTIONS,
  REWARDS_VISIBILITY_SUGGESTIONS,
} from "@/performance-development-dashboard/types";
import {
  REWARDS_MAX_MESSAGE_LENGTH,
  REWARDS_MAX_REASON_CATEGORY_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";

type Props = {
  employees: EmployeeOption[];
  badges: BadgeListItem[];
  submitting: boolean;
  onSubmit: (input: RecognitionInput) => Promise<void>;
  onClose: () => void;
};

export function CreateRecognitionModal({
  employees,
  badges,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [senderId, setSenderId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [reasonCategory, setReasonCategory] = useState("");
  const [points, setPoints] = useState("0");
  const [visibility, setVisibility] = useState("public");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const pointsValue = Number(points.trim() === "" ? "0" : points.trim());
    if (!senderId) {
      setFormError("Select the employee who is giving the recognition.");
      return;
    }
    if (!recipientId) {
      setFormError("Select the employee who is being recognized.");
      return;
    }
    if (senderId === recipientId) {
      setFormError("The sender and recipient cannot be the same employee.");
      return;
    }
    if (!Number.isInteger(pointsValue) || pointsValue < 0) {
      setFormError("Points must be a whole number of 0 or more.");
      return;
    }

    const input: RecognitionInput = {
      sender_id: senderId,
      recipient_id: recipientId,
      message: message.trim() || null,
      badge_id: badgeId || null,
      reason_category: reasonCategory.trim() || null,
      points: pointsValue,
      visibility: visibility.trim() || "public",
    };

    try {
      await onSubmit(input);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="create-recognition-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development · Recognition &amp; Rewards
            </p>
            <h2
              id="create-recognition-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Post a recognition
            </h2>
          </div>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="recognition-sender"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Given by
              </label>
              <select
                id="recognition-sender"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
              >
                <option value="">Select an employee...</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.department ? ` · ${employee.department}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="recognition-recipient"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Recognized employee
              </label>
              <select
                id="recognition-recipient"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
              >
                <option value="">Select an employee...</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.department ? ` · ${employee.department}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="recognition-message"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Message <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="recognition-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={REWARDS_MAX_MESSAGE_LENGTH}
              rows={3}
              placeholder="What did this employee do?"
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {message.length}/{REWARDS_MAX_MESSAGE_LENGTH}
              </span>
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label
                htmlFor="recognition-category"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Reason category{" "}
                <span className="text-muted">(optional)</span>
              </label>
              <input
                id="recognition-category"
                type="text"
                list="recognition-category-suggestions"
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                maxLength={REWARDS_MAX_REASON_CATEGORY_LENGTH}
                placeholder="teamwork"
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
              />
              <datalist id="recognition-category-suggestions">
                {REWARDS_REASON_CATEGORY_SUGGESTIONS.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-muted">
                Accepted values are enforced by the database.
              </p>
            </div>

            <div className="sm:col-span-1">
              <label
                htmlFor="recognition-points"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Points{" "}
                <span className="text-muted">(optional, default 0)</span>
              </label>
              <input
                id="recognition-points"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
              />
              <p className="mt-1 text-[11px] text-muted">
                Recorded on the recognition; no balance changes automatically.
              </p>
            </div>

            <div className="sm:col-span-1">
              <label
                htmlFor="recognition-visibility"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Visibility
              </label>
              <input
                id="recognition-visibility"
                type="text"
                list="recognition-visibility-suggestions"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
              />
              <datalist id="recognition-visibility-suggestions">
                {REWARDS_VISIBILITY_SUGGESTIONS.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label
              htmlFor="recognition-badge"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Badge <span className="text-muted">(optional)</span>
            </label>
            <select
              id="recognition-badge"
              value={badgeId}
              onChange={(e) => setBadgeId(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              <option value="">No badge</option>
              {badges.map((badge) => (
                <option key={badge.id} value={badge.id}>
                  {badge.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              Attaching a badge to the recognition is how a badge is assigned.
            </p>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[12.5px] font-medium text-red-600">
                {formError}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Posting..." : "Post recognition"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}