"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Card from "@/app/(hr-dashboard)/performance-development-dashboard/components/Card";
import Badge from "@/app/(hr-dashboard)/performance-development-dashboard/components/Badge";
import Button from "@/app/(hr-dashboard)/performance-development-dashboard/components/Button";
import PageHeader from "@/app/(hr-dashboard)/performance-development-dashboard/components/PageHeader";
import EmptyState from "@/app/(hr-dashboard)/performance-development-dashboard/components/EmptyState";
import {
  SkeletonCards,
  SkeletonRegion,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/Skeleton";
import {
  staggerContainer,
  staggerItem,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/motion";
import {
  selectClass,
  textareaClass,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/formStyles";
import { useDirectory } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/directory";
import { readApiError } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/api-error";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";

type FeedbackEntry = {
  id: string;
  given_by: string;
  message: string;
  feedback_type: string;
  created_at: string;
};

const FEEDBACK_TYPES = [
  "check_in",
  "recognition",
  "coaching",
  "improvement",
] as const;

const FEEDBACK_LABELS: Record<string, string> = {
  check_in: "Check-in",
  recognition: "Recognition",
  coaching: "Coaching",
  improvement: "Improvement",
};

function typeVariant(
  type: string
): "success" | "warning" | "danger" | "neutral" {
  if (type === "recognition") return "success";
  if (type === "coaching") return "warning";
  if (type === "improvement") return "danger";
  return "neutral";
}

export default function FeedbackPage() {
  const { getDirectoryUser } = useDirectory();
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState<string>(FEEDBACK_TYPES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/performance-development-dashboard/api/feedback");
        if (!res.ok) throw new Error("Failed to load feedback");
        const json = await res.json();
        if (cancelled) return;
        setEntries(json.feedback || []);
      } catch {
        if (!cancelled) setError("Could not load feedback. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function refetch() {
    setRefreshKey((k) => k + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/performance-development-dashboard/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: feedbackType,
          message,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to post feedback");
      }
      setMessage("");
      refetch();
      toast.success("Feedback submitted successfully.");
    } catch {
      toast.error("Failed to post feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function senderName(id: string) {
    return getDirectoryUser(id)?.name ?? null;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Performance Management"
        title="Continuous Feedback"
        subtitle="Share regular feedback — praise, coaching, or improvement notes — anytime."
      />

      <form
        onSubmit={handleSubmit}
        className="mb-8 flex max-w-md flex-col gap-3"
      >
        <h2 className="text-lg font-semibold font-bricolage">Post Feedback</h2>
        <select
          value={feedbackType}
          onChange={(e) => setFeedbackType(e.target.value)}
          aria-label="Feedback type"
          className={`${selectClass} capitalize`}
        >
          {FEEDBACK_TYPES.map((type) => (
            <option key={type} value={type}>
              {FEEDBACK_LABELS[type]}
            </option>
          ))}
        </select>
        <textarea
          placeholder="Write a note..."
          aria-label="Feedback message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          className={textareaClass}
        />
        <Button type="submit" loading={submitting}>
          {submitting ? "Posting…" : "Post Feedback"}
        </Button>
      </form>

      {error && (
        <p
          className="mb-6 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}

      <h2 className="mb-3 text-lg font-semibold font-bricolage">Recent Notes</h2>

      {loading && (
        <SkeletonRegion label="Loading feedback…">
          <SkeletonCards rows={3} className="max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && entries.length === 0 && (
        <EmptyState
          icon={MessageSquareText}
          title="No feedback yet"
          description="Post a check-in or note above to get started."
        />
      )}

      {!loading && entries.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="shown"
          className="flex max-w-md flex-col gap-3"
        >
          {entries.map((entry) => {
            const sender = senderName(entry.given_by);
            return (
              <motion.div key={entry.id} variants={staggerItem}>
                <Card>
                  <div className="mb-1 flex items-center justify-between">
                    <Badge variant={typeVariant(entry.feedback_type)}>
                      {FEEDBACK_LABELS[entry.feedback_type] ??
                        entry.feedback_type}
                    </Badge>
                    {sender && (
                      <span className="text-xs text-muted">from {sender}</span>
                    )}
                  </div>
                  <p className="text-sm">{entry.message}</p>
                  <p className="mt-2 text-xs text-muted">
                    {new Date(entry.created_at).toLocaleDateString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
