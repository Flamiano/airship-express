"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceSelect,
  PerformanceTextInput,
} from "@/performance-development-dashboard/components/ui/performance";
import type { CertificationInput, EmployeeOption } from "@/performance-development-dashboard/types";
import { MAX_CERT_URL_LENGTH } from "@/performance-development-dashboard/lib/constants";

type Props = {
  courses: { id: string; title: string }[];
  employees: EmployeeOption[];
  defaultEmployeeId: string;
  submitting: boolean;
  onSubmit: (input: CertificationInput) => Promise<void>;
  onClose: () => void;
};

export function IssueCertificationModal({
  courses,
  employees,
  defaultEmployeeId,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId);
  const [courseId, setCourseId] = useState("");
  const [certificateUrl, setCertificateUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // New-certification selector: active employees only. Options without a
  // status carry no signal (e.g. scoped lists) and stay eligible; the server
  // rejects inactive employees independently so stale submissions fail closed.
  // Previously issued certifications remain visible regardless of status.
  const eligibleEmployees = employees.filter(
    (employee) => !employee.status || employee.status === "active"
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    let expiresIso: string | null = null;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        setFormError("Expiry must be a valid date.");
        return;
      }
      expiresIso = parsed.toISOString();
    }

    try {
      await onSubmit({
        employee_id: employeeId,
        course_id: courseId || null,
        certificate_url: certificateUrl.trim() || null,
        expires_at: expiresIso,
      });
      setCourseId("");
      setCertificateUrl("");
      setExpiresAt("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to issue certification."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="issue-certification-modal-title"
    >
      <PerformanceDialogPanel
        size="sm"
        labelledBy="issue-certification-modal-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="issue-certification-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Issue certification
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
          <PerformanceField label="Employee" htmlFor="cert-employee">
            <PerformanceSelect
              id="cert-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting}
            >
              {eligibleEmployees.length === 0 && (
                <option value="">No active employees</option>
              )}
              {eligibleEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </PerformanceSelect>
          </PerformanceField>

          <PerformanceField label="Course" htmlFor="cert-course" optional>
            <PerformanceSelect
              id="cert-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={submitting}
            >
              <option value="">None</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </PerformanceSelect>
          </PerformanceField>

          <div>
            <PerformanceField
              label="Certificate URL"
              htmlFor="cert-url"
              optional
            >
              <PerformanceTextInput
                id="cert-url"
                type="url"
                value={certificateUrl}
                onChange={(e) => setCertificateUrl(e.target.value)}
                maxLength={MAX_CERT_URL_LENGTH}
                placeholder="https://example.com/certificates/123"
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {certificateUrl.length}/{MAX_CERT_URL_LENGTH}
            </p>
          </div>

          <PerformanceField
            label="Expires"
            htmlFor="cert-expires"
            optional
            hint="Issued on is recorded automatically. The schema has no status field, so this module never derives validity from dates."
          >
            <PerformanceTextInput
              id="cert-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={submitting}
            />
          </PerformanceField>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[12.5px] font-medium text-red-600">
                {formError}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <PerformanceButton
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </PerformanceButton>
            <PerformanceButton type="submit" disabled={submitting}>
              {submitting ? "Issuing..." : "Issue certification"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}
