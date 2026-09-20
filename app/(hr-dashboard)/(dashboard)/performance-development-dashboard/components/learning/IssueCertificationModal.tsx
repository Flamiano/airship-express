"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
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
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
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
          <div>
            <label
              htmlFor="cert-employee"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Employee
            </label>
            <select
              id="cert-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="cert-course"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Course <span className="text-muted">(optional)</span>
            </label>
            <select
              id="cert-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              <option value="">None</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="cert-url"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Certificate URL <span className="text-muted">(optional)</span>
            </label>
            <input
              id="cert-url"
              type="url"
              value={certificateUrl}
              onChange={(e) => setCertificateUrl(e.target.value)}
              maxLength={MAX_CERT_URL_LENGTH}
              placeholder="https://example.com/certificates/123"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-right text-[11px] text-muted"><span className="tabular-nums">{certificateUrl.length}/{MAX_CERT_URL_LENGTH}</span></p>
          </div>

          <div>
            <label
              htmlFor="cert-expires"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Expires <span className="text-muted">(optional)</span>
            </label>
            <input
              id="cert-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1.5 text-[11.5px] text-muted">
              Issued on is recorded automatically. The schema has no status
              field, so this module never derives validity from dates.
            </p>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[12.5px] font-medium text-red-600">
                {formError}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Issuing..." : "Issue certification"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}