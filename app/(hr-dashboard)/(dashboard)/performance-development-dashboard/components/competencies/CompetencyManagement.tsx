"use client";

import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { useState } from "react";
import { toast } from "sonner";
import { Award, RefreshCw } from "lucide-react";
import { SkeletonPanel } from "@/performance-development-dashboard/components/ui/Skeleton";
import type {
  Competency,
  CompetencyInput,
  CurrentPerDevUser,
  EmployeeCompetencyAssessmentInput,
  EmployeeCompetencyProfileItem,
  EmployeeOption,
  PositionCompetencyRequirement,
  PositionCompetencyRequirementInput,
  PositionOption,
  UpdatePositionCompetencyRequirementInput,
} from "@/performance-development-dashboard/types";
import { useCompetencyApi } from "@/performance-development-dashboard/hooks/useCompetencyApi";
import { CompetencyLibraryTab } from "@/performance-development-dashboard/components/competencies/CompetencyLibraryTab";
import { PositionRequirementsTab } from "@/performance-development-dashboard/components/competencies/PositionRequirementsTab";
import { EmployeeCompetenciesTab } from "@/performance-development-dashboard/components/competencies/EmployeeCompetenciesTab";

type Props = {
  serverUser: CurrentPerDevUser;
  isHrAdmin: boolean;
  competencies: Competency[];
  initialRequirements: PositionCompetencyRequirement[];
  initialProfile: EmployeeCompetencyProfileItem[];
  initialError?: string;
  employees: EmployeeOption[];
  positions: PositionOption[];
  competenciesById: Record<string, string>;
  employeeNamesById: Record<string, string>;
  currentUserEmployeeId: string | null;
  defaultPositionId: string | null;
  defaultEmployeeId: string | null;
  employeePositionById: Record<string, string | null>;
};

type TabKey = "library" | "requirements" | "employees";

const TABS: { key: TabKey; label: string }[] = [
  { key: "library", label: "Competency Library" },
  { key: "requirements", label: "Position Requirements" },
  { key: "employees", label: "Employee Competencies" },
];

export function CompetencyManagement({
  serverUser,
  isHrAdmin,
  competencies: initialCompetencies,
  initialRequirements,
  initialProfile,
  initialError,
  employees,
  positions,
  competenciesById,
  employeeNamesById,
  currentUserEmployeeId,
  defaultPositionId,
  defaultEmployeeId,
  employeePositionById,
}: Props) {
  const api = useCompetencyApi();

  const [competencies, setCompetencies] =
    useState<Competency[]>(initialCompetencies);
  const [requirements, setRequirements] =
    useState<PositionCompetencyRequirement[]>(initialRequirements);
  const [profile, setProfile] =
    useState<EmployeeCompetencyProfileItem[]>(initialProfile);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("library");

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  async function refreshAll() {
    setRefreshing(true);
    try {
      const [nextCompetencies, nextRequirements, nextProfile] =
        await Promise.all([
          api.listCompetencies(),
          api.listPositionRequirements(),
          api.listEmployeeCompetencies(),
        ]);
      setCompetencies(nextCompetencies);
      setRequirements(nextRequirements);
      setProfile(nextProfile);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh competency data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateCompetency(input: CompetencyInput) {
    await api.runCreateCompetency(input);
    setActiveTab("library");
    await refreshAll();
    toast.success("Competency created.");
  }

  async function handleUpdateCompetency(id: string, input: CompetencyInput) {
    await api.runUpdateCompetency(id, input);
    await refreshAll();
    toast.success("Competency updated.");
  }

  async function handleCreateRequirement(
    input: PositionCompetencyRequirementInput
  ) {
    await api.runCreatePositionRequirement(input);
    setActiveTab("requirements");
    await refreshAll();
    toast.success("Position requirement assigned.");
  }

  async function handleUpdateRequirement(
    id: string,
    input: UpdatePositionCompetencyRequirementInput
  ) {
    await api.runUpdatePositionRequirement(id, input);
    await refreshAll();
    toast.success("Required level updated.");
  }

  async function handleAssessEmployee(
    input: EmployeeCompetencyAssessmentInput
  ) {
    await api.runAssessEmployee(input);
    setActiveTab("employees");
    await refreshAll();
    toast.success("Competency assessment recorded.");
  }

  const libraryReady =
    activeTab === "library" && !refreshing && competencies.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
            Competencies
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted">
            {isHrAdmin
              ? `Hello ${firstName}. Define the competency library, set the required levels expected of each position, and record each employee's current competency profile.`
              : `Hello ${firstName}. Browse the competency library, the requirements of your position, and your own competency profile.`}
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
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-accent text-paper shadow-sm shadow-accent/25"
                  : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]"
              )}
            >
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

        {refreshing && !libraryReady ? (
          <div aria-busy="true" role="status">
            <SkeletonPanel lines={6} />
          </div>
        ) : (
          <>
            {activeTab === "library" && (
              <CompetencyLibraryTab
                competencies={competencies}
                isHrAdmin={isHrAdmin}
                submitting={api.busy}
                onCreate={handleCreateCompetency}
                onUpdate={handleUpdateCompetency}
              />
            )}

            {activeTab === "requirements" && (
              <PositionRequirementsTab
                requirements={requirements}
                competencies={competencies}
                positions={positions}
                competenciesById={competenciesById}
                isHrAdmin={isHrAdmin}
                defaultPositionId={defaultPositionId}
                submitting={api.busy}
                onCreate={handleCreateRequirement}
                onUpdate={handleUpdateRequirement}
              />
            )}

            {activeTab === "employees" && (
              <EmployeeCompetenciesTab
                profile={profile}
                employees={employees}
                positions={positions}
                competencies={competencies}
                competenciesById={competenciesById}
                employeeNamesById={employeeNamesById}
                employeePositionById={employeePositionById}
                isHrAdmin={isHrAdmin}
                currentUserEmployeeId={currentUserEmployeeId}
                defaultEmployeeId={defaultEmployeeId}
                submitting={api.busy}
                onAssess={handleAssessEmployee}
              />
            )}
          </>
        )}
      </div>

      {competencies.length === 0 && activeTab === "library" && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-line px-6 py-4 text-[13px] text-muted dark:border-paper/10">
          <Award size={15} strokeWidth={1.5} />
          No competencies in the library yet.
        </div>
      )}
    </div>
  );
}