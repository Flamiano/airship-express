"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type JobPosition = {
  id: string;
  title: string;
};

export default function ApplyPage() {
  const supabase = createClient();

  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [form, setForm] = useState({
    job_position_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadPositions();
  }, []);

  async function loadPositions() {
    setLoadingPositions(true);
    setError(null);

    try {
      // Fixed: table name updated from job_positions to hr1_job_positions
      const { data, error: fetchError } = await supabase
        .from("hr1_job_positions")
        .select("id, title")
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setPositions(data ?? []);
    } catch (err: any) {
      console.error("JOB POSITIONS ERROR:", err?.message || err?.details || JSON.stringify(err));
      setError("Unable to load available job positions.");
    } finally {
      setLoadingPositions(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function validateAndSetFile(file: File | null) {
    if (!file) {
      setResumeFile(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a valid PDF or DOCX resume.");
      setResumeFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Resume file size must not exceed 5MB.");
      setResumeFile(null);
      return;
    }

    setError(null);
    setResumeFile(file);
  }

  function handleResumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    validateAndSetFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    validateAndSetFile(file);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!resumeFile) {
        throw new Error("Please upload your resume to continue.");
      }

      if (!form.job_position_id) {
        throw new Error("Please select a position you wish to apply for.");
      }

      // 1. Upload resume
      const fileExtension = resumeFile.name.split(".").pop() || "pdf";
      const fileName = `${crypto.randomUUID()}.${fileExtension}`;
      const filePath = `applicants/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, resumeFile, {
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // 2. Extract resume text
      const extractionFormData = new FormData();
      extractionFormData.append("file", resumeFile);

      const extractionResponse = await fetch("/api/resume-extract", {
        method: "POST",
        body: extractionFormData,
      });

      const extractionResult = await extractionResponse.json();

      if (!extractionResponse.ok) {
        throw new Error(
          extractionResult.error || "Failed to extract text from your resume."
        );
      }

      const resumeText = extractionResult.text;

      // 3. Get resume URL
      const { data: urlData } = supabase.storage
        .from("resumes")
        .getPublicUrl(filePath);

      const resumeUrl = urlData.publicUrl;

      // 4. Create applicant record
      // Fixed: table name updated from applicants to hr1_applicants
      const { data: createdApplicant, error: applicantError } = await supabase
        .from("hr1_applicants")
        .insert({
          job_position_id: form.job_position_id,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim() || null,
          emergency_contact_name: form.emergency_contact_name.trim() || null,
          emergency_contact_phone:
            form.emergency_contact_phone.trim() || null,
          resume_url: resumeUrl,
          resume_text: resumeText,
        })
        .select("id, application_reference")
        .single();

      if (applicantError) {
        throw applicantError;
      }

      // 5. Automatically Trigger AI Screening in the background
      try {
        await fetch("/api/screening", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicant_id: createdApplicant.id,
            job_position_id: form.job_position_id,
            resume_text: resumeText,
          }),
        });
      } catch (screeningErr) {
        console.error("Background AI screening trigger warning:", screeningErr);
      }

      // 6. Success
      setSuccess(createdApplicant.application_reference);

      setForm({
        job_position_id: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
      });

      setResumeFile(null);

      const fileInput = document.getElementById(
        "resume"
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (err: any) {
      console.error("APPLICATION SUBMISSION ERROR:", err);

      setError(
        err instanceof Error ? err.message : "Failed to submit application."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyReference() {
    if (success) {
      navigator.clipboard.writeText(success);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-[#121212] pb-16">
      {/* Navbar / Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-xs">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 border border-gray-100">
              <Image
                src="/images/logo.jpg"
                alt="Airship Express Logo"
                width={36}
                height={36}
                className="h-8 w-auto object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#CB1A8E]">
                Courier Service
              </span>
              <span className="text-base font-black tracking-tight text-[#121212]">
                Airship Express
              </span>
            </div>
          </div>

          <Link
            href="/recruitment-core-hub-dashboard/application-status"
            className="rounded-full border border-gray-200 bg-gray-50/80 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-[#CB1A8E] hover:bg-white hover:text-[#CB1A8E] focus:outline-hidden focus:ring-2 focus:ring-[#CB1A8E]/15"
          >
            Check Status
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-8">
        {/* Banner */}
        <div className="mb-8 text-center sm:text-left">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#CB1A8E]/10 px-3.5 py-1 text-xs font-bold text-[#CB1A8E]">
            Careers Portal
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#121212] sm:text-4xl">
            Join Our Team
          </h1>
          <p className="mt-2 text-sm text-gray-600 max-w-xl">
            Fill out the application form below and submit your resume to start your career with Airship Express.
          </p>
        </div>

        {/* Success Screen Card */}
        {success ? (
          <div className="rounded-2xl bg-white p-8 shadow-xs border border-emerald-100 ring-1 ring-emerald-500/10 text-center sm:p-10">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Application Received!</h2>
            <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
              Thank you for applying. Your application reference code is:
            </p>

            <div className="my-6 inline-flex flex-col sm:flex-row items-center gap-3 rounded-2xl bg-gray-50 border border-gray-200 px-6 py-4 shadow-2xs">
              <span className="font-mono text-xl font-bold tracking-wider text-[#CB1A8E]">
                {success}
              </span>
              <button
                type="button"
                onClick={handleCopyReference}
                className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-gray-700 shadow-2xs border border-gray-200 hover:bg-gray-50 hover:text-[#CB1A8E] transition"
              >
                {isCopied ? "Copied!" : "Copy Code"}
              </button>
            </div>

            <p className="text-xs text-gray-500 max-w-md mx-auto mb-8 leading-relaxed">
              Please save this code. You can use it along with your email to check the status of your application at any time.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/recruitment-core-hub-dashboard/application-status"
                className="rounded-xl bg-[#CB1A8E] px-6 py-3.5 text-sm font-bold text-white shadow-xs hover:bg-[#a31270] transition"
              >
                Track Status Now
              </Link>
              <button
                type="button"
                onClick={() => setSuccess(null)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-3.5 text-sm font-bold text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition"
              >
                Submit Another Application
              </button>
            </div>
          </div>
        ) : (
          /* Main Application Form Card */
          <div className="rounded-2xl bg-white p-6 shadow-xs border border-gray-100 sm:p-8">
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 p-4 text-xs font-medium text-red-600 shadow-2xs">
                <svg className="h-5 w-5 shrink-0 text-red-500 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Job Selection Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#CB1A8E]/10 text-xs font-black text-[#CB1A8E]">
                    1
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Job Opportunity
                    </h2>
                    <p className="text-xs text-gray-500">
                      Select the position you are applying for.
                    </p>
                  </div>
                </div>

                <div className="sm:pl-10">
                  <label htmlFor="job_position_id" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Position Applying For <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="job_position_id"
                    name="job_position_id"
                    value={form.job_position_id}
                    onChange={handleChange}
                    required
                    disabled={loadingPositions}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-hidden transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 disabled:bg-gray-50"
                  >
                    <option value="">
                      {loadingPositions ? "Loading available positions..." : "-- Choose a position --"}
                    </option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Personal Details Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#CB1A8E]/10 text-xs font-black text-[#CB1A8E]">
                    2
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Personal Details
                    </h2>
                    <p className="text-xs text-gray-500">
                      Your primary contact and personal background information.
                    </p>
                  </div>
                </div>

                <div className="sm:pl-10 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="first_name" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="first_name"
                        name="first_name"
                        type="text"
                        value={form.first_name}
                        onChange={handleChange}
                        placeholder=""
                        required
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-hidden transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="last_name" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="last_name"
                        name="last_name"
                        type="text"
                        value={form.last_name}
                        onChange={handleChange}
                        placeholder=""
                        required
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-hidden transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder=""
                        required
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-hidden transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder=""
                        required
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-hidden transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="address" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                      Current Residential Address
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      rows={2}
                      placeholder=""
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-hidden transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Emergency Contact Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#CB1A8E]/10 text-xs font-black text-[#CB1A8E]">
                    3
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Emergency Contact
                    </h2>
                    <p className="text-xs text-gray-500">
                      Person to notify in case of an emergency.
                    </p>
                  </div>
                </div>

                <div className="sm:pl-10 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="emergency_contact_name" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                      Contact Person Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="emergency_contact_name"
                      name="emergency_contact_name"
                      type="text"
                      value={form.emergency_contact_name}
                      onChange={handleChange}
                      placeholder=""
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-hidden transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="emergency_contact_phone" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                      Contact Person Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="emergency_contact_phone"
                      name="emergency_contact_phone"
                      type="tel"
                      value={form.emergency_contact_phone}
                      onChange={handleChange}
                      placeholder=""
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-hidden transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Resume Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#CB1A8E]/10 text-xs font-black text-[#CB1A8E]">
                    4
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Resume / CV Upload
                    </h2>
                    <p className="text-xs text-gray-500">
                      Upload your resume in PDF or DOCX format (Max 5MB).
                    </p>
                  </div>
                </div>

                <div className="sm:pl-10">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition flex flex-col items-center justify-center ${
                      isDragging
                        ? "border-[#CB1A8E] bg-[#CB1A8E]/5"
                        : resumeFile
                        ? "border-emerald-300 bg-emerald-50/30"
                        : "border-gray-200 bg-gray-50/50 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      id="resume"
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleResumeChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />

                    {resumeFile ? (
                      <div className="flex flex-col items-center">
                        <div className="mb-3 rounded-full bg-emerald-100 p-3 text-emerald-600 border border-emerald-200">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{resumeFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drag to replace
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="mb-3 rounded-full bg-white p-3 text-gray-400 shadow-2xs border border-gray-100">
                          <svg className="h-6 w-6 text-[#CB1A8E]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-700">
                          <span className="text-[#CB1A8E]">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          PDF or DOCX (Max 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Section */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#CB1A8E] px-6 py-4 text-sm font-bold text-white shadow-xs transition hover:bg-[#a31270] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting Application & Running AI Screen...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </button>
                <p className="mt-3 text-center text-xs text-gray-400">
                  By clicking Submit, you agree that all provided details are accurate and complete.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}