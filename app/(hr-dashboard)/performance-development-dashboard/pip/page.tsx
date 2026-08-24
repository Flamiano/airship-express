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
  inputClass,
  textareaClass,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/formStyles";
import { useHrAuth } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/hr-auth";
import { readApiError } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/api-error";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";

type PIP = {
  id: string;
  reason: string | null;
  action_plan: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[status] ?? status;
}

function statusVariant(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

export default function PIPPage() {
  const { isAdmin } = useHrAuth();
  const [pips, setPips] = useState<PIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/performance-development-dashboard/api/pip");
        if (!res.ok) throw new Error("Failed to load PIPs");
        const json = await res.json();
        if (cancelled) return;
        setPips(json.pips || []);
      } catch {
        if (!cancelled) setError("Could not load PIPs. Please try again.");
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
      const res = await fetch("/performance-development-dashboard/api/pip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          action_plan: actionPlan,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to create PIP");
      }
      setReason("");
      setActionPlan("");
      refetch();
      toast.success("PIP created successfully.");
    } catch {
      toast.error("Failed to create PIP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch("/performance-development-dashboard/api/pip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to update PIP");
      }
      refetch();
      toast.success("PIP updated successfully.");
    } catch {
      toast.error("Failed to update PIP. Please try again.");
    }
  }

  async function deletePip(id: string) {
    if (!window.confirm("Delete this PIP?")) return;
    try {
      const res = await fetch(`/performance-development-dashboard/api/pip?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to delete PIP");
      }
      refetch();
      toast.success("PIP deleted successfully.");
    } catch {
      toast.error("Failed to delete PIP. Please try again.");
    }
  }

  function formatDate(date: string | null) {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Performance Management"
        title="Performance Improvement Plans"
        subtitle="A structured plan to support an employee in getting back on track."
      />

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 flex max-w-md flex-col gap-3"
        >
          <h2 className="text-lg font-semibold font-bricolage">New PIP</h2>
          <input
            type="text"
            placeholder="Reason"
            aria-label="PIP reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className={inputClass}
          />
          <textarea
            placeholder="Action plan"
            aria-label="Action plan"
            value={actionPlan}
            onChange={(e) => setActionPlan(e.target.value)}
            required
            className={textareaClass}
          />
          <Button type="submit" loading={submitting}>
            {submitting ? "Creating…" : "Create PIP"}
          </Button>
        </form>
      )}

      {error && (
        <p
          className="mb-6 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading && (
        <SkeletonRegion label="Loading improvement plans…">
          <SkeletonCards rows={3} className="max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && pips.length === 0 && (
        <EmptyState
          icon={TrendingUp}
          title="No PIPs yet"
          description="Create a plan above to get started."
        />
      )}

      {!loading && pips.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="shown"
          className="flex max-w-md flex-col gap-4"
        >
          {pips.map((pip) => {
            const start = formatDate(pip.start_date);
            const end = formatDate(pip.end_date);
            return (
              <motion.div key={pip.id} variants={staggerItem}>
                <Card>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold font-bricolage">
                      {pip.reason}
                    </h2>
                    <Badge variant={statusVariant(pip.status)}>
                      {statusLabel(pip.status)}
                    </Badge>
                  </div>
                  <p className="mb-2 text-sm text-muted">{pip.action_plan}</p>
                  <p className="mb-3 text-xs text-muted">
                    {(start || end) && (
                      <>
                        {start && `Started ${start}`}
                        {start && end && " · "}
                        {end && `Due ${end}`}
                      </>
                    )}
                  </p>
                  {isAdmin && pip.status === "active" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => updateStatus(pip.id, "completed")}
                      >
                        Mark Completed
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => updateStatus(pip.id, "failed")}
                      >
                        Mark Failed
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => deletePip(pip.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
