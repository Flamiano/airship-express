"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
};

export default function NewInterviewPage() {
  const router = useRouter();
  const supabase = createClient();

  const [applicants, setApplicants] = useState<Applicant[]>([]);

  const [loadingApplicants, setLoadingApplicants] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [applicantId, setApplicantId] = useState("");
  const [interviewerName, setInterviewerName] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [locationOrLink, setLocationOrLink] = useState("");

  // ==========================================
  // LOAD APPLICANTS
  // ==========================================

  useEffect(() => {
    async function loadApplicants() {
      try {
        setLoadingApplicants(true);
        setError("");

        const { data, error } = await supabase
          .from("hr1_applicants")
          .select(`
            id,
            first_name,
            last_name,
            email,
            status
          `)
          .order("first_name", { ascending: true });

        if (error) {
          console.error("APPLICANTS LOAD ERROR:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            error: error,
          });

          setError(
            `Unable to load applicants: ${
              error.message || "Database query failed."
            }`
          );

          return;
        }

        console.log("ALL APPLICANTS FROM SUPABASE:", data);

        const excludedStatuses = [
          "Hired",
          "Completed",
          "Passed",
          "Onboarding",
          "Employee",
        ];

        const availableApplicants = (data ?? []).filter(
          (applicant) =>
            !excludedStatuses.includes(applicant.status)
        );

        console.log(
          "AVAILABLE APPLICANTS:",
          availableApplicants
        );

        setApplicants(availableApplicants);
      } catch (err: any) {
        console.error("APPLICANTS EXCEPTION:", err);

        setError(
          `Unable to load applicants: ${
            err?.message || "Unexpected error occurred."
          }`
        );
      } finally {
        setLoadingApplicants(false);
      }
    }

    loadApplicants();
  }, []);

  // ==========================================
  // SUBMIT
  // ==========================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!applicantId) {
      setError("Please select an applicant.");
      setSaving(false);
      return;
    }

    if (!interviewerName.trim()) {
      setError("Please enter an interviewer.");
      setSaving(false);
      return;
    }

    if (!scheduledDate) {
      setError("Please select the interview date and time.");
      setSaving(false);
      return;
    }

    try {
      // ------------------------------------------
      // CREATE INTERVIEW
      // ------------------------------------------

      const { data: interview, error: interviewError } = await supabase
        .from("hr1_interviews")
        .insert({
          applicant_id: applicantId,
          interviewer_name: interviewerName.trim(),
          scheduled_date: new Date(scheduledDate).toISOString(),
          location_or_link: locationOrLink.trim() || null,

          // Exact interview_status enum
          status: "Scheduled",

          // Exact interview_outcome enum
          outcome: "Pending",
        })
        .select()
        .single();

      if (interviewError) {
        console.error("INTERVIEW INSERT ERROR:", interviewError);
        setError(`Save failed: ${interviewError.message}`);
        setSaving(false);
        return;
      }

      console.log("INTERVIEW CREATED:", interview);

      // ------------------------------------------
      // UPDATE APPLICANT STATUS
      // ------------------------------------------

      const { error: applicantError } = await supabase
        .from("hr1_applicants")
        .update({
          status: "Interview Scheduled",
        })
        .eq("id", applicantId);

      if (applicantError) {
        console.error(
          "APPLICANT STATUS UPDATE ERROR:",
          applicantError
        );

        setError(
          `Interview was saved, but applicant status could not be updated: ${applicantError.message}`
        );

        setSaving(false);
        return;
      }

      // ------------------------------------------
      // SUCCESS
      // ------------------------------------------

      router.push("/recruitment-core-hub-dashboard/recruitment/interviews");
      router.refresh();
    } catch (err: any) {
      console.error("SUBMIT EXCEPTION:", err);
      setError(`An unexpected error occurred: ${err.message || err}`);
      setSaving(false);
    }
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-16">

      {/* HEADER */}
      <header className="sticky top-0 z-25 border-b border-slate-200/85 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
              Human Resource Department
            </span>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900">
              Recruitment & Employee Records
            </h1>
          </div>

          <div className="flex items-center gap-3 border-l border-slate-200 pl-4 sm:pl-6">
            <div className="text-right hidden sm:block">
              <p className="text-xs sm:text-sm font-semibold text-slate-900">
                Super Admin
              </p>
              <p className="text-[10px] sm:text-xs font-medium text-slate-500">
                Administrator
              </p>
            </div>
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[#E91E8F] to-[#ff52b4] text-xs sm:text-sm font-bold text-white shadow-md shadow-[#E91E8F]/20 ring-2 ring-white">
              SA
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 sm:pt-10">

        {/* BACK BUTTON */}
        <Link
          href="/recruitment-core-hub-dashboard/recruitment/interviews"
          className="group inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#E91E8F] transition-colors hover:text-[#c41375]"
        >
          <svg
            className="h-4 w-4 transition-transform group-hover:-translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to Interviews
        </Link>

        {/* PAGE HEADING */}
        <div className="mb-6 sm:mb-8 mt-4 sm:mt-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Schedule Interview
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Assign an applicant to an interviewer and set the meeting details.
          </p>
        </div>

        {/* FORM CARD */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5">

          <form
            onSubmit={handleSubmit}
            className="p-5 sm:p-8 space-y-6"
          >

            {/* SELECTION GRID */}
            <div className="grid grid-cols-1 gap-5 sm:gap-6">

              {/* APPLICANT */}
              <div>
                <label
                  htmlFor="applicant"
                  className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Applicant <span className="text-[#E91E8F]">*</span>
                </label>

                {loadingApplicants ? (
                  <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
                ) : applicants.length === 0 ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs sm:text-sm text-amber-800">
                    <svg
                      className="h-5 w-5 shrink-0 text-amber-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>
                      No applicants available. Please add an applicant first.
                    </span>
                  </div>
                ) : (
                  <select
                    id="applicant"
                    value={applicantId}
                    onChange={(event) =>
                      setApplicantId(event.target.value)
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10"
                  >
                    <option value="">
                      Select an applicant
                    </option>

                    {applicants.map((applicant) => (
                      <option
                        key={applicant.id}
                        value={applicant.id}
                      >
                        {applicant.first_name}{" "}
                        {applicant.last_name} —{" "}
                        {applicant.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* INTERVIEWER */}
              <div>
                <label
                  htmlFor="interviewer"
                  className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Interviewer <span className="text-[#E91E8F]">*</span>
                </label>

                <input
                  id="interviewer"
                  type="text"
                  value={interviewerName}
                  onChange={(event) =>
                    setInterviewerName(event.target.value)
                  }
                  required
                  placeholder="e.g. John Dela Cruz"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 shadow-sm placeholder:text-slate-400 outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10"
                />
              </div>

              {/* DATE AND TIME */}
              <div>
                <label
                  htmlFor="scheduledDate"
                  className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Interview Date & Time{" "}
                  <span className="text-[#E91E8F]">*</span>
                </label>

                <input
                  id="scheduledDate"
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(event) =>
                    setScheduledDate(event.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10"
                />
              </div>

              {/* LOCATION */}
              <div>
                <label
                  htmlFor="location"
                  className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Location / Meeting Link
                </label>

                <input
                  id="location"
                  type="text"
                  value={locationOrLink}
                  onChange={(event) =>
                    setLocationOrLink(event.target.value)
                  }
                  placeholder="e.g. HR Office or Google Meet link"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 shadow-sm placeholder:text-slate-400 outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10"
                />
              </div>

            </div>

            {/* DEFAULT STATUS PREVIEW */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">

                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Interview Status
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    Scheduled
                  </span>
                </div>

                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Interview Outcome
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-700/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Pending
                  </span>
                </div>

              </div>

              <p className="mt-3 text-[11px] sm:text-xs text-slate-400 border-t border-slate-200/60 pt-2.5">
                Status and outcome can be updated after the interview is scheduled.
              </p>
            </div>

            {/* ERROR ALERT */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs sm:text-sm text-red-700">
                <svg
                  className="h-5 w-5 shrink-0 text-red-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-slate-100 pt-6">

              <Link
                href="/recruitment-core-hub-dashboard/recruitment/interviews"
                className="w-full sm:w-auto text-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving || loadingApplicants}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#E91E8F] px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-[#E91E8F]/20 transition hover:bg-[#d8177f] active:bg-[#be116f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && (
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {saving
                  ? "Scheduling..."
                  : "Schedule Interview"}
              </button>

            </div>

          </form>
        </div>
      </div>
    </main>
  );
}