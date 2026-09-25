"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

interface Applicant {
  id: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
}

const statuses = [
  {
    title: "Pending",
    description: "Your application has been received and is waiting for HR review.",
    style: "bg-amber-50/80 border-amber-200 text-amber-900",
  },
  {
    title: "Under Review",
    description: "HR is currently reviewing your application and qualifications.",
    style: "bg-blue-50/80 border-blue-200 text-blue-900",
  },
  {
    title: "Shortlisted",
    description: "You have progressed to the next stage of the recruitment process.",
    style: "bg-indigo-50/80 border-indigo-200 text-indigo-900",
  },
  {
    title: "Interview Scheduled",
    description: "Your interview has been scheduled. Check the status page for the date, time, and location.",
    style: "bg-purple-50/80 border-purple-200 text-purple-900",
  },
  {
    title: "Interview Passed",
    description: "You successfully passed your interview and are progressing to the next stage.",
    style: "bg-teal-50/80 border-teal-200 text-teal-900",
  },
  {
    title: "For Onboarding",
    description: "You have progressed to onboarding. Follow the instructions provided by HR.",
    style: "bg-orange-50/80 border-orange-200 text-orange-900",
  },
  {
    title: "Hired",
    description: "Congratulations! You have been selected for the position.",
    style: "bg-emerald-50/80 border-emerald-200 text-emerald-900",
  },
  {
    title: "Rejected",
    description: "Your application was not selected for the current recruitment process.",
    style: "bg-rose-50/80 border-rose-200 text-rose-900",
  },
];

const steps = [
  {
    number: "01",
    title: "Submit Your Application",
    description:
      "Complete the application form and upload your resume for the position you want to apply for.",
  },
  {
    number: "02",
    title: "Save Your Reference",
    description:
      "After submitting your application, you will receive an Application Reference such as APP-0009. Keep this reference safe.",
  },
  {
    number: "03",
    title: "Check Your Application",
    description:
      "Use your email address and Application Reference on the Application Status page to view your recruitment progress.",
  },
  {
    number: "04",
    title: "Attend Your Interview",
    description:
      "If an interview is scheduled, your application status will show the interview date, time, location, and other available details.",
  },
  {
    number: "05",
    title: "Wait for the Final Decision",
    description:
      "After the recruitment process, HR will update your application status with the appropriate result.",
  },
  {
    number: "06",
    title: "Complete Onboarding",
    description:
      "If you are hired, follow the instructions from HR regarding onboarding requirements and your next steps.",
  },
];

