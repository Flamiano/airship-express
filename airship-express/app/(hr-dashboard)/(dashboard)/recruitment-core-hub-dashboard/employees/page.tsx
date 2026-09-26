"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  job_position_id: string;
  department: string;
  date_hired: string;
  status: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;

  hr1_job_positions:
    | {
        title: string;
      }
    | null;
};

export default function EmployeesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadEmployees() {
    try {
      setLoading(true);
      setError(null);

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
          job_position_id,
          department,
          date_hired,
          status,
          emergency_contact_name,
          emergency_contact_phone,
          created_at,
          updated_at,
          hr1_job_positions (
            title
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      console.log("EMPLOYEES FROM SUPABASE:", data);

      setEmployees((data ?? []) as unknown as Employee[]);
    } catch (err: any) {
      console.error("EMPLOYEES LOAD ERROR:", err);
      setError(`Unable to load employee records: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  async function handleDelete(employee: Employee) {
    const confirmed = window.confirm(
      `Are you sure you want to delete employee ${employee.first_name} ${employee.last_name}?`
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    const { error: deleteError } = await supabase
      .from("hr1_employees")
      .delete()
      .eq("id", employee.id);

    if (deleteError) {
      console.error("EMPLOYEE DELETE ERROR:", deleteError);

      setError(`Delete failed: ${deleteError.message}`);

      return;
    }

    console.log("EMPLOYEE DELETED:", employee.id);

    await loadEmployees();
  }

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
    if (!date) {
      return "—";
    }

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="min-h-screen bg-gray-50/50 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/logo.jpg"
              alt="Logo"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-md object-contain"
              priority
            />
            <div>
              <h1 className="text-sm font-bold leading-tight text-gray-900">
                Recruitment & Employee Records
              </h1>
              <p className="text-[11px] text-gray-500">
                Human Resource Department
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-gray-900">
                Super Admin
              </p>
              <p className="text-[11px] text-gray-500">
                Administrator
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E91E8F] text-xs font-bold text-white shadow-sm ring-2 ring-white">
              SA
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
        {/* Page Heading */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                Employees
              </h2>
              {!loading && !error && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                  {employees.length}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              Manage employee records, employment status, and directory information.
            </p>
          </div>

          <Link
            href="/recruitment-core-hub-dashboard/employees/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#E91E8F] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d8177f] focus:ring-2 focus:ring-[#E91E8F]/30 sm:text-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Employee
          </Link>
        </div>

        {/* Employee Records Card container */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/70">
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 sm:px-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Employee Records
              </h3>
              <p className="mt-0.5 text-xs text-gray-500">
                View and manage current and previous employees.
              </p>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E91E8F] border-t-transparent" />
              <p className="animate-pulse text-xs font-medium text-gray-500">
                Loading employees...
              </p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="m-4 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600 sm:m-6">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && employees.length === 0 && (
            <div className="flex min-h-[400px] flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E91E8F]/10 text-[#E91E8F]">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900">
                No employees yet
              </h3>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500">
                Employee records will appear here once employees are added to the system. Get started by adding your first record.
              </p>
              <Link
                href="/recruitment-core-hub-dashboard/employees/new"
                className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-[#E91E8F] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d8177f]"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add First Employee
              </Link>
            </div>
          )}

          {/* Employee Table & Mobile Cards */}
          {!loading && !error && employees.length > 0 && (
            <>
              {/* Desktop View / Standard Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-100 bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Employee ID
                      </th>
                      <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Employee
                      </th>
                      <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Position
                      </th>
                      <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Department
                      </th>
                      <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Date Hired
                      </th>
                      <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/80">
                    {employees.map((employee) => (
                      <tr
                        key={employee.id}
                        className="group transition-colors hover:bg-gray-50/60"
                      >
                        {/* Employee ID */}
                        <td className="whitespace-nowrap px-6 py-4 font-mono font-semibold text-gray-700">
                          {employee.employee_id_number}
                        </td>

                        {/* Employee */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-600 transition-colors group-hover:bg-[#E91E8F]/10 group-hover:text-[#E91E8F]">
                              {employee.first_name[0]}{employee.last_name[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {employee.first_name} {employee.last_name}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                {employee.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Position */}
                        <td className="px-6 py-4 font-medium text-gray-700">
                          {employee.hr1_job_positions?.title || "No position"}
                        </td>

                        {/* Department */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-md bg-gray-100/80 px-2 py-1 text-[11px] font-medium text-gray-600">
                            {employee.department}
                          </span>
                        </td>

                        {/* Date Hired */}
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-600">
                          {formatDate(employee.date_hired)}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${getStatusClass(
                              employee.status
                            )}`}
                          >
                            {employee.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/recruitment-core-hub-dashboard/employees/${employee.id}`)
                              }
                              className="rounded-lg p-1.5 text-gray-500 transition hover:bg-blue-50 hover:text-blue-600"
                              title="View details"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/recruitment-core-hub-dashboard/employees/edit/${employee.id}`)
                              }
                              className="rounded-lg p-1.5 text-gray-500 transition hover:bg-pink-50 hover:text-[#E91E8F]"
                              title="Edit employee"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(employee)}
                              className="rounded-lg p-1.5 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                              title="Delete employee"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View / Card Layout */}
              <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    className="space-y-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                          {employee.first_name[0]}{employee.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="font-mono text-xs text-gray-500">
                            {employee.employee_id_number}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${getStatusClass(
                          employee.status
                        )}`}
                      >
                        {employee.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-gray-50 pt-2 text-xs">
                      <div>
                        <span className="block text-[10px] font-semibold uppercase text-gray-400">Position</span>
                        <span className="font-medium text-gray-700">{employee.hr1_job_positions?.title || "No position"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold uppercase text-gray-400">Department</span>
                        <span className="font-medium text-gray-700">{employee.department}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-50 pt-2 text-xs">
                      <span className="text-gray-500">Hired: {formatDate(employee.date_hired)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/recruitment-core-hub-dashboard/employees/${employee.id}`)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                          title="View details"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/recruitment-core-hub-dashboard/employees/edit/${employee.id}`)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-pink-50 hover:text-[#E91E8F]"
                          title="Edit employee"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(employee)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                          title="Delete employee"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}