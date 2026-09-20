"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Award, BadgeCheck, Gift, RefreshCw, Trophy, Wallet } from "lucide-react";
import { SkeletonPanel } from "@/performance-development-dashboard/components/ui/Skeleton";
import type {
  BadgeInput,
  BadgeListItem,
  CurrentPerDevUser,
  EmployeeOption,
  EmployeePointsListItem,
  RecognitionInput,
  RecognitionListItem,
  RedemptionInput,
  RedemptionListItem,
  SetPointsInput,
  UpdateBadgeInput,
  UpdateRedemptionInput,
} from "@/performance-development-dashboard/types";
import { useRewardsApi } from "@/performance-development-dashboard/hooks/useRewardsApi";
import { RecognitionsTab } from "@/performance-development-dashboard/components/rewards/RecognitionsTab";
import { BadgesTab } from "@/performance-development-dashboard/components/rewards/BadgesTab";
import { PointsTab } from "@/performance-development-dashboard/components/rewards/PointsTab";
import { RedemptionsTab } from "@/performance-development-dashboard/components/rewards/RedemptionsTab";
import { CreateRecognitionModal } from "@/performance-development-dashboard/components/rewards/CreateRecognitionModal";
import { BadgeModal } from "@/performance-development-dashboard/components/rewards/BadgeModal";
import { PointsModal } from "@/performance-development-dashboard/components/rewards/PointsModal";
import { RedemptionModal } from "@/performance-development-dashboard/components/rewards/RedemptionModal";
import { ProcessRedemptionModal } from "@/performance-development-dashboard/components/rewards/ProcessRedemptionModal";

type Props = {
  serverUser: CurrentPerDevUser;
  initialRecognitions: RecognitionListItem[];
  initialBadges: BadgeListItem[];
  initialPoints: EmployeePointsListItem[];
  initialRedemptions: RedemptionListItem[];
  initialError?: string;
  employees: EmployeeOption[];
};

type TabKey = "recognitions" | "badges" | "points" | "redemptions";

const TABS: { key: TabKey; label: string; icon: typeof Award }[] = [
  { key: "recognitions", label: "Recognitions", icon: Trophy },
  { key: "badges", label: "Badges", icon: BadgeCheck },
  { key: "points", label: "Points", icon: Wallet },
  { key: "redemptions", label: "Redemptions", icon: Gift },
];

