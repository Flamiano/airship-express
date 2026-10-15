"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type JobPosition = {
  id: string;
  title: string;
};

type ApplicantForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  resume_url: string;
  resume_text: string;
  job_position_id: string;
};

type ApplicantDocument = {
  id: string;
  document_type: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  submission_status: string;
  verification_status: string;
  verification_remarks: string | null;
  created_at: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const details = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };

    return [
      details.message,
      details.details,
      details.hint,
      details.code ? `Code: ${details.code}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return String(error || "An unexpected error occurred.");
}

export default function EditApplicantPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const rawId = params?.id;
  const applicantId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ApplicantDocument[]>([]);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentRemarks, setDocumentRemarks] = useState<Record<string, string>>({});
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);

  const [form, setForm] = useState<ApplicantForm>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    resume_url: "",
    resume_text: "",
    job_position_id: "",
  });

  // ==========================================
  // LOAD APPLICANT AND JOB POSITIONS
  // ==========================================

  const loadInitialData = useCallback(async () => {
    if (
      !applicantId ||
      applicantId === "[id]" ||
      applicantId === "%5Bid%5D"
    ) {
      setError("Invalid applicant ID. Please return to the Applicants page.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [applicantRes, positionsRes, documentsRes] = await Promise.all([
        supabase
          .from("hr1_applicants")
          .select(
            `
              id,
              first_name,
              last_name,
              email,
              phone,
              address,
              resume_url,
              resume_text,
              job_position_id
            `
          )
          .eq("id", applicantId)
          .single(),

        supabase
          .from("hr1_job_positions")
          .select("id, title")
          .order("title", { ascending: true }),

        supabase
          .from("hr1_applicant_documents")
          .select("id, document_type, original_filename, storage_path, mime_type, size_bytes, submission_status, verification_status, verification_remarks, created_at")
          .eq("applicant_id", applicantId)
          .order("created_at", { ascending: false }),
      ]);

      if (applicantRes.error) {
        throw new Error(
          `Failed to load candidate: ${applicantRes.error.message}`
        );
      }

      if (positionsRes.error) {
        throw new Error(
          `Failed to load job positions: ${positionsRes.error.message}`
        );
      }

      const applicant = applicantRes.data;

      setJobPositions(positionsRes.data ?? []);
      if (documentsRes.error) {
        setDocuments([]);
        setDocumentError("Could not load document records. Apply the HR1 private documents migration, then refresh.");
      } else {
        setDocuments((documentsRes.data ?? []) as ApplicantDocument[]);
        setDocumentError(null);
      }

      setForm({
        first_name: applicant.first_name ?? "",
        last_name: applicant.last_name ?? "",
        email: applicant.email ?? "",
        phone: applicant.phone ?? "",
        address: applicant.address ?? "",
        resume_url: applicant.resume_url ?? "",
        resume_text: applicant.resume_text ?? "",
        job_position_id: applicant.job_position_id ?? "",
      });
    } catch (err: unknown) {
      console.error("EDIT APPLICANT LOAD ERROR:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [applicantId, supabase]);

  async function reviewDocument(document: ApplicantDocument, action: "verify" | "reject" | "resubmit") {
    const remarks = documentRemarks[document.id]?.trim() ?? "";
    if (action !== "verify" && !remarks) {
      setDocumentError("Add a review remark before rejecting or requesting resubmission.");
      return;
    }

    setSavingDocumentId(document.id);
    setDocumentError(null);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Your HR session has expired. Sign in again.");

      const { error: updateError } = await supabase
        .from("hr1_applicant_documents")
        .update({
          verification_status: action === "verify" ? "Verified" : "Rejected",
          submission_status: action === "resubmit" ? "Resubmission Required" : "Submitted",
          verification_remarks: remarks || null,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", document.id)
        .eq("applicant_id", applicantId);
      if (updateError) throw updateError;
      await loadInitialData();
    } catch (reviewError: unknown) {
      setDocumentError(getErrorMessage(reviewError));
    } finally {
      setSavingDocumentId(null);
    }
  }

  useEffect(() => {
    // The initial Supabase read hydrates this page after the component mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInitialData();
  }, [loadInitialData]);

  // ==========================================
  // FORM INPUTS
  // ==========================================

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // ==========================================
  // RESUME UPLOAD
  // ==========================================

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !applicantId) return;

    setError(null);

    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (!allowedExtensions.includes(extension)) {
      setError("Please upload a PDF, DOC, or DOCX resume.");
      event.target.value = "";
      return;
    }

    // 5 MB maximum
    if (file.size > 5 * 1024 * 1024) {
      setError("The resume file must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    setUploadingResume(true);

    try {
      const filePath = `applicants/${applicantId}-${crypto.randomUUID()}${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, {
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: metadataError } = await supabase
        .from("hr1_applicant_documents")
        .insert({
          applicant_id: applicantId,
          document_type: "resume",
          original_filename: file.name.slice(0, 255),
          storage_path: filePath,
          mime_type: file.type || (extension === ".pdf" ? "application/pdf" : "application/octet-stream"),
          size_bytes: file.size,
          submission_status: "Submitted",
          verification_status: "Pending Verification",
        });

      if (metadataError) {
        await supabase.storage.from("resumes").remove([filePath]);
        throw metadataError;
      }

      setForm((previous) => ({
        ...previous,
        // Store only the private bucket path in PostgreSQL.
        resume_url: filePath,
      }));
    } catch (err: unknown) {
      console.error("RESUME UPLOAD ERROR:", err);
      setError(`Resume upload failed: ${getErrorMessage(err)}`);
    } finally {
      setUploadingResume(false);
      event.target.value = "";
    }
  }

  // ==========================================
  // SAVE APPLICANT
  // ==========================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!applicantId) {
      setError("Applicant ID is missing.");
      return;
    }

    if (!form.job_position_id) {
      setError("Please select a job position.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from("hr1_applicants")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim() || null,
          resume_url: form.resume_url.trim() || null,
          resume_text: form.resume_text.trim() || null,
          job_position_id: form.job_position_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicantId)
        .select("id");

      if (updateError) {
        throw updateError;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "The applicant was not updated. Check your account permissions and database policies."
        );
      }

      // Activity logging is optional here because the shared database
      // may not have the old applicant_activity_logs table.
      // Do not fail a successful update because of a separate log insert.

      router.push("/recruitment-core-hub-dashboard/applicants");
      router.refresh();
    } catch (err: unknown) {
      console.error("APPLICANT UPDATE ERROR:", err);
      setError(`Save failed: ${getErrorMessage(err)}`);
      setSaving(false);
    }
  }

  // ==========================================
  // LOADING VIEW
  // ==========================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4">
        <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-[#e5167e]" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Loading applicant details
            </p>
            <p className="text-xs text-gray-500">Please wait a moment...</p>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // EDIT FORM
  // ==========================================

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-16">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <Link
              href="/recruitment-core-hub-dashboard/applicants"
              className="text-xs font-semibold text-gray-500 transition hover:text-[#e5167e]"
            >
              ← Back to Applicants
            </Link>
            <h1 className="mt-1 text-xl font-black text-[#121212]">
              Edit Applicant Profile
            </h1>
          </div>

          <span className="rounded-full bg-[#e5167e]/10 px-3 py-1 text-xs font-bold text-[#e5167e]">
            ID: {applicantId?.slice(0, 8)}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <p className="mb-6 text-sm text-gray-500">
          Update the applicant&apos;s contact information, applied position,
          and resume records.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <span className="break-words">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8"
        >
          {/* Personal Information */}
          <section>
            <div className="mb-5 border-b border-gray-100 pb-3">
              <h2 className="font-bold text-[#121212]">
                Personal Information
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Applicant identification and contact details.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="first_name"
                  className="mb-1.5 block text-xs font-semibold text-gray-700"
                >
                  First Name *
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="mb-1.5 block text-xs font-semibold text-gray-700"
                >
                  Last Name *
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold text-gray-700"
                >
                  Email Address *
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-1.5 block text-xs font-semibold text-gray-700"
                >
                  Phone Number *
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
                />
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="address"
                className="mb-1.5 block text-xs font-semibold text-gray-700"
              >
                Residential Address
              </label>
              <textarea
                id="address"
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={3}
                placeholder="Enter street, city, or region"
                className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
              />
            </div>
          </section>

          {/* Job Position */}
          <section>
            <div className="mb-5 border-b border-gray-100 pb-3">
              <h2 className="font-bold text-[#121212]">Applied Position</h2>
              <p className="mt-1 text-xs text-gray-500">
                Select the job opening associated with this applicant.
              </p>
            </div>

            <label
              htmlFor="job_position_id"
              className="mb-1.5 block text-xs font-semibold text-gray-700"
            >
              Job Position *
            </label>

            <select
              id="job_position_id"
              name="job_position_id"
              value={form.job_position_id}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
            >
              <option value="">Select a job position</option>
              {jobPositions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title}
                </option>
              ))}
            </select>

            {jobPositions.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                No job positions were returned. Check that job positions
                exist and that your HR account has permission to view them.
              </p>
            )}
          </section>

          {/* Resume */}
          <section>
            <div className="mb-5 border-b border-gray-100 pb-3">
              <h2 className="font-bold text-[#121212]">Resume Information</h2>
              <p className="mt-1 text-xs text-gray-500">
                Update the applicant&apos;s resume file or extracted text.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4">
              <label
                htmlFor="resume_file"
                className="mb-2 block text-xs font-semibold text-gray-700"
              >
                Upload Resume (PDF, DOC, or DOCX; maximum 5 MB)
              </label>

              <input
                id="resume_file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
                disabled={uploadingResume}
                className="w-full text-xs text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#e5167e]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#e5167e] disabled:opacity-50"
              />

              {uploadingResume && (
                <p className="mt-2 text-xs text-amber-700">
                  Uploading resume...
                </p>
              )}
            </div>

            <div className="mt-5">
              <p className="mb-2 block text-xs font-semibold text-gray-700">
                Private resume file
              </p>
              {form.resume_url ? (
                <div className="flex flex-wrap gap-3 text-xs font-semibold">
                  <a
                    href={`/api/hr1/applicants/${applicantId}/resume`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Preview resume
                  </a>
                  <a
                    href={`/api/hr1/applicants/${applicantId}/resume?download=1`}
                    className="text-blue-600 hover:underline"
                  >
                    Download resume
                  </a>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No resume has been uploaded.</p>
              )}
            </div>

            <div className="mt-5">
              <label
                htmlFor="resume_text"
                className="mb-1.5 block text-xs font-semibold text-gray-700"
              >
                Extracted Resume Text
              </label>
              <p className="mb-2 text-xs text-gray-500">
                This text can be used by AI-assisted screening to compare
                the resume with the job requirements.
              </p>
              <textarea
                id="resume_text"
                name="resume_text"
                value={form.resume_text}
                onChange={handleChange}
                rows={8}
                placeholder="Paste or enter the extracted resume text here..."
                className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm text-gray-800 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
              />
            </div>
          </section>

          {/* Applicant documents */}
          <section>
            <div className="mb-5 border-b border-gray-100 pb-3">
              <h2 className="font-bold text-[#121212]">Applicant Documents</h2>
              <p className="mt-1 text-xs text-gray-500">
                Review private files, verify requirements, or request a corrected submission.
              </p>
            </div>

            {documentError && (
              <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {documentError}
              </p>
            )}

            {documents.length === 0 ? (
              <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                No document records are available for this applicant yet.
              </p>
            ) : (
              <div className="space-y-4">
                {documents.map((document) => (
                  <article key={document.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{document.original_filename}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {document.document_type} · {document.mime_type} · {(document.size_bytes / 1024).toFixed(0)} KB · {new Date(document.created_at).toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          {document.submission_status} · {document.verification_status}
                          {document.verification_remarks ? ` · ${document.verification_remarks}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-3 text-xs font-semibold">
                        <a href={`/api/hr1/applicants/${applicantId}/resume?document=${encodeURIComponent(document.id)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Preview</a>
                        <a href={`/api/hr1/applicants/${applicantId}/resume?document=${encodeURIComponent(document.id)}&download=1`} className="text-blue-600 hover:underline">Download</a>
                      </div>
                    </div>
                    <label className="mt-4 block text-xs font-semibold text-gray-700" htmlFor={`document-remarks-${document.id}`}>Review remarks</label>
                    <textarea
                      id={`document-remarks-${document.id}`}
                      value={documentRemarks[document.id] ?? document.verification_remarks ?? ""}
                      onChange={(event) => setDocumentRemarks((current) => ({ ...current, [document.id]: event.target.value }))}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#e5167e]"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={savingDocumentId === document.id} onClick={() => void reviewDocument(document, "verify")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Verify</button>
                      <button type="button" disabled={savingDocumentId === document.id} onClick={() => void reviewDocument(document, "reject")} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button>
                      <button type="button" disabled={savingDocumentId === document.id} onClick={() => void reviewDocument(document, "resubmit")} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Request resubmission</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Buttons */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.push("/recruitment-core-hub-dashboard/applicants")}
              disabled={saving || uploadingResume}
              className="rounded-xl border border-gray-200 px-5 py-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || uploadingResume}
              className="rounded-xl bg-[#e5167e] px-6 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#b3115f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving Changes..."
                : uploadingResume
                  ? "Uploading Resume..."
                  : "Save Profile Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
