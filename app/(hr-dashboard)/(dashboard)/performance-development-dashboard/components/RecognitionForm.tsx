"use client";

import { useEffect, useState } from "react";
import Button from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/Button";
import {
  selectClass,
  textareaClass,
  errorTextClass,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/formStyles";
import { useDirectory } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/directory";
import { useHrAuth } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/hr-auth";
import {
  ApiError,
  readApiError,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/api-error";
import { toast } from "sonner";

type Badge = {
  id: string;
  name: string;
};

const REASON_CATEGORIES = [
  "teamwork",
  "innovation",
  "customer_service",
  "leadership",
  "ownership",
];

type RecognitionFormProps = {
  onRecognized: () => void;
};

export default function RecognitionForm({ onRecognized }: RecognitionFormProps) {
  const { user } = useHrAuth();
  const { directory } = useDirectory();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [message, setMessage] = useState("");
  const [reasonCategory, setReasonCategory] = useState(REASON_CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const recipients = directory.filter((u) => u.id !== user?.employeeId);

  useEffect(() => {
    let cancelled = false;

    async function loadBadges() {
      try {
        const res = await fetch("/performance-development-dashboard/api/badges");
        if (!res.ok) throw new Error("Failed to load badges");
        const json = await res.json();
        if (cancelled) return;
        setBadges(json.badges || []);
      } catch {
        if (!cancelled) setError("Could not load badges. Please try again.");
      }
    }

    loadBadges();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientId || !badgeId) {
      toast.error("Choose a recipient and a badge.");
      return;
    }
    setSubmitting(true);
    setFieldErrors({});

    try {
      const res = await fetch("/performance-development-dashboard/api/recognitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: recipientId,
          badge_id: badgeId,
          message,
          reason_category: reasonCategory,
        }),
      });

      if (!res.ok) {
        throw await readApiError(res, "Failed to send recognition");
      }

      setRecipientId("");
      setBadgeId("");
      setMessage("");
      onRecognized();
      toast.success("Recognition sent successfully.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(
          Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message]))
        );
        toast.error(
          err.fieldErrors.length > 0
            ? "Failed to send recognition. Please check the form and try again."
            : "Failed to send recognition. Please try again."
        );
      } else {
        toast.error("Failed to send recognition. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 flex max-w-md flex-col gap-3"
    >
      <h2 className="text-lg font-semibold font-bricolage">Give Recognition</h2>

      <select
        value={recipientId}
        onChange={(e) => setRecipientId(e.target.value)}
        required
        aria-label="Select recipient"
        className={selectClass}
      >
        <option value="" disabled>
          Select recipient
        </option>
        {recipients.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {u.jobTitle}
          </option>
        ))}
      </select>
      {fieldErrors.recipient_id && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.recipient_id}
        </p>
      )}

      <select
        value={badgeId}
        onChange={(e) => setBadgeId(e.target.value)}
        required
        aria-label="Select badge"
        className={selectClass}
      >
        <option value="" disabled>
          Select badge
        </option>
        {badges.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {fieldErrors.badge_id && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.badge_id}
        </p>
      )}

      <textarea
        placeholder="Message (e.g. Thanks for going above and beyond!)"
        aria-label="Recognition message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className={textareaClass}
      />
      {fieldErrors.message && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.message}
        </p>
      )}

      <select
        value={reasonCategory}
        onChange={(e) => setReasonCategory(e.target.value)}
        aria-label="Reason category"
        className={`${selectClass} capitalize`}
      >
        {REASON_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category.replace("_", " ")}
          </option>
        ))}
      </select>
      {fieldErrors.reason_category && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.reason_category}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" loading={submitting}>
        {submitting ? "Sending…" : "Send Recognition"}
      </Button>
    </form>
  );
}
