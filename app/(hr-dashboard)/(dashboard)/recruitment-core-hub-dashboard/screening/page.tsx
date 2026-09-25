"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  resume_text: string | null;
  job_position_id: string;
  job_positions:
    | {
        id: string;
        title: string;
      }
    | null;
};

type Screening = {
  id: string;
  applicant_id: string;
  match_score: number;
  recommendation: string;
  strengths: string[];
  gaps: string[];
  summary: string | null;
  created_at: string;
};

export default function ScreeningPage() {
  const supabase = createClient();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [selectedApplicantId, setSelectedApplicantId] =
    useState("");

  const [screening, setScreening] =
    useState<Screening | null>(null);

  const [loadingApplicants, setLoadingApplicants] =
    useState(true);

  const [screeningLoading, setScreeningLoading] =
    useState(false);

  const [error, setError] = useState("");

  // --------------------------------------------------
  // Load applicants
  // --------------------------------------------------

  useEffect(() => {
    async function loadApplicants() {
      setLoadingApplicants(true);
      setError("");

      const { data, error } = await supabase
        .from("applicants")
        .select(`
          id,
          first_name,
          last_name,
          email,
          resume_text,
          job_position_id,
          job_positions (
            id,
            title
          )
        `)
        .order("first_name", {
          ascending: true,
        });

      if (error) {
        console.error(
          "APPLICANTS LOAD ERROR:",
          error
        );

        setError(
          `Unable to load applicants: ${error.message}`
        );

        setLoadingApplicants(false);
        return;
      }

      setApplicants(
        (data ?? []) as unknown as Applicant[]
      );

      setLoadingApplicants(false);
    }

    loadApplicants();
  }, []);

  // --------------------------------------------------
  // Selected applicant
  // --------------------------------------------------

  const selectedApplicant =
    applicants.find(
      (applicant) =>
        applicant.id === selectedApplicantId
    ) || null;

  // --------------------------------------------------
  // Run AI Screening
  // --------------------------------------------------

  async function runAIScreening() {
    if (!selectedApplicantId) {
      setError("Please select an applicant first.");
      return;
    }

    setScreeningLoading(true);
    setError("");
    setScreening(null);

    try {
      const response = await fetch(
        "/api/screening",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            applicant_id:
              selectedApplicantId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error(
          "AI SCREENING API ERROR:",
          result
        );

        setError(
          result.error ||
            "AI screening failed."
        );

        setScreeningLoading(false);
        return;
      }

      console.log(
        "AI SCREENING RESULT:",
        result
      );

      setScreening(result.screening);
    } catch (error) {
      console.error(
        "AI SCREENING REQUEST ERROR:",
        error
      );

      setError(
        "Unable to connect to the AI screening service."
      );
    }

    setScreeningLoading(false);
  }

  // --------------------------------------------------
  // Recommendation style
  // --------------------------------------------------

  function getRecommendationClass(
    recommendation: string
  ) {
    switch (recommendation) {
      case "Strongly Recommended":
        return "bg-green-100 text-green-700";

      case "Recommended":
        return "bg-blue-100 text-blue-700";

      case "Consider":
        return "bg-yellow-100 text-yellow-700";

      case "Not Recommended":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  // --------------------------------------------------
  // Match score style
  // --------------------------------------------------

  function getScoreClass(score: number) {
    if (score >= 80) {
      return "text-green-600";
    }

    if (score >= 60) {
      return "text-yellow-600";
    }

    return "text-red-600";
  }

  return (
    <main className="min-h-screen bg-[#F9FAFB]">

      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-5">

          <div>
            <p className="text-sm text-gray-500">
              Human Resource Department
            </p>

            <h1 className="text-2xl font-bold text-[#1F1F1F]">
              Recruitment & Employee Records
            </h1>
          </div>

          <div className="flex items-center gap-3">

            <div className="text-right">
              <p className="text-sm font-semibold text-[#1F1F1F]">
                Super Admin
              </p>

              <p className="text-xs text-gray-500">
                Administrator
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E91E8F] text-sm font-bold text-white">
              SA
            </div>

          </div>

        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">

        {/* Back */}
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[#E91E8F] hover:underline"
        >
          ← Back to Dashboard
        </Link>

        {/* Heading */}
        <div className="mt-6 mb-8">
          <h2 className="text-3xl font-bold text-[#1F1F1F]">
            AI Applicant Screening
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Use AI-assisted screening to evaluate an
            applicant's qualifications against the
            applied position.
          </p>
        </div>

        {/* Applicant Selection */}
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-100">

          <h3 className="text-lg font-semibold text-[#1F1F1F]">
            Select Applicant
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Select an applicant to perform an
            AI-assisted resume screening.
          </p>

          <div className="mt-6">

            <label
              htmlFor="applicant"
              className="mb-2 block text-sm font-medium text-[#1F1F1F]"
            >
              Applicant
            </label>

            {loadingApplicants ? (
              <p className="text-sm text-gray-500">
                Loading applicants...
              </p>
            ) : applicants.length === 0 ? (
              <div className="rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                No applicants available.
              </div>
            ) : (
              <select
                id="applicant"
                value={selectedApplicantId}
                onChange={(event) => {
                  setSelectedApplicantId(
                    event.target.value
                  );
                  setScreening(null);
                  setError("");
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-2 focus:ring-[#E91E8F]/20"
              >
                <option value="">
                  Select an applicant
                </option>

                {applicants.map(
                  (applicant) => (
                    <option
                      key={applicant.id}
                      value={applicant.id}
                    >
                      {applicant.first_name}{" "}
                      {applicant.last_name} —{" "}
                      {applicant.email}
                    </option>
                  )
                )}
              </select>
            )}

          </div>

          {/* Selected Applicant Information */}
          {selectedApplicant && (
            <div className="mt-6 rounded-lg bg-gray-50 p-5">

              <h4 className="font-semibold text-[#1F1F1F]">
                Applicant Information
              </h4>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">

                <div>
                  <p className="text-xs text-gray-500">
                    Name
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {selectedApplicant.first_name}{" "}
                    {selectedApplicant.last_name}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Email
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {selectedApplicant.email}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Applied Position
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {selectedApplicant.job_positions
                      ?.title ||
                      "Unknown Position"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Resume
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {selectedApplicant.resume_text
                      ? "Resume available"
                      : "No resume text"}
                  </p>
                </div>

              </div>

            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Run Button */}
          <div className="mt-6 flex justify-end">

            <button
              type="button"
              onClick={runAIScreening}
              disabled={
                !selectedApplicantId ||
                screeningLoading ||
                loadingApplicants
              }
              className="rounded-lg bg-[#E91E8F] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d8177f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {screeningLoading
                ? "Analyzing Resume..."
                : "Run AI Screening"}
            </button>

          </div>

        </div>

        {/* Loading AI */}
        {screeningLoading && (
          <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 text-xl">
              🤖
            </div>

            <h3 className="mt-4 font-semibold text-[#1F1F1F]">
              AI is analyzing the applicant...
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Please wait while the resume is
              evaluated against the applied position.
            </p>

          </div>
        )}

        {/* AI Result */}
        {screening && !screeningLoading && (
          <div className="mt-6 rounded-xl bg-white shadow-sm ring-1 ring-gray-100">

            {/* Result Header */}
            <div className="border-b border-gray-100 px-8 py-5">

              <h3 className="text-lg font-semibold text-[#1F1F1F]">
                AI Screening Result
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                AI-assisted assessment for{" "}
                {selectedApplicant?.first_name}{" "}
                {selectedApplicant?.last_name}
              </p>

            </div>

            <div className="space-y-6 p-8">

              {/* Score + Recommendation */}
              <div className="grid gap-6 sm:grid-cols-2">

                <div className="rounded-lg bg-gray-50 p-6 text-center">

                  <p className="text-sm font-medium text-gray-500">
                    Match Score
                  </p>

                  <p
                    className={`mt-2 text-5xl font-bold ${getScoreClass(
                      screening.match_score
                    )}`}
                  >
                    {screening.match_score}%
                  </p>

                </div>

                <div className="rounded-lg bg-gray-50 p-6 text-center">

                  <p className="text-sm font-medium text-gray-500">
                    Recommendation
                  </p>

                  <span
                    className={`mt-4 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${getRecommendationClass(
                      screening.recommendation
                    )}`}
                  >
                    {screening.recommendation}
                  </span>

                </div>

              </div>

              {/* Strengths */}
              <div>

                <h4 className="font-semibold text-[#1F1F1F]">
                  Strengths
                </h4>

                {screening.strengths.length ===
                0 ? (
                  <p className="mt-2 text-sm text-gray-500">
                    No specific strengths identified.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">

                    {screening.strengths.map(
                      (strength, index) => (
                        <li
                          key={index}
                          className="flex gap-3 text-sm text-gray-700"
                        >
                          <span className="text-green-600">
                            ✓
                          </span>

                          <span>
                            {strength}
                          </span>
                        </li>
                      )
                    )}

                  </ul>
                )}

              </div>

              {/* Gaps */}
              <div>

                <h4 className="font-semibold text-[#1F1F1F]">
                  Gaps
                </h4>

                {screening.gaps.length ===
                0 ? (
                  <p className="mt-2 text-sm text-gray-500">
                    No significant gaps identified.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">

                    {screening.gaps.map(
                      (gap, index) => (
                        <li
                          key={index}
                          className="flex gap-3 text-sm text-gray-700"
                        >
                          <span className="text-red-600">
                            •
                          </span>

                          <span>
                            {gap}
                          </span>
                        </li>
                      )
                    )}

                  </ul>
                )}

              </div>

              {/* Summary */}
              <div>

                <h4 className="font-semibold text-[#1F1F1F]">
                  AI Summary
                </h4>

                <div className="mt-3 rounded-lg bg-gray-50 p-5">

                  <p className="text-sm leading-6 text-gray-700">
                    {screening.summary ||
                      "No summary available."}
                  </p>

                </div>

              </div>

              {/* Disclaimer */}
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-5 py-4">

                <p className="text-xs leading-5 text-yellow-800">
                  <strong>AI-Assisted Screening:</strong>{" "}
                  This assessment is intended to
                  assist HR personnel during applicant
                  screening. It should not be used as
                  the sole basis for hiring decisions.
                </p>

              </div>

            </div>

          </div>
        )}

      </div>

    </main>
  );
}