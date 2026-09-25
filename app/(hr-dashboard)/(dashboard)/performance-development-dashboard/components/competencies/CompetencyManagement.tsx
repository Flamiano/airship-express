"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import {
  PerformanceButton,
  PerformanceErrorBanner,
  PerformancePageHeader,
  PerformanceTabs,
} from "@/performance-development-dashboard/components/ui/performance";
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

  return (
    <div className="space-y-6">
      <PerformancePageHeader
        title="Competencies"
        description={
          isHrAdmin
            ? `Hello ${firstName}. Define the competency library, set the required levels expected of each position, and record each employee's current competency profile.`
            : `Hello ${firstName}. Browse the competency library, the requirements of your position, and your own competency profile.`
        }
        actions={
          <PerformanceButton
            variant="ghost"
            onClick={refreshAll}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </PerformanceButton>
        }
      />

      <PerformanceTabs
        tabs={[
          { key: "library", label: "Library", count: competencies.length },
          {
            key: "requirements",
            label: "Requirements",
            count: requirements.length,
          },
          { key: "employees", label: "Profiles", count: profile.length },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        ariaLabel="Competency views"
      />

      {error && (
        <PerformanceErrorBanner message={error} onRetry={refreshAll} />
      )}

      {refreshing ? (
        <div aria-busy="true" role="status">
          <span className="sr-only">Loading competencies...</span>
          <SkeletonList rows={3} />
        </div>
      ) : (
        <>
          {activeTab === "library" && (
            <CompetencyLibraryTab
              competencies={competencies}
              requirements={requirements}
              positions={positions}
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
  );
}
