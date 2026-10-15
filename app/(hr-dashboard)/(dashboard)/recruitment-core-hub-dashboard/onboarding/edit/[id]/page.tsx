"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Onboarding = {
  id: string;
  applicant_id: string;
  sss_submitted: boolean;
  philhealth_submitted: boolean;
  pagibig_submitted: boolean;
  tin_submitted: boolean;
  clearance_submitted: boolean;
  medical_submitted: boolean;
  training_completed: boolean;
  remarks: string | null;
  completed_at: string | null;
  required_documents: string[];
  background_information: Record<string, string> | null;
};

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type OnboardingDocument = {
  id: string;
  document_type: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  submission_status: string;
  verification_status: string;
  verification_remarks: string | null;
  created_at: string;
};

const DOCUMENT_LABELS: Record<string, string> = {
  government_id: "Government ID", diploma: "Diploma / Certificate of Graduation",
  academic_record: "Transcript / Academic Record", sss: "SSS Document",
  philhealth: "PhilHealth Document", pagibig: "Pag-IBIG Document", tin: "TIN Document",
  clearance: "Clearance", medical: "Medical Document", other_certificate: "Other Requested Document",
};

export default function EditOnboardingPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  const onboardingId = params.id as string;

  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [onboardingDocuments, setOnboardingDocuments] = useState<OnboardingDocument[]>([]);
  const [documentLoadError, setDocumentLoadError] = useState("");
  const [onboardingLink, setOnboardingLink] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [sssSubmitted, setSssSubmitted] = useState(false);
  const [philhealthSubmitted, setPhilhealthSubmitted] = useState(false);
  const [pagibigSubmitted, setPagibigSubmitted] = useState(false);
  const [tinSubmitted, setTinSubmitted] = useState(false);
  const [clearanceSubmitted, setClearanceSubmitted] = useState(false);
  const [medicalSubmitted, setMedicalSubmitted] = useState(false);
  const [trainingCompleted, setTrainingCompleted] = useState(false);

  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOnboarding() {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("hr1_onboardings")
          .select(`
            id,
            applicant_id,
            sss_submitted,
            philhealth_submitted,
            pagibig_submitted,
            tin_submitted,
            clearance_submitted,
            medical_submitted,
            training_completed,
            remarks,
            completed_at,
            required_documents,
            background_information,
            applicants:hr1_applicants (
              id,
              first_name,
              last_name,
              email
            )
          `)
          .eq("id", onboardingId)
          .single();

        if (error) {
          console.error("ONBOARDING LOAD ERROR:", error);
          setError(`Unable to load onboarding: ${error.message}`);
          setLoading(false);
          return;
        }

        console.log("ONBOARDING FROM SUPABASE:", data);

        const onboardingData = data as unknown as Onboarding & {
          applicants: Applicant | null;
        };

        setOnboarding(onboardingData);
        setApplicant(onboardingData.applicants);
        setRequiredDocuments(Array.isArray(onboardingData.required_documents) ? onboardingData.required_documents : []);

        const { data: documentRows, error: documentQueryError } = await supabase.from("hr1_applicant_documents")
          .select("id, document_type, original_filename, mime_type, size_bytes, submission_status, verification_status, verification_remarks, created_at")
          .eq("onboarding_id", onboardingId).order("created_at", { ascending: false });
        if (documentQueryError) setDocumentLoadError(`Onboarding file records are unavailable. Apply the HR1 onboarding SQL migration first. (${documentQueryError.message})`);
        else setDocumentLoadError("");
        setOnboardingDocuments((documentRows ?? []) as OnboardingDocument[]);

        setSssSubmitted(onboardingData.sss_submitted);
        setPhilhealthSubmitted(onboardingData.philhealth_submitted);
        setPagibigSubmitted(onboardingData.pagibig_submitted);
        setTinSubmitted(onboardingData.tin_submitted);
        setClearanceSubmitted(onboardingData.clearance_submitted);
        setMedicalSubmitted(onboardingData.medical_submitted);
        setTrainingCompleted(onboardingData.training_completed);

        setRemarks(onboardingData.remarks || "");
      } catch (err: unknown) {
        console.error("ONBOARDING CATCH ERROR:", err);
        setError(`An unexpected error occurred: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    }

    if (onboardingId) {
      loadOnboarding();
    }
  }, [onboardingId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    try {
      const latestByType = new Map<string, OnboardingDocument>();
      for (const document of onboardingDocuments) {
        if (!latestByType.has(document.document_type)) latestByType.set(document.document_type, document);
      }
      const allCompleted = requiredDocuments.length > 0
        && requiredDocuments.every((type) => latestByType.get(type)?.verification_status === "Verified")
        && trainingCompleted;

      const { error: updateError } = await supabase
        .from("hr1_onboardings")
        .update({
          sss_submitted: sssSubmitted,
          philhealth_submitted: philhealthSubmitted,
          pagibig_submitted: pagibigSubmitted,
          tin_submitted: tinSubmitted,
          clearance_submitted: clearanceSubmitted,
          medical_submitted: medicalSubmitted,
          training_completed: trainingCompleted,
          required_documents: requiredDocuments,
          remarks: remarks.trim() || null,
          completed_at: allCompleted
            ? onboarding?.completed_at || new Date().toISOString()
            : null,
        })
        .eq("id", onboardingId);

      if (updateError) {
        console.error("ONBOARDING UPDATE ERROR:", updateError);
        setError(`Update failed: ${updateError.message}`);
        setSaving(false);
        return;
      }

      if (onboarding?.applicant_id) {
        const { error: applicantError } = await supabase
          .from("hr1_applicants")
          .update({
            // Onboarding checklist flags are not a hiring decision. The
            // applicant becomes Hired only when HR records that decision.
            status: "Onboarding",
          })
          .eq("id", onboarding.applicant_id);

        if (applicantError) {
          console.error("APPLICANT STATUS UPDATE ERROR:", applicantError);
          setError(
            `Onboarding was updated, but applicant status could not be updated: ${applicantError.message}`
          );
          setSaving(false);
          return;
        }
      }

      console.log("ONBOARDING UPDATED SUCCESSFULLY");
      router.push("/recruitment-core-hub-dashboard/onboarding");
      router.refresh();
    } catch (err: unknown) {
      console.error("ONBOARDING SUBMIT CATCH ERROR:", err);
      setError(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
    }
  }

  async function createApplicantLink() {
    setCreatingInvite(true);
    setInviteMessage("");
    try {
      const response = await fetch(`/api/hr1/onboarding/${onboardingId}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valid_days: 7, required_documents: requiredDocuments }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create an onboarding link.");
      setOnboardingLink(result.url);
      setInviteMessage(result.email_sent ? `Secure link emailed to ${applicant?.email}. It expires ${new Date(result.expires_at).toLocaleString()}.` : `Email was not sent. Copy the secure link and send it privately to ${applicant?.email}. It expires ${new Date(result.expires_at).toLocaleString()}.`);
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : "Could not create an onboarding link.");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function copyApplicantLink() {
    try {
      await navigator.clipboard.writeText(onboardingLink);
      setInviteMessage("Secure link copied. Send it privately to the applicant.");
    } catch {
      setInviteMessage("Copy failed. Select and copy the link manually.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this onboarding record?"
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("hr1_onboardings")
        .delete()
        .eq("id", onboardingId);

      if (deleteError) {
        console.error("ONBOARDING DELETE ERROR:", deleteError);
        setError(`Delete failed: ${deleteError.message}`);
        setDeleting(false);
        return;
      }

      if (onboarding?.applicant_id) {
        const { error: applicantError } = await supabase
          .from("hr1_applicants")
          .update({
            status: "Interview Passed",
          })
          .eq("id", onboarding.applicant_id);

        if (applicantError) {
          console.error("APPLICANT STATUS RESET ERROR:", applicantError);
        }
      }

      router.push("/recruitment-core-hub-dashboard/onboarding");
      router.refresh();
    } catch (err: unknown) {
      console.error("ONBOARDING DELETE CATCH ERROR:", err);
      setError(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
      setDeleting(false);
    }
  }

  const latestByType = new Map<string, OnboardingDocument>();
  for (const document of onboardingDocuments) {
    if (!latestByType.has(document.document_type)) latestByType.set(document.document_type, document);
  }
  const verifiedDocumentCount = requiredDocuments.filter((type) => latestByType.get(type)?.verification_status === "Verified").length;
  const completionTotal = requiredDocuments.length + 1;
  const completedCount = verifiedDocumentCount + (trainingCompleted ? 1 : 0);
  const progressPercent = requiredDocuments.length ? Math.round((completedCount / completionTotal) * 100) : 0;
  const isAllCompleted = requiredDocuments.length > 0 && completedCount === completionTotal;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div className="absolute h-12 w-12 animate-ping rounded-full bg-[#e5167e]/20 opacity-75" />
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#e5167e] border-t-transparent" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">Loading onboarding details</p>
            <p className="text-xs text-slate-500 mt-0.5">Please wait while we fetch the candidate records...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!onboarding) {
    return (
      <main className="min-h-screen bg-[#F8FAFC]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-8 ring-red-50/50">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg sm:text-xl font-bold text-slate-900">
              Record Not Found
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              The onboarding record you are trying to edit does not exist or was removed.
            </p>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200 max-w-md mx-auto">
                {error}
              </div>
            )}

            <div className="mt-6">
              <Link
                href="/recruitment-core-hub-dashboard/onboarding"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                ← Return to Onboarding
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">
      <header className="sticky top-0 z-25 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
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

      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 sm:pt-8">
        <Link
          href="/recruitment-core-hub-dashboard/onboarding"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#e5167e] transition-colors mb-6 group"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Onboarding Overview
        </Link>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Edit Onboarding Record
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage status and requirements for this candidate.
            </p>
          </div>

          <div>
            {isAllCompleted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                In Progress
              </span>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 font-bold text-base shadow-xs">
                {applicant ? `${applicant.first_name[0]}${applicant.last_name[0]}` : "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Target Applicant
                </p>
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {applicant ? `${applicant.first_name} ${applicant.last_name}` : "Unknown Applicant"}
                </h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {applicant?.email || "No email available"}
                </p>
              </div>
            </div>

            <section className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Background Investigation Details</h3>
                <p className="mt-1 text-xs text-slate-500">Personal information submitted by the applicant through the private onboarding link.</p>
              </div>
              {onboarding.background_information && Object.keys(onboarding.background_information).length > 0 ? (
                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["surname", "Surname"], ["given_name", "Given name"], ["middle_name", "Complete middle name"], ["name_suffix", "Suffix"],
                    ["civil_status", "Civil status"], ["gender", "Gender"], ["birth_date", "Birth date"],
                    ["contact_number", "Contact number"], ["sss_number", "SSS number"],
                    ["philhealth_number", "PhilHealth number"], ["pagibig_number", "Pag-IBIG number"],
                    ["tin_number", "Tax identification number"], ["current_address", "Current address"],
                    ["permanent_address", "Permanent address"],
                  ].map(([key, label]) => (
                    <div key={key} className={key.endsWith("address") ? "sm:col-span-2" : ""}>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                      <dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-800">{onboarding.background_information?.[key] || "—"}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">The applicant has not submitted the background investigation form yet.</p>
              )}
            </section>

            <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/30 p-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">Verified onboarding progress</span>
                <span className="font-bold text-[#e5167e]">{completedCount} of {completionTotal} complete ({progressPercent}%)</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
                <div
                  className="h-full rounded-full bg-[#e5167e] transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <section className="space-y-4 rounded-xl border border-pink-100 bg-pink-50/30 p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Applicant Onboarding Link</h3>
                <p className="mt-1 text-xs text-slate-600">Email a private link for the background investigation form and selected requirements. It expires after seven days; a new link replaces the previous one. Files are stored privately and need HR verification.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(DOCUMENT_LABELS).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
                    <input type="checkbox" checked={requiredDocuments.includes(value)} onChange={(event) => setRequiredDocuments((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} className="accent-[#e5167e]" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void createApplicantLink()} disabled={creatingInvite || !applicant?.email || requiredDocuments.length === 0} className="rounded-lg bg-[#e5167e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {creatingInvite ? "Creating link…" : "Generate secure link"}
                </button>
                {!applicant?.email && <span className="text-xs text-rose-700">Applicant email is required before a link can be sent.</span>}
                {requiredDocuments.length === 0 && <span className="text-xs text-slate-500">Select at least one requested document.</span>}
              </div>
              {inviteMessage && <p role="status" className="text-xs text-slate-700">{inviteMessage}</p>}
              {onboardingLink && <div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={onboardingLink} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" aria-label="Secure applicant onboarding link" /><button type="button" onClick={() => void copyApplicantLink()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold">Copy link</button></div>}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div><h3 className="text-sm font-bold text-slate-900">Submitted onboarding files</h3><p className="text-xs text-slate-500">Files uploaded with the secure applicant link. Verify or request resubmission in Applicant Profile.</p></div>
                {applicant && <Link className="text-xs font-semibold text-pink-600 hover:underline" href={`/recruitment-core-hub-dashboard/applicants/${applicant.id}/edit`}>Open Applicant Profile</Link>}
              </div>
              {documentLoadError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{documentLoadError}</p>}
              {onboardingDocuments.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No onboarding files have been submitted yet.</p> : onboardingDocuments.map((document) => (
                <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-900">{DOCUMENT_LABELS[document.document_type] ?? document.document_type}: {document.original_filename}</p><p className="mt-1 text-[11px] text-slate-500">{document.submission_status} · {document.verification_status} · {(document.size_bytes / 1024).toFixed(0)} KB · {new Date(document.created_at).toLocaleDateString()}</p>{document.verification_remarks && <p className="mt-1 text-[11px] text-amber-800">HR note: {document.verification_remarks}</p>}</div>
                  <div className="flex gap-3 text-xs"><a className="text-blue-600 hover:underline" href={`/api/hr1/applicants/${applicant?.id}/resume?document=${encodeURIComponent(document.id)}`} target="_blank" rel="noreferrer">Preview</a><a className="text-blue-600 hover:underline" href={`/api/hr1/applicants/${applicant?.id}/resume?document=${encodeURIComponent(document.id)}&download=1`}>Download</a></div>
                </article>
              ))}
            </section>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Requirements Checklist
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  These legacy checklist fields are HR progress notes. Review actual uploaded files in the Applicant Profile; checking every box does not record a hiring decision.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                    sssSubmitted
                      ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-800">
                    SSS Submitted
                  </span>
                  <input
                    type="checkbox"
                    checked={sssSubmitted}
                    onChange={(e) => setSssSubmitted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e] cursor-pointer"
                  />
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                    philhealthSubmitted
                      ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-800">
                    PhilHealth Submitted
                  </span>
                  <input
                    type="checkbox"
                    checked={philhealthSubmitted}
                    onChange={(e) => setPhilhealthSubmitted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e] cursor-pointer"
                  />
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                    pagibigSubmitted
                      ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-800">
                    Pag-IBIG Submitted
                  </span>
                  <input
                    type="checkbox"
                    checked={pagibigSubmitted}
                    onChange={(e) => setPagibigSubmitted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e] cursor-pointer"
                  />
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                    tinSubmitted
                      ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-800">
                    TIN Submitted
                  </span>
                  <input
                    type="checkbox"
                    checked={tinSubmitted}
                    onChange={(e) => setTinSubmitted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e] cursor-pointer"
                  />
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                    clearanceSubmitted
                      ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-800">
                    Clearance Submitted
                  </span>
                  <input
                    type="checkbox"
                    checked={clearanceSubmitted}
                    onChange={(e) => setClearanceSubmitted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e] cursor-pointer"
                  />
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                    medicalSubmitted
                      ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-800">
                    Medical Submitted
                  </span>
                  <input
                    type="checkbox"
                    checked={medicalSubmitted}
                    onChange={(e) => setMedicalSubmitted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e] cursor-pointer"
                  />
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all sm:col-span-2 ${
                    trainingCompleted
                      ? "border-[#e5167e]/40 bg-[#e5167e]/[0.02] shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex flex-col pr-4">
                    <span className="text-xs font-semibold text-slate-800">
                      Training Completed
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Mandatory orientation and role training program
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={trainingCompleted}
                    onChange={(e) => setTrainingCompleted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#e5167e] focus:ring-[#e5167e]/20 accent-[#e5167e] cursor-pointer shrink-0"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="remarks" className="block text-xs font-bold text-slate-900">
                Notes & Remarks
              </label>
              <textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Add any additional notes, missing doc details, or observations..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none transition focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/10 placeholder:text-slate-400 resize-y"
              />
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-6 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting Record..." : "Delete Onboarding"}
              </button>

              <div className="flex items-center gap-2.5">
                <Link
                  href="/recruitment-core-hub-dashboard/onboarding"
                  className="inline-flex flex-1 sm:flex-initial items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={saving || deleting}
                  className="inline-flex flex-1 sm:flex-initial items-center justify-center rounded-xl bg-[#e5167e] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#d8177f] focus:ring-4 focus:ring-[#e5167e]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