export function RecognitionRewards({
  serverUser,
  initialRecognitions,
  initialBadges,
  initialPoints,
  initialRedemptions,
  initialError,
  employees,
}: Props) {
  const api = useRewardsApi();

  const [recognitions, setRecognitions] = useState<RecognitionListItem[]>(
    initialRecognitions
  );
  const [badges, setBadges] = useState<BadgeListItem[]>(initialBadges);
  const [points, setPoints] = useState<EmployeePointsListItem[]>(initialPoints);
  const [redemptions, setRedemptions] = useState<RedemptionListItem[]>(
    initialRedemptions
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("recognitions");

  const [recognitionOpen, setRecognitionOpen] = useState(false);
  const [badgeModal, setBadgeModal] = useState<{
    open: boolean;
    editing: BadgeListItem | null;
  }>({ open: false, editing: null });
  const [pointsModal, setPointsModal] = useState<{
    open: boolean;
    editing: EmployeePointsListItem | null;
  }>({ open: false, editing: null });
  const [redemptionOpen, setRedemptionOpen] = useState(false);
  const [processRedemption, setProcessRedemption] = useState<{
    open: boolean;
    redemption: RedemptionListItem | null;
  }>({ open: false, redemption: null });

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  async function refreshAll() {
    setRefreshing(true);
    try {
      const [nextRecognitions, nextBadges, nextPoints, nextRedemptions] =
        await Promise.all([
          api.listRecognitions(),
          api.listBadges(),
          api.listEmployeePoints(),
          api.listRedemptions(),
        ]);
      setRecognitions(nextRecognitions);
      setBadges(nextBadges);
      setPoints(nextPoints);
      setRedemptions(nextRedemptions);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh rewards data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshRecognitions() {
    try {
      setRecognitions(await api.listRecognitions());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh rewards data."
      );
    }
  }

  async function refreshBadges() {
    try {
      setBadges(await api.listBadges());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh rewards data."
      );
    }
  }

  async function refreshPoints() {
    try {
      setPoints(await api.listEmployeePoints());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh rewards data."
      );
    }
  }

  async function refreshRedemptions() {
    try {
      setRedemptions(await api.listRedemptions());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh rewards data."
      );
    }
  }

  async function handleCreateRecognition(input: RecognitionInput) {
    setRefreshing(true);
    try {
      await api.runCreateRecognition(input);
      setRecognitionOpen(false);
      await refreshRecognitions();
      toast.success("Recognition posted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post recognition.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateBadge(input: BadgeInput) {
    setRefreshing(true);
    try {
      await api.runCreateBadge(input);
      setBadgeModal({ open: false, editing: null });
      await refreshBadges();
      toast.success("Badge added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add badge.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleUpdateBadge(id: string, input: UpdateBadgeInput) {
    setRefreshing(true);
    try {
      await api.runUpdateBadge(id, input);
      setBadgeModal({ open: false, editing: null });
      await refreshBadges();
      toast.success("Badge updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update badge.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDeleteBadge(badge: BadgeListItem) {
    setRefreshing(true);
    try {
      await api.runDeleteBadge(badge.id);
      await refreshBadges();
      toast.success("Badge removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete badge.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSetPoints(input: SetPointsInput) {
    setRefreshing(true);
    try {
      await api.runSetEmployeePoints(input);
      setPointsModal({ open: false, editing: null });
      await refreshPoints();
      toast.success("Point balance updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update balance.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateRedemption(input: RedemptionInput) {
    setRefreshing(true);
    try {
      await api.runCreateRedemption(input);
      setRedemptionOpen(false);
      await refreshRedemptions();
      toast.success("Redemption logged.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log redemption.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleProcessRedemption(
    id: string,
    input: UpdateRedemptionInput
  ) {
    setRefreshing(true);
    try {
      await api.runUpdateRedemption(id, input);
      setProcessRedemption({ open: false, redemption: null });
      await refreshRedemptions();
      toast.success("Redemption updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update redemption.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
            Recognition &amp; Rewards
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted">
            {`Hello ${firstName}. Record recognitions, badge definitions, point
            balances, and reward redemptions. Balances are managed here
            deliberately — a posted recognition or redemption never changes a
            balance automatically.`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1 dark:border-paper/10">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-accent text-paper shadow-sm shadow-accent/25"
                  : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]"
              }`}
            >
              <tab.icon size={14} strokeWidth={1.75} />
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
            <p className="text-[13px] font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={refreshAll}
              className="text-[12.5px] font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {refreshing && activeTab !== "recognitions" && recognitions.length === 0 ? (
          <div aria-busy="true" role="status">
            <SkeletonPanel lines={7} />
          </div>
        ) : (
          <>
            {activeTab === "recognitions" && (
              <RecognitionsTab
                recognitions={recognitions}
                refreshing={refreshing}
                onOpenCreate={() => setRecognitionOpen(true)}
              />
            )}

            {activeTab === "badges" && (
              <BadgesTab
                badges={badges}
                refreshing={refreshing}
                busy={api.busy}
                onOpenCreate={() => setBadgeModal({ open: true, editing: null })}
                onOpenEdit={(badge) => setBadgeModal({ open: true, editing: badge })}
                onDelete={handleDeleteBadge}
              />
            )}

            {activeTab === "points" && (
              <PointsTab
                points={points}
                employees={employees}
                refreshing={refreshing}
                onOpenModal={(entry) =>
                  setPointsModal({
                    open: true,
                    editing: entry,
                  })
                }
              />
            )}

            {activeTab === "redemptions" && (
              <RedemptionsTab
                redemptions={redemptions}
                refreshing={refreshing}
                onOpenCreate={() => setRedemptionOpen(true)}
                onOpenProcess={(redemption) =>
                  setProcessRedemption({ open: true, redemption })
                }
              />
            )}
          </>
        )}
      </div>

      {recognitionOpen && (
        <CreateRecognitionModal
          employees={employees}
          badges={badges}
          submitting={api.busy}
          onSubmit={handleCreateRecognition}
          onClose={() => setRecognitionOpen(false)}
        />
      )}

      {badgeModal.open && (
        <BadgeModal
          badge={badgeModal.editing}
          submitting={api.busy}
          onSubmit={(input) =>
            badgeModal.editing
              ? handleUpdateBadge(badgeModal.editing.id, input)
              : handleCreateBadge(input)
          }
          onClose={() => setBadgeModal({ open: false, editing: null })}
        />
      )}

      {pointsModal.open && (
        <PointsModal
          points={pointsModal.editing}
          employees={employees}
          submitting={api.busy}
          onSubmit={handleSetPoints}
          onClose={() => setPointsModal({ open: false, editing: null })}
        />
      )}

      {redemptionOpen && (
        <RedemptionModal
          employees={employees}
          submitting={api.busy}
          onSubmit={handleCreateRedemption}
          onClose={() => setRedemptionOpen(false)}
        />
      )}

      {processRedemption.open && processRedemption.redemption && (
        <ProcessRedemptionModal
          redemption={processRedemption.redemption}
          submitting={api.busy}
          onSubmit={(input) =>
            handleProcessRedemption(processRedemption.redemption!.id, input)
          }
          onClose={() => setProcessRedemption({ open: false, redemption: null })}
        />
      )}
    </div>
  );
}
