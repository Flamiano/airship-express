"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Employee = {
  id: string;
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
  hr1_job_positions:
    | {
        title: string;
      }
    | null;
};

export default function EmployeeDetailsPage() {
  const params = useParams();
  const supabase = createClient();

  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
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
            hr1_job_positions (
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

        setEmployee(data as unknown as Employee);
      } catch (err: any) {
        console.error("EMPLOYEE DETAILS CATCH ERROR:", err);
        setError(`Unable to load employee: ${err.message || "Unknown error"}`);
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50/50 p-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200/70">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E91E8F] border-t-transparent" />
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
        <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E91E8F]/10 text-[#E91E8F] font-bold text-sm">
                HR
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                  Recruitment & Employee Records
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-500">
                  Human Resource Department
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-gray-900">
                  Super Admin
                </p>
                <p className="text-[11px] text-gray-500">
                  Administrator
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E91E8F] text-xs font-bold text-white shadow-sm ring-2 ring-white">
                SA
              </div>
            </div>
          </div>
        </header>

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
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E91E8F]/10 text-[#E91E8F] font-bold text-sm">
              HR
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                Recruitment & Employee Records
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-500">
                Human Resource Department
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-gray-900">
                Super Admin
              </p>
              <p className="text-[11px] text-gray-500">
                Administrator
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E91E8F] text-xs font-bold text-white shadow-sm ring-2 ring-white">
              SA
            </div>
          </div>
        </div>
      </header>

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
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#E91E8F] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d8177f] focus:ring-2 focus:ring-[#E91E8F]/30"
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
                    {employee.hr1_job_positions?.title || "No position assigned"} • {employee.department}
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
                    className="mt-1 inline-block text-xs font-medium text-[#E91E8F] hover:underline break-all"
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
                    {employee.hr1_job_positions?.title || "No position"}
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