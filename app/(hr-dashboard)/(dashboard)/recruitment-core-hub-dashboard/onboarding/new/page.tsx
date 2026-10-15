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

export default function NewOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [applicantId, setApplicantId] = useState("");
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);

  const requestedDocumentOptions = [
    ["government_id", "Government ID"],
    ["diploma", "Diploma / Certificate of Graduation"],
    ["academic_record", "Transcript / Academic Record"],
    ["sss", "SSS Document"],
    ["philhealth", "PhilHealth Document"],
    ["pagibig", "Pag-IBIG Document"],
    ["tin", "TIN Document"],
    ["clearance", "Clearance"],
    ["medical", "Medical Document"],
    ["other_certificate", "Other requested document"],
  ];

  const [sssSubmitted, setSssSubmitted] = useState(false);
  const [philhealthSubmitted, setPhilhealthSubmitted] = useState(false);
  const [pagibigSubmitted, setPagibigSubmitted] = useState(false);
  const [tinSubmitted, setTinSubmitted] = useState(false);
  const [clearanceSubmitted, setClearanceSubmitted] = useState(false);
  const [medicalSubmitted, setMedicalSubmitted] = useState(false);
  const [trainingCompleted, setTrainingCompleted] = useState(false);

  const [remarks, setRemarks] = useState("");

  // ==========================================
  // LOAD APPLICANTS READY FOR ONBOARDING
  // ==========================================

  useEffect(() => {
    async function loadApplicants() {
      try {
        setLoadingApplicants(true);
        setError("");

        /*
         * Only applicants with "Interview Passed"
         * are allowed to start onboarding.
         *
         * Applicants already marked "Onboarding"
         * will not appear here.
         */

        const { data, error } = await supabase
          .from("hr1_applicants")
          .select(`
            id,
            first_name,
            last_name,
            email,
            status
          `)
          .eq("status", "Interview Passed")
          .order("first_name", {
            ascending: true,
          });

        if (error) {
          throw error;
        }

        setApplicants(data ?? []);
      } catch (err: unknown) {
        console.error(
          "ONBOARDING APPLICANTS LOAD ERROR:",
          err
        );

        setError(
          `Unable to load applicants: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      } finally {
        setLoadingApplicants(false);
      }
    }

    loadApplicants();
  }, [supabase]);

  // ==========================================
  // SUBMIT
  // ==========================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      // ------------------------------------------
      // VALIDATE APPLICANT
      // ------------------------------------------

      if (!applicantId) {
        setError("Please select an applicant.");
        setSaving(false);
        return;
      }

      // ------------------------------------------
      // CHECK APPLICANT STATUS
      // ------------------------------------------

      const { data: applicant, error: applicantCheckError } =
        await supabase
          .from("hr1_applicants")
          .select("id, status")
          .eq("id", applicantId)
          .single();

      if (applicantCheckError || !applicant) {
        console.error(
          "APPLICANT CHECK ERROR:",
          applicantCheckError
        );

        setError(
          applicantCheckError?.message ||
            "Applicant could not be found."
        );

        setSaving(false);
        return;
      }

      if (applicant.status !== "Interview Passed") {
        setError(
          "Only applicants who passed the interview can start onboarding."
        );

        setSaving(false);
        return;
      }

      // ------------------------------------------
      // CHECK EXISTING ONBOARDING
      // ------------------------------------------

      /*
       * applicant_id is UNIQUE in onboardings.
       * This prevents duplicate onboarding records.
       */

      const {
        data: existingOnboarding,
        error: existingError,
      } = await supabase
        .from("hr1_onboardings")
        .select("id")
        .eq("applicant_id", applicantId)
        .maybeSingle();

      if (existingError) {
        console.error(
          "ONBOARDING EXISTING CHECK ERROR:",
          existingError
        );

        setError(
          `Unable to check existing onboarding: ${existingError.message}`
        );

        setSaving(false);
        return;
      }

      if (existingOnboarding) {
        setError(
          "This applicant already has an onboarding record."
        );

        setSaving(false);
        return;
      }

      // ------------------------------------------
      // CHECK COMPLETION
      // ------------------------------------------

      // ------------------------------------------
      // CREATE ONBOARDING
      // ------------------------------------------

      const {
        data: onboarding,
        error: onboardingError,
      } = await supabase
        .from("hr1_onboardings")
        .insert({
          applicant_id: applicantId,
          required_documents: requiredDocuments,
          sss_submitted: sssSubmitted,
          philhealth_submitted: philhealthSubmitted,
          pagibig_submitted: pagibigSubmitted,
          tin_submitted: tinSubmitted,
          clearance_submitted: clearanceSubmitted,
          medical_submitted: medicalSubmitted,
          training_completed: trainingCompleted,
          remarks: remarks.trim() || null,
          // A new onboarding record always starts incomplete; checkbox notes
          // are not proof that requested files were submitted and verified.
          completed_at: null,
        })
        .select()
        .single();

      if (onboardingError) {
        console.error(
          "ONBOARDING INSERT ERROR:",
          onboardingError
        );

        setError(
          `Save failed: ${onboardingError.message}`
        );

        setSaving(false);
        return;
      }

      console.log(
        "ONBOARDING CREATED:",
        onboarding
      );

      // ------------------------------------------
      // UPDATE APPLICANT STATUS
      // ------------------------------------------

      const { error: applicantUpdateError } =
        await supabase
          .from("hr1_applicants")
          .update({
            status: "Onboarding",
          })
          .eq("id", applicantId);

      if (applicantUpdateError) {
        console.error(
          "APPLICANT STATUS UPDATE ERROR:",
          applicantUpdateError
        );

        setError(
          `Onboarding was saved, but applicant status could not be updated: ${applicantUpdateError.message}`
        );

        setSaving(false);
        return;
      }

      // ------------------------------------------
      // SUCCESS
      // ------------------------------------------

      router.push("/recruitment-core-hub-dashboard/onboarding");
      router.refresh();
    } catch (err: unknown) {
      console.error("SUBMIT ERROR:", err);
      setError(`An unexpected error occurred: ${err instanceof Error ? err.message : "Unknown error"}`);
      setSaving(false);
    }
  }

  // Calculate live progress for UI polish
  const checklist = [
    sssSubmitted,
    philhealthSubmitted,
    pagibigSubmitted,
    tinSubmitted,
    clearanceSubmitted,
    medicalSubmitted,
    trainingCompleted,
  ];
  const completedCount = checklist.filter(Boolean).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">

      {/* HEADER */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e5167e]/10 text-[#e5167e]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                Human Resource Department
              </span>

              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
                Recruitment & Employee Records
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-slate-100">

            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">
                Super Admin
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Administrator
              </p>
            </div>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#e5167e] to-[#f458ad] text-xs font-bold text-white shadow-sm ring-2 ring-white">
              SA
            </div>

          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 sm:pt-8">

        {/* BACK */}
        <Link
          href="/recruitment-core-hub-dashboard/onboarding"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#e5167e] transition-colors mb-6 group"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Onboarding
        </Link>

        {/* HEADING */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Start New Hire Onboarding
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Create an onboarding record and track the applicant&apos;s requirements.
          </p>
        </div>

        {/* FORM */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-8 space-y-8"
          >

            {/* APPLICANT */}
            <div className="space-y-2">

              <label
                htmlFor="applicant"
                className="block text-xs font-bold text-slate-900 uppercase tracking-wider"
              >
                Select Candidate
              </label>

              {loadingApplicants ? (

                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e5167e] border-t-transparent" />
                  <p className="text-xs text-slate-500 font-medium">
                    Loading applicants...
                  </p>
                </div>

              ) : applicants.length === 0 ? (

                <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-xs font-medium text-amber-800 border border-amber-200/60">
                  <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>No applicants are currently ready for onboarding (must have &ldquo;Interview Passed&rdquo; status).</span>
                </div>

              ) : (

                <div className="relative">
                  <select
                    id="applicant"
                    value={applicantId}
                    onChange={(event) =>
                      setApplicantId(event.target.value)
                    }
                    required
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-800 outline-none transition focus:border-[#e5167e] focus:ring-4 focus:ring-[#e5167e]/10"
                  >

                    <option value="">
                      Select an applicant...
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
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

              )}

            </div>

            {/* PROGRESS BAR INDICATOR */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">Initial Checklist Progress</span>
                <span className="font-bold text-[#e5167e]">{completedCount} of 7 selected ({progressPercent}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-[#e5167e] transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* REQUIREMENTS */}
            <div className="space-y-4">

              <div className="rounded-xl border border-pink-100 bg-pink-50/40 p-4">
                <h3 className="text-sm font-bold text-slate-900">Documents to Request from the Applicant</h3>
                <p className="mt-1 text-xs text-slate-600">Select only documents needed for this hire. These selected items appear on the applicant&apos;s secure onboarding link.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {requestedDocumentOptions.map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
                      <input type="checkbox" checked={requiredDocuments.includes(value)} onChange={(event) => setRequiredDocuments((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} className="accent-[#e5167e]" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Onboarding Requirements
                </h3>

                <p className="text-xs text-slate-500">
                  Legacy HR milestone notes. Uploaded document review is tracked separately in the Applicant Profile.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">

                {/* SSS */}
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                  sssSubmitted
                    ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}>

                  <span className="text-xs font-semibold text-slate-800">
                    SSS Submitted
                  </span>

                  <input
                    type="checkbox"
                    checked={sssSubmitted}
                    onChange={(event) =>
                      setSssSubmitted(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e]"
                  />

                </label>

                {/* PHILHEALTH */}
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                  philhealthSubmitted
                    ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}>

                  <span className="text-xs font-semibold text-slate-800">
                    PhilHealth Submitted
                  </span>

                  <input
                    type="checkbox"
                    checked={philhealthSubmitted}
                    onChange={(event) =>
                      setPhilhealthSubmitted(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e]"
                  />

                </label>

                {/* PAG-IBIG */}
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                  pagibigSubmitted
                    ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}>

                  <span className="text-xs font-semibold text-slate-800">
                    Pag-IBIG Submitted
                  </span>

                  <input
                    type="checkbox"
                    checked={pagibigSubmitted}
                    onChange={(event) =>
                      setPagibigSubmitted(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e]"
                  />

                </label>

                {/* TIN */}
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                  tinSubmitted
                    ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}>

                  <span className="text-xs font-semibold text-slate-800">
                    TIN Submitted
                  </span>

                  <input
                    type="checkbox"
                    checked={tinSubmitted}
                    onChange={(event) =>
                      setTinSubmitted(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e]"
                  />

                </label>

                {/* CLEARANCE */}
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                  clearanceSubmitted
                    ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}>

                  <span className="text-xs font-semibold text-slate-800">
                    Clearance Submitted
                  </span>

                  <input
                    type="checkbox"
                    checked={clearanceSubmitted}
                    onChange={(event) =>
                      setClearanceSubmitted(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e]"
                  />

                </label>

                {/* MEDICAL */}
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                  medicalSubmitted
                    ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}>

                  <span className="text-xs font-semibold text-slate-800">
                    Medical Submitted
                  </span>

                  <input
                    type="checkbox"
                    checked={medicalSubmitted}
                    onChange={(event) =>
                      setMedicalSubmitted(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e]"
                  />

                </label>

                {/* TRAINING */}
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all sm:col-span-2 ${
                  trainingCompleted
                    ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}>

                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-800">
                      Training Completed
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Mandatory orientation and role training program
                    </span>
                  </div>

                  <input
                    type="checkbox"
                    checked={trainingCompleted}
                    onChange={(event) =>
                      setTrainingCompleted(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e]"
                  />

                </label>

              </div>
            </div>

            {/* REMARKS */}
            <div className="space-y-2">

              <label
                htmlFor="remarks"
                className="block text-xs font-bold text-slate-900"
              >
                Remarks & Notes
              </label>

              <textarea
                id="remarks"
                value={remarks}
                onChange={(event) =>
                  setRemarks(event.target.value)
                }
                rows={3}
                placeholder="Enter onboarding notes or remarks..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none transition focus:border-[#e5167e] focus:ring-4 focus:ring-[#e5167e]/10 placeholder:text-slate-400"
              />

            </div>

            {/* STATUS INFORMATION */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">

              <p className="text-xs font-bold text-blue-900">
                Onboarding Status Behavior
              </p>

              <p className="mt-1 text-xs text-blue-700/80 leading-relaxed">
                New onboarding records start as <strong className="font-semibold text-blue-900">In Progress</strong>.
                Once all requirements above are completed, the record will automatically update to <strong className="font-semibold text-blue-900">Completed</strong>.
              </p>

            </div>

            {/* ERROR */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* BUTTONS */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">

              <Link
                href="/recruitment-core-hub-dashboard/onboarding"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={
                  saving ||
                  loadingApplicants ||
                  applicants.length === 0
                }
                className="inline-flex items-center justify-center rounded-xl bg-[#e5167e] px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-[#e5167e]/30 transition hover:bg-[#d8177f] focus:outline-none focus:ring-4 focus:ring-[#e5167e]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Start Onboarding"}
              </button>

            </div>

          </form>

        </div>

      </div>

    </main>
  );
}
