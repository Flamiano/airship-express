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
      <FilterBar className="sm:justify-between">
          {isHrAdmin ? (
            <select
              value={effectiveEmployeeId ?? ""}
              onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-medium text-ink outline-none transition-colors focus:border-accent sm:max-w-[320px] dark:border-paper/15"
            >
              {employees.length === 0 && <option value="">No employees</option>}
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-medium text-ink sm:max-w-[320px] dark:border-paper/15">
              {selectedEmployeeName}
            </span>
          )}

          {isHrAdmin && (
            <button
              type="button"
              onClick={() => setIssueOpen(true)}
              disabled={submitting || !effectiveEmployeeId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} strokeWidth={2} />
              Issue certification
            </button>
          )}
      </FilterBar>

      {!effectiveEmployeeId ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <Award size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            No employee selected
          </p>
        </div>
      ) : matching.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <Award size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            No certifications yet
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {isHrAdmin
              ? `Issue a certification to ${selectedEmployeeName} to record their credentials `
                + "here. Dates are shown as facts; no validity status is derived."
              : "Your certifications will appear here once issued by your performance team."}
          </p>
          {isHrAdmin && (
            <button
              type="button"
              onClick={() => setIssueOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              <Plus size={15} strokeWidth={2} />
              Issue certification
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10">
            <p className="text-[13px] font-medium text-ink">
              {selectedEmployeeName}
            </p>
            <span className="text-[12px] text-muted">
              · {matching.length} certification{matching.length === 1 ? "" : "s"}
            </span>
          </div>

          {matching.map((certification) => {
            const courseTitle = certification.course_id
              ? courseTitlesById[certification.course_id] ?? null
              : null;
            return (
              <div
                key={certification.id}
                className="flex items-center gap-4 rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Award size={18} strokeWidth={1.75} />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate font-medium text-ink">
                    {courseTitle ?? "Certification record"}
                  </p>
                  <p className="text-[12px] text-muted">
                    Issued {formatDate(certification.issued_at)}
                    {certification.expires_at
                      ? ` · Expires ${formatDate(certification.expires_at)}`
                      : " · No expiry recorded"}
                  </p>
                  {certification.certificate_url && (
                    <a
                      href={certification.certificate_url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[12px] font-medium text-accent hover:underline"
                    >
                      View certificate
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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