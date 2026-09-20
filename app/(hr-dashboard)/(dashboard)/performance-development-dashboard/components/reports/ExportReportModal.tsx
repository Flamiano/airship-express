"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, X } from "lucide-react";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import {
  cachedPerDevAccountType,
  redirectToLogin,
} from "@/performance-development-dashboard/lib/auth/redirect";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";

const VERIFY_EXPORT_API =
  "/performance-development-dashboard/api/performance/reports/verify-export";

export type ExportFormat = "pdf" | "csv";

type Props = {
  onClose: () => void;
  onExport: (format: ExportFormat) => void;
};

type Step = "format" | "password";

function formatLabel(format: ExportFormat): string {
  return format === "pdf" ? "PDF file" : "CSV file";
}

/**
 * Two-step export dialog for Reports & Analytics: the user first picks a
 * format (PDF or CSV), then confirms their password. The password is verified
 * against the authenticated account through the PerDev verify-export endpoint,
 * which resolves the identity server-side from the session. The password is
 * only held in local state for the duration of this dialog, never stored,
 * logged, or put in a URL.
 */
export function ExportReportModal({ onClose, onExport }: Props) {
  const [step, setStep] = useState<Step>("format");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "format") {
      (format === "pdf" ? pdfRef : csvRef).current?.focus();
    } else {
      passwordRef.current?.focus();
    }
  }, [step, format]);

  const showError = (message: string) => {
    setError(message);
    setPassword("");
    passwordRef.current?.focus();
  };

  async function verifyPassword() {
    setVerifying(true);

    try {
      const response = await fetch(VERIFY_EXPORT_API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const body: unknown = await response.json().catch(() => null);
      const message =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error?: unknown }).error === "string"
          ? (body as { error: string }).error
          : `Request failed with status ${response.status}`;

      if (response.ok) {
        onExport(format);
        return;
      }

      // A 401 whose message is not the bad-password result, and any 403,
      // means the session is invalid, expired, or the account no longer has
      // access. Match the existing PerDev convention by sending the user back
      // to the HR sign-in page instead of exporting.
      if (
        (response.status === 401 && !message.includes("Incorrect password.")) ||
        response.status === 403
      ) {
        onClose();
        redirectToLogin(cachedPerDevAccountType());
        return;
      }

      showError(message);
    } catch {
      showError("Unable to verify your password. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (verifying) return;
    if (step === "format") {
      setError(null);
      setStep("password");
      return;
    }

    setError(null);

    if (!password) {
      showError("Password is required.");
      return;
    }

    await verifyPassword();
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={verifying}
      labelledBy="export-report-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development · Reports &amp; Analytics
            </p>
            <h2
              id="export-report-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {step === "format" ? "Export Report" : "Confirm Export"}
            </h2>
          </div>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={verifying}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>

        {step === "format" ? (
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Choose a format for this report, then confirm your password to
            continue.
          </p>
        ) : (
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Confirm your password to verify your identity before exporting this
            report as a {formatLabel(format)}. Your password is used only for
            this verification and is never stored.
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="mt-5 space-y-5"
        >
          {step === "format" ? (
            <fieldset>
              <legend className="sr-only">Export format</legend>
              <div className="grid grid-cols-2 gap-3">
                <label
                  htmlFor="export-format-pdf"
                  className={cn(
                    "flex cursor-pointer flex-col rounded-xl border px-4 py-3 transition-colors hover:border-accent/50 focus-within:border-accent",
                    format === "pdf"
                      ? "border-accent bg-accent/[0.06]"
                      : "border-line dark:border-paper/15",
                  )}
                >
                  <input
                    id="export-format-pdf"
                    ref={pdfRef}
                    type="radio"
                    name="export-format"
                    value="pdf"
                    checked={format === "pdf"}
                    onChange={() => setFormat("pdf")}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between">
                    <FileText
                      size={18}
                      strokeWidth={1.75}
                      className={format === "pdf" ? "text-accent" : "text-muted"}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border-2",
                        format === "pdf" ? "border-accent" : "border-line",
                      )}
                    >
                      {format === "pdf" && (
                        <span className="h-2 w-2 rounded-full bg-accent" />
                      )}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-2.5 text-[13.5px] font-semibold",
                      format === "pdf" ? "text-ink" : "text-muted",
                    )}
                  >
                    PDF
                  </span>
                  <span className="mt-0.5 text-[11.5px] leading-snug text-muted">
                    Print-ready report via the browser print dialog
                  </span>
                </label>

                <label
                  htmlFor="export-format-csv"
                  className={cn(
                    "flex cursor-pointer flex-col rounded-xl border px-4 py-3 transition-colors hover:border-accent/50 focus-within:border-accent",
                    format === "csv"
                      ? "border-accent bg-accent/[0.06]"
                      : "border-line dark:border-paper/15",
                  )}
                >
                  <input
                    id="export-format-csv"
                    ref={csvRef}
                    type="radio"
                    name="export-format"
                    value="csv"
                    checked={format === "csv"}
                    onChange={() => setFormat("csv")}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between">
                    <Download
                      size={18}
                      strokeWidth={1.75}
                      className={format === "csv" ? "text-accent" : "text-muted"}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border-2",
                        format === "csv" ? "border-accent" : "border-line",
                      )}
                    >
                      {format === "csv" && (
                        <span className="h-2 w-2 rounded-full bg-accent" />
                      )}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-2.5 text-[13.5px] font-semibold",
                      format === "csv" ? "text-ink" : "text-muted",
                    )}
                  >
                    CSV
                  </span>
                  <span className="mt-0.5 text-[11.5px] leading-snug text-muted">
                    Spreadsheet data downloaded as a .csv file
                  </span>
                </label>
              </div>
            </fieldset>
          ) : (
            <>
              <div>
                <label
                  htmlFor="export-report-password"
                  className="mb-1.5 block text-[12.5px] font-medium text-ink"
                >
                  Password
                </label>
                <input
                  id="export-report-password"
                  ref={passwordRef}
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={verifying}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-[12.5px] font-medium text-red-600">
                    {error}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={verifying}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifying}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === "format"
                ? "Continue"
                : verifying
                  ? "Verifying..."
                  : "Confirm Export"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}