"use client";

import { useMemo, useState } from "react";
import { Award, Plus } from "lucide-react";
import type {
  Certification,
  CertificationInput,
  EmployeeOption,
} from "@/performance-development-dashboard/types";
import { IssueCertificationModal } from "@/performance-development-dashboard/components/learning/IssueCertificationModal";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import {
  PerformanceButton,
  PerformanceEmptyState,
  PerformancePanel,
  PerformanceSelect,
} from "@/performance-development-dashboard/components/ui/performance";
import { formatDate } from "@/performance-development-dashboard/lib/format/date";

type Props = {
  certifications: Certification[];
  courses: { id: string; title: string }[];
  employees: EmployeeOption[];
  isHrAdmin: boolean;
  employeeNamesById: Record<string, string>;
  currentUserEmployeeId: string | null;
  defaultEmployeeId: string | null;
  submitting?: boolean;
  onCreate: (input: CertificationInput) => Promise<void>;
};

export function CertificationsTab({
  certifications,
  courses,
  employees,
  isHrAdmin,
  employeeNamesById,
  currentUserEmployeeId,
  defaultEmployeeId,
  submitting,
  onCreate,
}: Props) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    defaultEmployeeId ?? currentUserEmployeeId
  );
  const [issueOpen, setIssueOpen] = useState(false);

  const effectiveEmployeeId = isHrAdmin
    ? selectedEmployeeId ?? employees[0]?.id ?? null
    : currentUserEmployeeId;

  const courseTitlesById: Record<string, string> = {};
  for (const course of courses) {
    courseTitlesById[course.id] = course.title;
  }

  const matching = useMemo(() => {
    if (!effectiveEmployeeId) return [];
    return certifications
      .filter(
        (certification) =>
          certification.employee_id === effectiveEmployeeId
      )
      .sort((a, b) => a.issued_at.localeCompare(b.issued_at));
  }, [certifications, effectiveEmployeeId]);

  const selectedEmployeeName =
    employeeNamesById[effectiveEmployeeId ?? ""] ?? "Unknown employee";

  return (
    <div className="space-y-4">
      <FilterBar>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {isHrAdmin ? (
            <PerformanceSelect
              id="certification-employee-filter"
              aria-label="Select employee"
              value={effectiveEmployeeId ?? ""}
              onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
              className="sm:w-auto sm:max-w-[240px]"
            >
              {employees.length === 0 && <option value="">No employees</option>}
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </PerformanceSelect>
          ) : (
            <span className="rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-medium text-ink dark:border-paper/15">
              {selectedEmployeeName}
            </span>
          )}
        </div>

        {isHrAdmin && (
          <PerformanceButton
            onClick={() => setIssueOpen(true)}
            disabled={submitting || !effectiveEmployeeId}
          >
            <Plus size={15} strokeWidth={2} />
            Issue certification
          </PerformanceButton>
        )}
      </FilterBar>

      {!effectiveEmployeeId ? (
        <PerformanceEmptyState
          icon={<Award size={22} strokeWidth={1.5} className="text-muted" />}
          title="No employee selected"
          message="Select an employee to view their certifications."
        />
      ) : matching.length === 0 ? (
        <PerformanceEmptyState
          icon={<Award size={22} strokeWidth={1.5} className="text-muted" />}
          title="No certifications yet"
          message={
            isHrAdmin
              ? `Issue a certification to ${selectedEmployeeName} to record their credentials here. Dates are shown as facts; no validity status is derived.`
              : "Your certifications will appear here once issued by your performance team."
          }
          action={
            isHrAdmin ? (
              <PerformanceButton
                onClick={() => setIssueOpen(true)}
                className="mt-1"
              >
                <Plus size={15} strokeWidth={2} />
                Issue certification
              </PerformanceButton>
            ) : undefined
          }
        />
      ) : (
        <PerformancePanel>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-bricolage text-[17px] font-medium tracking-tight text-ink">
              {selectedEmployeeName}
            </p>
            <p className="text-[12px] text-muted">
              {matching.length} certification{matching.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="mt-4 divide-y divide-line dark:divide-paper/10">
            {matching.map((certification) => {
              const courseTitle = certification.course_id
                ? courseTitlesById[certification.course_id] ?? null
                : null;
              return (
                <li
                  key={certification.id}
                  className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-ink">
                      {courseTitle ?? "Certification record"}
                    </p>
                    <p className="mt-1 text-[12px] text-muted">
                      Issued {formatDate(certification.issued_at)}
                      {certification.expires_at
                        ? ` · Expires ${formatDate(certification.expires_at)}`
                        : " · No expiry recorded"}
                    </p>
                  </div>
                  {certification.certificate_url && (
                    <a
                      href={certification.certificate_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 self-start text-[12px] font-medium text-accent underline underline-offset-2 hover:text-accent-dark sm:self-center"
                    >
                      View certificate
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </PerformancePanel>
      )}

      {issueOpen && effectiveEmployeeId && (
        <IssueCertificationModal
          courses={courses}
          employees={employees}
          defaultEmployeeId={effectiveEmployeeId}
          submitting={submitting ?? false}
          onSubmit={async (input) => {
            await onCreate(input);
            setIssueOpen(false);
          }}
          onClose={() => setIssueOpen(false)}
        />
      )}
    </div>
  );
}
