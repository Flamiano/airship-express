
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type JobPosition = {
  id: string;
  title: string;
  department: string;
};

type DuplicateWarning = {
  existingId: string;
  message: string;
};

type UploadedResume = {
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const details = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
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

  return String(error || "Unexpected error");
}

export default function NewApplicantPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] =
    useState<DuplicateWarning | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [jobPositionId, setJobPositionId] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [uploadedResume, setUploadedResume] = useState<UploadedResume | null>(null);

  // ==========================================
  // LOAD OPEN JOB POSITIONS
  // ==========================================

  const loadPositions = useCallback(async () => {
    setLoadingPositions(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("hr1_job_positions")
        .select("id, title, department")
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (fetchError) throw fetchError;

      setPositions((data ?? []) as JobPosition[]);
    } catch (err: unknown) {
      console.error("JOB POSITION LOAD ERROR:", err);
      setError(`Unable to load open positions: ${getErrorMessage(err)}`);
    } finally {
      setLoadingPositions(false);
    }
  }, [supabase]);

  useEffect(() => {
    // The initial Supabase read hydrates this page after the component mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPositions();
  }, [loadPositions]);

  // ==========================================
  // UPLOAD RESUME
  // ==========================================

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError(null);

    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const allowedExtensions = [".pdf", ".doc", ".docx"];

    if (!allowedExtensions.includes(extension)) {
      setError("Please upload a PDF, DOC, or DOCX resume.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The resume file must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    setUploadingResume(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please log in using your HR account first.");
      }

      const filePath = `applicants/${crypto.randomUUID()}${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, {
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Store only the private bucket path in PostgreSQL, never a public URL.
      setResumeUrl(filePath);
      setUploadedResume({
        storagePath: filePath,
        originalFilename: file.name.slice(0, 255),
        mimeType: file.type,
        sizeBytes: file.size,
      });
    } catch (err: unknown) {
      console.error("RESUME UPLOAD ERROR:", err);
      setError(`File upload failed: ${getErrorMessage(err)}`);
    } finally {
      setUploadingResume(false);
      event.target.value = "";
    }
  }

  // ==========================================
  // CHECK FOR DUPLICATE APPLICANTS
  // ==========================================

  async function findDuplicate(
    cleanEmail: string,
    cleanPhone: string
  ): Promise<DuplicateWarning | null> {
    // Query by email separately to avoid unsafe filter-string construction.
    const { data: emailMatch, error: emailError } = await supabase
      .from("hr1_applicants")
      .select("id, first_name, last_name")
      .eq("email", cleanEmail)
      .limit(1);

    if (emailError) throw emailError;

    if (emailMatch?.length) {
      const match = emailMatch[0];

      return {
        existingId: match.id,
        message: `A candidate (${match.first_name} ${match.last_name}) with this email address already exists.`,
      };
    }

    const { data: phoneMatch, error: phoneError } = await supabase
      .from("hr1_applicants")
      .select("id, first_name, last_name")
      .eq("phone", cleanPhone)
      .limit(1);

    if (phoneError) throw phoneError;

    if (phoneMatch?.length) {
      const match = phoneMatch[0];

      return {
        existingId: match.id,
        message: `A candidate (${match.first_name} ${match.last_name}) with this phone number already exists.`,
      };
    }

    return null;
  }

  // ==========================================
  // SAVE NEW APPLICANT
  // ==========================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || uploadingResume) return;

    setSaving(true);
    setError(null);
    setDuplicateWarning(null);

    try {
      if (!jobPositionId) {
        throw new Error("Please select an open job position.");
      }

      const cleanFirstName = firstName.trim();
      const cleanLastName = lastName.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim();

      if (!cleanFirstName || !cleanLastName || !cleanEmail || !cleanPhone) {
        throw new Error("Please complete all required applicant fields.");
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("You must be logged in with your HR account.");
      }

      // Check for an existing applicant.
      const duplicate = await findDuplicate(cleanEmail, cleanPhone);

      if (duplicate) {
        setDuplicateWarning(duplicate);
        return;
      }

      // Insert into the shared Whole-HR database.
      const { data: insertedApplicant, error: insertError } = await supabase
        .from("hr1_applicants")
        .insert({
          job_position_id: jobPositionId,
          first_name: cleanFirstName,
          last_name: cleanLastName,
          email: cleanEmail,
          phone: cleanPhone,
          address: address.trim() || null,
          resume_url: resumeUrl.trim() || null,
          resume_text: resumeText.trim() || null,
          encoded_by: authData.user.id,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      if (uploadedResume && insertedApplicant) {
        const { error: metadataError } = await supabase
          .from("hr1_applicant_documents")
          .insert({
            applicant_id: insertedApplicant.id,
            document_type: "resume",
            original_filename: uploadedResume.originalFilename,
            storage_path: uploadedResume.storagePath,
            mime_type: uploadedResume.mimeType,
            size_bytes: uploadedResume.sizeBytes,
            submission_status: "Submitted",
            verification_status: "Pending Verification",
          });

        if (metadataError) {
          await supabase.from("hr1_applicants").delete().eq("id", insertedApplicant.id);
          await supabase.storage.from("resumes").remove([uploadedResume.storagePath]);
          throw metadataError;
        }
      }

      // Activity logging is intentionally omitted because the shared
      // HR1 schema has not been confirmed to contain applicant_activity_logs.
      // The applicant record is saved directly to hr1_applicants.

      router.push("/recruitment-core-hub-dashboard/applicants");
      router.refresh();
    } catch (err: unknown) {
      console.error("APPLICANT INSERT ERROR:", err);
      setError(`Save failed: ${getErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-16">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl flex-col justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Link
              href="/recruitment-core-hub-dashboard/applicants"
              className="transition hover:text-[#e5167e]"
            >
              Applicants
            </Link>
            <span>/</span>
            <span className="text-gray-900">New Applicant</span>
          </div>

          <span className="self-start rounded-full bg-[#e5167e]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#e5167e] sm:self-auto">
            HR Recruitment
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-[#121212]">
            Add New Applicant
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Encode a new candidate profile into the HR recruitment records.
          </p>
        </div>

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

        {duplicateWarning && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <h2 className="font-bold">Duplicate Candidate Detected</h2>
            <p className="mt-2">{duplicateWarning.message}</p>
            <Link
                  href={`/recruitment-core-hub-dashboard/applicants/${duplicateWarning.existingId}/edit`}
              className="mt-3 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
            >
              View / Edit Existing Profile →
            </Link>
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
                Essential identification and contact details.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="firstName"
                  className="mb-1.5 block text-xs font-semibold text-gray-700"
                >
                  First Name *
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="mb-1.5 block text-xs font-semibold text-gray-700"
                >
                  Last Name *
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
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
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                rows={3}
                placeholder="Enter street name, city, or region"
                className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
              />
            </div>
          </section>

          {/* Job Position */}
          <section>
            <div className="mb-5 border-b border-gray-100 pb-3">
              <h2 className="font-bold text-[#121212]">Role Association</h2>
              <p className="mt-1 text-xs text-gray-500">
                Select the opening associated with this applicant.
              </p>
            </div>

            <label
              htmlFor="jobPositionId"
              className="mb-1.5 block text-xs font-semibold text-gray-700"
            >
              Applied Position *
            </label>

            <select
              id="jobPositionId"
              value={jobPositionId}
              onChange={(event) => setJobPositionId(event.target.value)}
              required
              disabled={loadingPositions || positions.length === 0}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15 disabled:opacity-60"
            >
              <option value="">
                {loadingPositions
                  ? "Loading open positions..."
                  : positions.length === 0
                    ? "No open positions available"
                    : "Select a position"}
              </option>

              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title} — {position.department}
                </option>
              ))}
            </select>

            {!loadingPositions && positions.length === 0 && (
              <button
                type="button"
                onClick={() => void loadPositions()}
                className="mt-2 text-xs font-semibold text-[#e5167e] hover:underline"
              >
                Reload job positions
              </button>
            )}
          </section>

          {/* Resume */}
          <section>
            <div className="mb-5 border-b border-gray-100 pb-3">
              <h2 className="font-bold text-[#121212]">
                Resume & Evaluation Data
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Upload the resume or enter its extracted text.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4">
                <label
                  htmlFor="resumeFile"
                  className="mb-2 block text-xs font-semibold text-gray-700"
                >
                  Upload Resume
                </label>
                <p className="mb-3 text-xs text-gray-500">
                  PDF, DOC, or DOCX — maximum 5 MB.
                </p>
                <input
                  id="resumeFile"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={uploadingResume}
                  className="w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#e5167e]/10 file:px-3 file:py-2.5 file:font-semibold file:text-[#e5167e] disabled:opacity-50"
                />
                {uploadingResume && (
                  <p className="mt-2 text-xs text-amber-700">
                    Uploading resume...
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="resumeUrl"
                  className="mb-2 block text-xs font-semibold text-gray-700"
                >
                  Resume URL
                </label>
                <input
                  id="resumeUrl"
                  type="url"
                  value={resumeUrl}
                  onChange={(event) => setResumeUrl(event.target.value)}
                  placeholder="https://example.com/resume.pdf"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
                />
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="resumeText"
                className="mb-2 block text-xs font-semibold text-gray-700"
              >
                Extracted Resume Text
              </label>
              <p className="mb-2 text-xs text-gray-500">
                The AI screening feature can compare this text with the
                selected job&apos;s requirements. HR makes the final decision.
              </p>
              <textarea
                id="resumeText"
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                rows={7}
                placeholder="Paste or enter the extracted resume text here..."
                className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm text-gray-800 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15"
              />
            </div>
          </section>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/recruitment-core-hub-dashboard/applicants"
              className="rounded-xl border border-gray-200 px-5 py-3 text-center text-xs font-bold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={
                saving ||
                loadingPositions ||
                uploadingResume ||
                positions.length === 0
              }
              className="rounded-xl bg-[#e5167e] px-6 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#b3115f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving Applicant..."
                : uploadingResume
                  ? "Uploading Resume..."
                  : "Save Applicant"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
