"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Card from "@/app/(hr-dashboard)/performance-development-dashboard/components/Card";
import Badge from "@/app/(hr-dashboard)/performance-development-dashboard/components/Badge";
import RecognitionForm from "@/app/(hr-dashboard)/performance-development-dashboard/components/RecognitionForm";
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
import { useDirectory } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/directory";
import { HeartHandshake } from "lucide-react";

type Recognition = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string | null;
  reason_category: string | null;
  created_at: string;
  hr3_badges: { name: string } | null;
};

export default function RecognitionPage() {
  const { getDirectoryUser } = useDirectory();
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/performance-development-dashboard/api/recognitions");
        if (!res.ok) throw new Error("Failed to load recognitions");
        const json = await res.json();
        if (cancelled) return;
        setRecognitions(json.recognitions || []);
      } catch {
        if (!cancelled) {
          setError("Could not load recognitions. Please try again.");
        }
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

  return (
    <div>
      <PageHeader
        eyebrow="Social Recognition"
        title="Recognition Wall"
        subtitle="Acknowledge good work across the team — everyone can be recognized, even if they don't log in."
      />

      {error && (
        <p
          className="mb-6 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}

      <RecognitionForm onRecognized={refetch} />

      <h2 className="mb-3 text-lg font-semibold font-bricolage">
        Recognition Wall
      </h2>

      {loading && (
        <SkeletonRegion label="Loading recognitions…">
          <SkeletonCards rows={3} className="max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && recognitions.length === 0 && (
        <EmptyState
          icon={HeartHandshake}
          title="No recognitions yet"
          description="Send the first recognition to a teammate above."
        />
      )}

      {!loading && recognitions.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="shown"
          className="flex max-w-md flex-col gap-3"
        >
          {recognitions.map((r) => {
            const sender = getDirectoryUser(r.sender_id);
            const recipient = getDirectoryUser(r.recipient_id);
            return (
              <motion.div key={r.id} variants={staggerItem}>
                <Card className="border-t-2 border-t-accent">
                  <div className="mb-2 flex items-center justify-between">
                    {r.hr3_badges ? (
                      <Badge variant="success">{r.hr3_badges.name}</Badge>
                    ) : (
                      <span className="text-accent" aria-hidden>
                        <HeartHandshake size={18} />
                      </span>
                    )}
                    {r.reason_category && (
                      <span className="text-xs capitalize text-muted">
                        {r.reason_category.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-sm leading-relaxed">
                    {r.message ?? "Great work!"}
                  </p>
                  <p className="text-xs text-muted">
                    {sender?.name ?? "Someone"}
                    {recipient && ` → ${recipient.name}`}
                    {" · "}
                    {new Date(r.created_at).toLocaleDateString("en-PH", {
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
