"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Employee = {
  id: string;
  applicant_id: string | null;
  employee_id_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  department: string;
  date_hired: string;
  status: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  job_positions:
    | {
        title: string;
      }
    | null;
};

type ApplicantDocument = {
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

export default function EmployeeDetailsPage() {
  const params = useParams();
  const supabase = createClient();

  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<ApplicantDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEmployee() {
      try {
        setLoading(true);
        setError("");

        const { data, error } = await supabase
          .from("hr1_employees")
          .select(`
            id,
            applicant_id,
            employee_id_number,
            first_name,
            last_name,
            email,
            phone,
            address,
            department,
            date_hired,
            status,
            emergency_contact_name,
            emergency_contact_phone,
            job_positions:hr1_job_positions (
              title
            )
          `)
          .eq("id", employeeId)
          .single();

        if (error) {
          console.error("EMPLOYEE DETAILS ERROR:", error);
          setError(`Unable to load employee: ${error.message}`);
          setLoading(false);
          return;
        }

        const employeeRecord = data as unknown as Employee;
        setEmployee(employeeRecord);

        if (employeeRecord.applicant_id) {
          setDocumentsLoading(true);
          const { data: documentRows, error: documentsLoadError } = await supabase
            .from("hr1_applicant_documents")
            .select("id, document_type, original_filename, mime_type, size_bytes, submission_status, verification_status, verification_remarks, created_at")
            .eq("applicant_id", employeeRecord.applicant_id)
            .order("created_at", { ascending: false });

          if (documentsLoadError) {
            console.error("EMPLOYEE DOCUMENTS LOAD ERROR:", documentsLoadError);
            setDocumentsError("Could not load this employee's submitted files.");
          } else {
            setDocuments((documentRows ?? []) as ApplicantDocument[]);
          }
          setDocumentsLoading(false);
        }
      } catch (err: unknown) {
        console.error("EMPLOYEE DETAILS CATCH ERROR:", err);
        setDocumentsLoading(false);
        setError(`Unable to load employee: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    }

    if (employeeId) {
      loadEmployee();
    }
  }, [employeeId, supabase]);

  function getStatusClass(status: string) {
    switch (status) {
      case "Active":
        return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
      case "Probationary":
        return "bg-sky-50 text-sky-700 ring-sky-600/20";
      case "Regular":
        return "bg-purple-50 text-purple-700 ring-purple-600/20";
      case "Resigned":
        return "bg-amber-50 text-amber-700 ring-amber-600/20";
      case "Terminated":
        return "bg-rose-50 text-rose-700 ring-rose-600/20";
      case "Archived":
        return "bg-gray-100 text-gray-600 ring-gray-500/20";
      default:
        return "bg-gray-50 text-gray-700 ring-gray-600/20";
    }
  }

  function formatDate(date: string) {
    if (!date) return "—";
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatFileSize(sizeBytes: number) {
    if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getDocumentTypeLabel(type: string) {
    const labels: Record<string, string> = {
      resume: "Resume / CV",
      government_id: "Government ID",
      diploma: "Diploma / Certificate of Graduation",
      academic_record: "Transcript of Records / Grades",
      other_certificate: "Other Certificate",
    };
    return labels[type] ?? type.replaceAll("_", " ");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50/50 p-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200/70">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e5167e] border-t-transparent" />
          <p className="text-xs font-medium text-gray-500">
            Loading employee details...
          </p>
        </div>
      </main>
    );
  }

  if (error || !employee) {
    return (
      <main className="min-h-screen bg-gray-50/50 pb-12">

        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
          <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-gray-200/70 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              Employee record not found
            </h2>

            <p className="mt-1 text-xs text-red-600">
              {error || "The requested employee record could not be found."}
            </p>

            <Link
              href="/recruitment-core-hub-dashboard/employees"
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Employees
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50/50 pb-12">
      {/* Header */}

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-8">
        
        {/* Navigation Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link
            href="/recruitment-core-hub-dashboard/employees"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-gray-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Employees
          </Link>

          <Link
              href={`/recruitment-core-hub-dashboard/employees/edit/${employee.id}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#e5167e] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d8177f] focus:ring-2 focus:ring-[#e5167e]/30"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Employee
          </Link>
        </div>

        {/* Hero Banner Card */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/75">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 sm:px-8 py-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 font-bold text-white text-lg ring-1 ring-white/20 backdrop-blur-sm">
                  {employee.first_name[0]}{employee.last_name[0]}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                      {employee.first_name} {employee.last_name}
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${getStatusClass(
                        employee.status
                      )}`}
                    >
                      {employee.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-300">
                    {employee.job_positions?.title || "No position assigned"} • {employee.department}
                  </p>
                </div>
              </div>

              <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10">
                <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                  Employee ID
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-pink-300">
                  {employee.employee_id_number}
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 p-6 sm:p-8">
            
            {/* Section: Personal Information */}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Personal Information
              </div>

              <div className="mt-4 grid gap-4 sm:gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Employee ID
                  </p>
                  <p className="mt-1 text-xs font-semibold text-gray-900 font-mono">
                    {employee.employee_id_number}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Full Name
                  </p>
                  <p className="mt-1 text-xs font-semibold text-gray-900">
                    {employee.first_name} {employee.last_name}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Email Address
                  </p>
                  <a
                    href={`mailto:${employee.email}`}
                    className="mt-1 inline-block text-xs font-medium text-[#e5167e] hover:underline break-all"
                  >
                    {employee.email}
                  </a>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Phone Number
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-900">
                    {employee.phone}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <p className="text-[11px] font-medium text-gray-500">
                    Residential Address
                  </p>
                  <p className="mt-1 text-xs text-gray-700 leading-relaxed">
                    {employee.address || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Section: Employment Information */}
            <div className="pt-6 sm:pt-8 mt-6 sm:mt-8">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13V6a2 2 0 00-2-2h-5m-6 0H5a2 2 0 00-2 2v7m0 0h18" />
                </svg>
                Employment Information
              </div>

              <div className="mt-4 grid gap-4 sm:gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Job Position
                  </p>
                  <p className="mt-1 text-xs font-semibold text-gray-900">
                    {employee.job_positions?.title || "No position"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Department
                  </p>
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {employee.department}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Date Hired
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-900">
                    {formatDate(employee.date_hired)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Employment Status
                  </p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${getStatusClass(
                        employee.status
                      )}`}
                    >
                      {employee.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Submitted Documents */}
            <div className="mt-6 border-t border-gray-100 pt-6 sm:mt-8 sm:pt-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Submitted Documents
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Files submitted with the employee&apos;s original application.
                  </p>
                </div>
                {employee.applicant_id && (
                  <Link
                    href={`/recruitment-core-hub-dashboard/applicants/${employee.applicant_id}/edit`}
                    className="text-xs font-semibold text-[#e5167e] hover:underline"
                  >
                    Open Applicant Profile
                  </Link>
                )}
              </div>

              {documentsLoading ? (
                <p className="mt-4 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">Loading submitted files…</p>
              ) : documentsError ? (
                <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{documentsError}</p>
              ) : !employee.applicant_id ? (
                <p className="mt-4 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
                  This employee record is not linked to an applicant record, so no submitted application files can be shown here.
                </p>
              ) : documents.length === 0 ? (
                <p className="mt-4 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">No files have been submitted for the linked applicant.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {documents.map((document) => (
                    <article key={document.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-all text-xs font-semibold text-gray-900">{document.original_filename}</p>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {getDocumentTypeLabel(document.document_type)} · {document.mime_type} · {formatFileSize(document.size_bytes)} · Submitted {formatDate(document.created_at.slice(0, 10))}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-gray-600">
                          {document.submission_status} · {document.verification_status}
                          {document.verification_remarks ? ` · ${document.verification_remarks}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-xs font-semibold">
                        <a
                          href={`/api/hr1/applicants/${employee.applicant_id}/resume?document=${encodeURIComponent(document.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:underline"
                        >
                          View
                        </a>
                        <a
                          href={`/api/hr1/applicants/${employee.applicant_id}/resume?document=${encodeURIComponent(document.id)}&download=1`}
                          className="text-blue-700 hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Section: Emergency Contact */}
            <div className="pt-6 sm:pt-8 mt-6 sm:mt-8">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Emergency Contact
              </div>

              <div className="mt-4 grid gap-4 sm:gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Contact Name
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-900">
                    {employee.emergency_contact_name || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-gray-500">
                    Contact Phone
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-900">
                    {employee.emergency_contact_phone || "—"}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