export default function ApplicationGuidePage() {
  const supabase = createClient();
  const [data, setData] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApplicants() {
      try {
        setLoading(true);
        // Fixed: Updated table name from applicants to hr1_applicants
        const { data: applicants, error: fetchError } = await supabase
          .from("hr1_applicants")
          .select("*");

        if (fetchError) {
          throw fetchError;
        }

        setData(applicants || []);
      } catch (err: any) {
        console.error("Error fetching applicants:", err?.message || err?.details || JSON.stringify(err));
        setError("Unable to load application records at this time.");
      } finally {
        setLoading(false);
      }
    }

    fetchApplicants();
  }, [supabase]);

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-[#121212]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 transition hover:opacity-90">
            <Image
              src="/images/logo.jpg"
              alt="Airship Express Logo"
              width={48}
              height={48}
              className="h-10 w-auto object-contain"
              priority
            />

            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#CB1A8E]">
                Courier Service
              </span>
              <span className="text-base font-black tracking-tight">
                Airship Express
              </span>
            </div>
          </Link>

          <Link
            href="/recruitment-core-hub-dashboard/application-status"
            className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 transition hover:border-[#CB1A8E] hover:text-[#CB1A8E]"
          >
            Check Status
          </Link>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
            {error}
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-[#CB1A8E]/10 px-3.5 py-1.5 text-xs font-bold text-[#CB1A8E]">
              Applicant Portal
            </span>

            <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight">
              Application Guide
            </h1>

            <p className="mt-3 sm:mt-4 max-w-2xl text-sm sm:text-base leading-6 sm:leading-7 text-gray-600">
              Learn how the Airship Express recruitment process works,
              how to track your application, and what to expect after applying.
            </p>

            <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row gap-3">
              <Link
                href="/recruitment-core-hub-dashboard/apply"
                className="rounded-xl bg-[#CB1A8E] px-6 py-3.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#a31270]"
              >
                Apply for a Position
              </Link>

              <Link
                href="/recruitment-core-hub-dashboard/application-status"
                className="rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-center text-sm font-bold text-gray-700 transition hover:border-[#CB1A8E] hover:text-[#CB1A8E]"
              >
                Track My Application
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#CB1A8E]">
            How It Works
          </p>

          <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
            From application to onboarding
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Follow these steps to understand what happens after you submit
            your application.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-xs transition hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CB1A8E]/10 text-sm font-black text-[#CB1A8E]">
                {step.number}
              </div>

              <h3 className="mt-5 text-base font-bold text-[#121212]">{step.title}</h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How to check status */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#CB1A8E]">
                Track Your Application
              </p>

              <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
                How do I check my application?
              </h2>

              <p className="mt-3 text-sm sm:text-base leading-6 sm:leading-7 text-gray-600">
                You can check your recruitment progress at any time using the
                email address and application reference you provided when
                applying.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-[#F8F9FA] p-6 sm:p-8 shadow-xs">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-black text-gray-700">1</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Step 1
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      Open Application Status
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-black text-gray-700">2</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Step 2
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      Enter the email used in your application
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-black text-gray-700">3</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Step 3
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      Enter your application reference
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-pink-100 bg-white p-4 shadow-xs">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Example Reference
                  </p>

                  <p className="mt-1 font-mono text-lg font-black text-[#CB1A8E]">
                    APP-0009
                  </p>
                </div>

                <Link
                  href="/recruitment-core-hub-dashboard/application-status"
                  className="block rounded-xl bg-[#CB1A8E] px-5 py-3.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#a31270]"
                >
                  Check Application Status
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statuses */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#CB1A8E]">
            Application Statuses
          </p>

          <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
            What does my status mean?
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Your status changes as you progress through the recruitment
            process.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {statuses.map((status) => (
            <div
              key={status.title}
              className={`rounded-2xl border p-5 shadow-xs transition hover:shadow-sm ${status.style}`}
            >
              <p className="text-sm font-bold">{status.title}</p>
              <p className="mt-1.5 text-xs sm:text-sm leading-5 opacity-90">
                {status.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Interview */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="rounded-2xl bg-[#121212] p-6 text-white sm:p-10 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-pink-300">
              Interview Information
            </p>

            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
              If you are scheduled for an interview
            </h2>

            <p className="mt-3 max-w-2xl text-sm sm:text-base leading-6 text-gray-300">
              Your Application Status page will display the available
              interview information once HR schedules your interview.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              {[
                ["📅", "Date"],
                ["🕐", "Time"],
                ["📍", "Location"],
                ["📋", "Result"],
              ].map(([icon, label]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0"
                >
                  <span className="text-xl">{icon}</span>
                  <p className="sm:mt-2 text-sm font-bold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hired */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-6 sm:p-9 shadow-xs">
          <p className="text-2xl">🎉</p>

          <h2 className="mt-3 text-2xl font-black text-emerald-900 tracking-tight">
            What happens when I am hired?
          </h2>

          <p className="mt-3 max-w-3xl text-sm sm:text-base leading-6 sm:leading-7 text-emerald-800">
            When your application status becomes Hired, your Application
            Status page will display a congratulations message. HR will
            provide information about your onboarding requirements and next
            steps. Keep your email address and phone number active so the HR
            team can contact you.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[#CB1A8E]">
              Frequently Asked Questions
            </p>

            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
              Need help?
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              [
                "Where can I find my application reference?",
                "Your application reference is provided after successfully submitting your application. Save it for future status checks.",
              ],
              [
                "What information do I need to check my status?",
                "You need the email address used during your application and your application reference.",
              ],
              [
                "How will I know when I have an interview?",
                "Your application status will show the interview schedule when HR has scheduled one. Email notifications may also be sent when notifications are enabled.",
              ],
              [
                "What should I do if I lose my reference?",
                "Contact the Airship Express HR Recruitment Desk for assistance.",
              ],
            ].map(([question, answer]) => (
              <div
                key={question}
                className="rounded-2xl border border-gray-100 bg-[#F8F9FA] p-6 shadow-xs transition hover:shadow-sm"
              >
                <h3 className="text-sm sm:text-base font-bold text-[#121212]">{question}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-8 sm:pb-16">
          <div className="rounded-2xl bg-[#CB1A8E] px-6 py-10 sm:py-12 text-center text-white sm:px-12 shadow-md">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Ready to check your application?
            </h2>

            <p className="mx-auto mt-2.5 max-w-xl text-sm sm:text-base text-pink-100">
              Use your email address and application reference to see your
              latest recruitment updates.
            </p>

            <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/recruitment-core-hub-dashboard/application-status"
                className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#CB1A8E] shadow-sm transition hover:bg-gray-100"
              >
                Check Application Status
              </Link>

              <Link
                href="/recruitment-core-hub-dashboard/apply"
                className="rounded-xl border border-white/30 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Submit an Application
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white px-4 py-8 text-center text-xs text-gray-400">
        Need assistance? Contact the Airship Express HR Recruitment Desk.
      </footer>
    </main>
  );
}