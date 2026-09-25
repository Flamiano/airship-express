"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type ApplicationStatus = {
  application_reference: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  status: string;
  submitted_at: string;

  interview_scheduled_date: string | null;
  interview_location: string | null;
  interview_status: string | null;
  interview_outcome: string | null;

  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
};

type TimelineStep = {
  label: string;
  description: string;
  completed: boolean;
  current: boolean;
};

export default function ApplicationStatusPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [applicationReference, setApplicationReference] = useState("");

  const [application, setApplication] =
    useState<ApplicationStatus | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckStatus(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setApplication(null);

    try {
      if (!email.trim()) {
        throw new Error("Please enter your email address.");
      }

      if (!applicationReference.trim()) {
        throw new Error("Please enter your application reference code.");
      }

      const { data, error: statusError } = await supabase.rpc(
        "get_application_status",
        {
          p_email: email.trim(),
          p_application_reference: applicationReference.trim(),
        }
      );

      if (statusError) {
        console.error("APPLICATION STATUS ERROR:", statusError);

        throw new Error(
          "Unable to check application status right now. Please try again later."
        );
      }

      if (!data || data.length === 0) {
        throw new Error(
          "No matching application found. Please verify your reference number and email address."
        );
      }

      setApplication(data[0]);
    } catch (err) {
      console.error("STATUS CHECK ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to check application status."
      );
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "Pending":
        return {
          style: "bg-amber-50 text-amber-700 border-amber-200 shadow-xs",
          dot: "bg-amber-500 animate-pulse",
          label: "Pending Review",
        };

      case "Under Review":
        return {
          style: "bg-blue-50 text-blue-700 border-blue-200 shadow-xs",
          dot: "bg-blue-500 animate-pulse",
          label: "Under Review",
        };

      case "Shortlisted":
        return {
          style: "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs",
          dot: "bg-indigo-500",
          label: "Shortlisted",
        };

      case "Interview Scheduled":
        return {
          style: "bg-purple-50 text-purple-700 border-purple-200 shadow-xs",
          dot: "bg-purple-500 animate-pulse",
          label: "Interview Scheduled",
        };

      case "Passed Interview":
      case "Interview Passed":
        return {
          style: "bg-teal-50 text-teal-700 border-teal-200 shadow-xs",
          dot: "bg-teal-500",
          label: "Interview Passed",
        };

      case "For Onboarding":
        return {
          style: "bg-orange-50 text-orange-700 border-orange-200 shadow-xs",
          dot: "bg-orange-500",
          label: "For Onboarding",
        };

      case "Hired":
        return {
          style: "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs",
          dot: "bg-emerald-500",
          label: "Hired",
        };

      case "Failed Interview":
      case "Rejected":
        return {
          style: "bg-rose-50 text-rose-700 border-rose-200 shadow-xs",
          dot: "bg-rose-500",
          label: "Not Selected",
        };

      case "Rescheduled":
        return {
          style: "bg-yellow-50 text-yellow-800 border-yellow-200 shadow-xs",
          dot: "bg-yellow-500",
          label: "Interview Rescheduled",
        };

      default:
        return {
          style: "bg-gray-100 text-gray-700 border-gray-200 shadow-xs",
          dot: "bg-gray-400",
          label: status,
        };
    }
  }

  function getTimeline(application: ApplicationStatus): TimelineStep[] {
    const status = application.status;
    const hasInterview = !!application.interview_scheduled_date;
    const onboardingCompleted = application.onboarding_completed;
    const interviewCompleted = application.interview_status === "Completed";
    const interviewPassed = application.interview_outcome === "Passed";

    const rejected =
      status === "Rejected" ||
      status === "Failed Interview" ||
      application.interview_outcome === "Failed";

    return [
      {
        label: "Application Submitted",
        description: "Your application has been received.",
        completed: true,
        current: false,
      },
      {
        label: "Application Review",
        description: "Your application is being reviewed by HR.",
        completed:
          status !== "Pending" &&
          status !== "Rejected" &&
          status !== "Failed Interview",
        current:
          status === "Pending" ||
          status === "Under Review" ||
          status === "Shortlisted",
      },
      {
        label: "Interview",
        description: hasInterview
          ? interviewCompleted
            ? "Your interview has been completed."
            : "Your interview has been scheduled."
          : "Interview has not been scheduled yet.",
        completed:
          hasInterview &&
          (interviewCompleted || interviewPassed),
        current:
          hasInterview &&
          !interviewCompleted &&
          !rejected,
      },
      {
        label: "Final Decision",
        description:
          status === "Hired"
            ? "Congratulations! You have been selected."
            : status === "Rejected" || status === "Failed Interview"
              ? "The recruitment process has ended."
              : "Waiting for the final recruitment decision.",
        completed:
          status === "Hired" ||
          status === "Rejected" ||
          status === "Failed Interview",
        current:
          status === "Hired" ||
          status === "Rejected" ||
          status === "Failed Interview",
      },
      {
        label: "Onboarding",
        description: onboardingCompleted
          ? "All onboarding requirements have been completed."
          : status === "Hired" || status === "For Onboarding"
            ? "Follow the instructions from HR for your next steps."
            : "Onboarding begins after the hiring decision.",
        completed: onboardingCompleted,
        current: status === "For Onboarding" && !onboardingCompleted,
      },
    ];
  }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString("en-PH", {
      dateStyle: "long",
      timeStyle: "short",
    });
  }

  function getApplicantMessage(application: ApplicationStatus) {
    if (
      application.status === "Rejected" ||
      application.status === "Failed Interview"
    ) {
      return {
        title: "Application Update",
        message:
          "Thank you for your interest in Airship Express. Unfortunately, your application was not selected for this position.",
        style: "border-rose-100 bg-rose-50/60 shadow-xs",
        titleStyle: "text-rose-800",
        iconStyle: "text-rose-600",
      };
    }

    if (application.status === "Hired") {
      if (application.onboarding_completed) {
        return {
          title: "🎉 Congratulations! You're Hired!",
          message:
            "You have successfully completed all required onboarding documents and training. Your onboarding process is complete. Please keep your email and phone number active for any final HR updates.",
          style: "border-emerald-100 bg-emerald-50",
          titleStyle: "text-emerald-700",
          iconStyle: "text-emerald-500",
        };
      }

      return {
        title: "🎉 Congratulations! You're Hired!",
        message:
          "You have been selected for the position. Please keep your email and phone number active. Our HR team will contact you regarding the next steps and onboarding requirements.",
        style: "border-emerald-100 bg-emerald-50",
        titleStyle: "text-emerald-700",
        iconStyle: "text-emerald-500",
      };
    }

    if (
      application.interview_status === "Completed" &&
      application.interview_outcome === "Passed"
    ) {
      return {
        title: "Interview Passed",
        message:
          "Congratulations! You passed your interview. Your application is now awaiting the final recruitment decision.",
        style: "border-teal-100 bg-teal-50/60 shadow-xs",
        titleStyle: "text-teal-800",
        iconStyle: "text-teal-600",
      };
    }

    if (
      application.interview_scheduled_date &&
      application.interview_status !== "Completed"
    ) {
      return {
        title: "📅 Interview Scheduled",
        message:
          "Your interview has been scheduled. Please make sure you are available at the scheduled date and time and arrive early if the interview is conducted onsite.",
        style: "border-purple-100 bg-purple-50/60 shadow-xs",
        titleStyle: "text-purple-800",
        iconStyle: "text-purple-600",
      };
    }

    if (application.status === "Pending") {
      return {
        title: "Application Under Review",
        message:
          "Your application has been received and is currently being reviewed by our HR team. Please check this page again for future updates.",
        style: "border-amber-100 bg-amber-50/60 shadow-xs",
        titleStyle: "text-amber-800",
        iconStyle: "text-amber-600",
      };
    }

    return {
      title: "Next Steps & Communication",
      message:
        "Your application is currently being processed. Please keep your email and phone number active so our HR team can contact you regarding updates.",
      style: "border-pink-100 bg-[#CB1A8E]/5 shadow-xs",
      titleStyle: "text-[#CB1A8E]",
      iconStyle: "text-[#CB1A8E]",
    };
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-16 text-[#121212]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 shadow-xs backdrop-blur-md">
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
            href="/recruitment-core-hub-dashboard/apply"
            className="rounded-full border border-gray-200 bg-gray-50/80 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-[#CB1A8E] hover:bg-white hover:text-[#CB1A8E] focus:outline-hidden focus:ring-2 focus:ring-[#CB1A8E]/15"
          >
            Submit Application
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-8">
        {/* Title Section */}
        <div className="mb-8 text-center sm:text-left">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#CB1A8E]/10 px-3.5 py-1 text-xs font-bold text-[#CB1A8E]">
            Applicant Portal
          </span>

          <h1 className="text-3xl font-black tracking-tight text-[#121212] sm:text-4xl">
            Track Application Status
          </h1>

          <p className="mt-2 text-sm text-gray-600 max-w-xl">
            Check your application progress, interview schedule, and recruitment
            updates instantly.
          </p>
        </div>

        {/* Lookup Card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#121212]">
              Lookup Your Application
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Enter the email address and application reference code you received
              after submitting your application.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600 shadow-2xs">
              <svg
                className="h-5 w-5 shrink-0 text-red-500 mt-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>

              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleCheckStatus} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-700"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-hidden transition placeholder:text-gray-400 focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
                />
              </div>

              {/* Reference */}
              <div className="space-y-1.5">
                <label
                  htmlFor="applicationReference"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-700"
                >
                  Application Reference
                </label>

                <input
                  id="applicationReference"
                  type="text"
                  value={applicationReference}
                  onChange={(e) =>
                    setApplicationReference(e.target.value.toUpperCase())
                  }
                  placeholder="APP-0000"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-mono text-sm uppercase text-gray-900 outline-hidden transition placeholder:text-gray-400 focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-3 w-full rounded-xl bg-[#CB1A8E] px-6 py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#a31270] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking Application...
                </>
              ) : (
                "Check Status"
              )}
            </button>
          </form>
        </div>

        {/* Loading State Skeleton Placeholder when searching */}
        {loading && !application && (
          <div className="mt-6 space-y-6 animate-pulse">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs sm:p-8 space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              <div className="h-16 bg-gray-100 rounded-xl mt-4"></div>
            </div>
          </div>
        )}

        {/* Result Container */}
        {application && (
          <div className="mt-6 space-y-6">
            {/* Applicant Header */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#CB1A8E]">
                    Application Record
                  </span>

                  <h2 className="mt-1 text-2xl font-black text-gray-900 tracking-tight">
                    {application.first_name} {application.last_name}
                  </h2>

                  <p className="mt-1 text-sm font-medium text-gray-500">
                    {application.job_title || "Position Not Specified"}
                  </p>
                </div>

                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold ${
                    getStatusBadge(application.status).style
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      getStatusBadge(application.status).dot
                    }`}
                  />

                  {getStatusBadge(application.status).label}
                </div>
              </div>

              {/* Reference Callout */}
              <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50/80 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Application Reference
                  </p>
                  <p className="mt-0.5 font-mono text-base font-black text-[#CB1A8E]">
                    {application.application_reference}
                  </p>
                </div>
                <div className="text-xs text-gray-500 sm:text-right">
                  Submitted on {new Date(application.submitted_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            </div>

            {/* Recruitment Timeline */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs sm:p-8">
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-wider text-[#CB1A8E]">
                  Recruitment Progress
                </p>

                <h3 className="mt-1 text-xl font-black text-gray-900 tracking-tight">
                  Application Timeline
                </h3>
              </div>

              <div className="space-y-7">
                {getTimeline(application).map((step, index) => (
                  <div key={step.label} className="relative flex gap-4">
                    {index < getTimeline(application).length - 1 && (
                      <div
                        className={`absolute left-[15px] top-8 h-[calc(100%+8px)] w-0.5 transition-colors duration-300 ${
                          step.completed ? "bg-[#CB1A8E]" : "bg-gray-200"
                        }`}
                      />
                    )}

                    <div
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                        step.completed
                          ? "bg-[#CB1A8E] text-white shadow-xs"
                          : step.current
                            ? "border-2 border-[#CB1A8E] bg-white text-[#CB1A8E] shadow-xs"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {step.completed ? (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>

                    <div className="pt-0.5">
                      <p
                        className={`text-sm font-bold ${
                          step.completed || step.current
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </p>

                      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interview Card */}
            {application.interview_scheduled_date ? (
              <div className="rounded-2xl border border-purple-100 bg-white p-6 shadow-xs sm:p-8">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                      />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-600">
                      Interview Information
                    </p>

                    <h3 className="mt-0.5 text-xl font-black text-gray-900 tracking-tight">
                      {application.interview_status === "Completed"
                        ? "Interview Completed"
                        : "Interview Scheduled"}
                    </h3>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Date & Time
                    </p>

                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {formatDateTime(
                        application.interview_scheduled_date
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Location
                    </p>

                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {application.interview_location ||
                        "Location will be provided by HR."}
                    </p>
                  </div>
                </div>

                {application.interview_status === "Completed" &&
                  application.interview_outcome && (
                    <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/80 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-teal-600">
                        Interview Result
                      </p>

                      <p className="mt-1 text-lg font-black text-teal-700">
                        {application.interview_outcome === "Passed"
                          ? "Passed"
                          : "Not Passed"}
                      </p>
                    </div>
                  )}

                {application.interview_status !== "Completed" && (
                  <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/80 p-4">
                    <p className="text-xs font-semibold leading-relaxed text-purple-700">
                      Please arrive 10–15 minutes early if your interview is
                      conducted onsite. Keep your contact information active in
                      case HR needs to send you an update.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs sm:p-8">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 border border-gray-200">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l2.5 2.5"
                      />
                    </svg>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Interview
                    </p>

                    <h3 className="mt-0.5 text-lg font-black text-gray-900 tracking-tight">
                      No Interview Scheduled Yet
                    </h3>

                    <p className="mt-1 text-sm leading-relaxed text-gray-500">
                      Your application does not currently have an interview
                      schedule. Please continue checking this page for updates.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Application Details Grid */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs sm:p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-[#CB1A8E]">
                Application Details
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Applied Position
                  </p>

                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {application.job_title || "Position Not Specified"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Registered Email
                  </p>

                  <p className="mt-1 break-all text-sm font-semibold text-gray-800">
                    {application.email}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Date Submitted
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-800">
                    {new Date(application.submitted_at).toLocaleDateString(
                      "en-PH",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Current Status
                  </p>

                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {getStatusBadge(application.status).label}
                  </p>
                </div>
              </div>
            </div>

            {/* Applicant Message */}
            {(() => {
              const message = getApplicantMessage(application);

              return (
                <div
                  className={`rounded-2xl border p-5 sm:p-6 ${message.style}`}
                >
                  <div className="flex gap-3.5">
                    <svg
                      className={`mt-0.5 h-5 w-5 shrink-0 ${message.iconStyle}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>

                    <div>
                      <p
                        className={`text-sm font-bold ${message.titleStyle}`}
                      >
                        {message.title}
                      </p>

                      <p className="mt-1 text-sm leading-relaxed text-gray-600">
                        {message.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-gray-400 pb-4">
          Need assistance? Contact the Airship Express HR Recruitment Desk.
        </footer>
      </div>
    </main>
  );
}