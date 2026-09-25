"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
};

type JobPosition = {
  id: string;
  title: string;
  department: string;
};

const EMPLOYEE_STATUSES = [
  "Active",
  "Probationary",
  "Regular",
  "Resigned",
  "Terminated",
  "Archived",
];

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  const employeeId = params.id as string;

  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [jobPositions, setJobPositions] =
    useState<JobPosition[]>([]);

  const [employeeIdNumber, setEmployeeIdNumber] =
    useState("");

  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [jobPositionId, setJobPositionId] =
    useState("");

  const [department, setDepartment] =
    useState("");

  const [dateHired, setDateHired] =
    useState("");

  const [status, setStatus] =
    useState("Probationary");

  const [emergencyContactName, setEmergencyContactName] =
    useState("");

  const [emergencyContactPhone, setEmergencyContactPhone] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /*
   * Load employee and job positions
   */
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        /*
         * Load employee
         */
        const {
          data: employeeData,
          error: employeeError,
        } = await supabase
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
            emergency_contact_phone
          `)
          .eq("id", employeeId)
          .single();

        if (employeeError) {
          console.error(
            "EMPLOYEE LOAD ERROR:",
            employeeError
          );

          setError(
            `Unable to load employee: ${employeeError.message}`
          );

          setLoading(false);
          return;
        }

        /*
         * Load job positions
         *
         * IMPORTANT:
         * We also load department because
         * department is derived from job position.
         */
        const {
          data: positionsData,
          error: positionsError,
        } = await supabase
          .from("hr1_job_positions")
          .select(`
            id,
            title,
            department
          `)
          .order("title");

        if (positionsError) {
          console.error(
            "JOB POSITIONS LOAD ERROR:",
            positionsError
          );

          setError(
            `Unable to load job positions: ${positionsError.message}`
          );

          setLoading(false);
          return;
        }

        const loadedEmployee =
          employeeData as Employee;

        const loadedPositions =
          positionsData ?? [];

        setEmployee(loadedEmployee);
        setJobPositions(loadedPositions);

        /*
         * Fill employee information
         */
        setEmployeeIdNumber(
          loadedEmployee.employee_id_number
        );

        setFirstName(
          loadedEmployee.first_name
        );

        setLastName(
          loadedEmployee.last_name
        );

        setEmail(
          loadedEmployee.email
        );

        setPhone(
          loadedEmployee.phone
        );

        setAddress(
          loadedEmployee.address || ""
        );

        setJobPositionId(
          loadedEmployee.job_position_id
        );

        setDateHired(
          loadedEmployee.date_hired
        );

        setStatus(
          loadedEmployee.status
        );

        setEmergencyContactName(
          loadedEmployee.emergency_contact_name || ""
        );

        setEmergencyContactPhone(
          loadedEmployee.emergency_contact_phone || ""
        );

        /*
         * Determine department from the
         * employee's selected job position.
         *
         * This prevents an old/wrong department
         * value from being displayed.
         */
        const currentPosition =
          loadedPositions.find(
            (position) =>
              position.id ===
              loadedEmployee.job_position_id
          );

        setDepartment(
          currentPosition?.department ??
            loadedEmployee.department ??
            ""
        );
      } catch (err: any) {
        console.error("LOAD DATA CATCH ERROR:", err);
        setError(`An unexpected error occurred: ${err.message || "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    }

    if (employeeId) {
      loadData();
    }
  }, [employeeId, supabase]);

  /*
   * Handle job position change
   *
   * Department automatically follows
   * the selected job position.
   */
  function handleJobPositionChange(
    selectedPositionId: string
  ) {
    setJobPositionId(
      selectedPositionId
    );

    const selectedPosition =
      jobPositions.find(
        (position) =>
          position.id ===
          selectedPositionId
      );

    setDepartment(
      selectedPosition?.department ?? ""
    );
  }

  /*
   * Save employee
   */
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    if (!employeeIdNumber.trim()) {
      setError(
        "Employee ID is required."
      );

      setSaving(false);
      return;
    }

    if (!firstName.trim()) {
      setError(
        "First name is required."
      );

      setSaving(false);
      return;
    }

    if (!lastName.trim()) {
      setError(
        "Last name is required."
      );

      setSaving(false);
      return;
    }

    if (!email.trim()) {
      setError(
        "Email is required."
      );

      setSaving(false);
      return;
    }

    if (!phone.trim()) {
      setError(
        "Phone number is required."
      );

      setSaving(false);
      return;
    }

    if (!jobPositionId) {
      setError(
        "Please select a job position."
      );

      setSaving(false);
      return;
    }

    if (!department.trim()) {
      setError(
        "Department could not be determined from the selected job position."
      );

      setSaving(false);
      return;
    }

    if (!dateHired) {
      setError(
        "Date hired is required."
      );

      setSaving(false);
      return;
    }

    try {
      /*
       * Update employee
       */
      const {
        error: updateError,
      } = await supabase
        .from("hr1_employees")
        .update({
          employee_id_number:
            employeeIdNumber.trim(),

          first_name:
            firstName.trim(),

          last_name:
            lastName.trim(),

          email:
            email.trim(),

          phone:
            phone.trim(),

          address:
            address.trim() || null,

          job_position_id:
            jobPositionId,

          department:
            department.trim(),

          date_hired:
            dateHired,

          status:
            status,

          emergency_contact_name:
            emergencyContactName.trim() ||
            null,

          emergency_contact_phone:
            emergencyContactPhone.trim() ||
            null,
        })
        .eq("id", employeeId);

      if (updateError) {
        console.error(
          "EMPLOYEE UPDATE ERROR:",
          updateError
        );

        setError(
          `Update failed: ${updateError.message}`
        );

        setSaving(false);
        return;
      }

      console.log(
        "EMPLOYEE UPDATED:",
        employeeId
      );

      router.push("/recruitment-core-hub-dashboard/employees");
      router.refresh();
    } catch (err: any) {
      console.error("SUBMIT CATCH ERROR:", err);
      setError(`Save failed: ${err.message || "Unknown error"}`);
      setSaving(false);
    }
  }

  /*
   * Delete employee
   */
  async function handleDelete() {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this employee record?"
      );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("hr1_employees")
        .delete()
        .eq("id", employeeId);

      if (deleteError) {
        console.error(
          "EMPLOYEE DELETE ERROR:",
          deleteError
        );

        setError(
          `Delete failed: ${deleteError.message}`
        );

        setDeleting(false);
        return;
      }

      console.log(
        "EMPLOYEE DELETED:",
        employeeId
      );

      router.push("/recruitment-core-hub-dashboard/employees");
      router.refresh();
    } catch (err: any) {
      console.error("DELETE CATCH ERROR:", err);
      setError(`Delete failed: ${err.message || "Unknown error"}`);
      setDeleting(false);
    }
  }

  /*
   * Loading state
   */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50/50 p-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200/70">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E91E8F] border-t-transparent" />
          <p className="text-xs font-medium text-gray-500">
            Loading employee...
          </p>
        </div>
      </main>
    );
  }

  /*
   * Employee not found
   */
  if (!employee) {
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
              Employee not found
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              The employee record could not be found.
            </p>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
                {error}
              </div>
            )}

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

        <Link
          href="/recruitment-core-hub-dashboard/employees"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Employees
        </Link>

        <div className="mt-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Edit Employee
          </h2>

          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Update employee information and employment details.
          </p>
        </div>

        {/* Form Container */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/75">
          <form
            onSubmit={handleSubmit}
            className="divide-y divide-gray-100"
          >
            <div className="p-6 sm:p-8 space-y-6">

              {/* Employee ID */}
              <div>
                <label
                  htmlFor="employeeId"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                >
                  Employee ID
                </label>

                <input
                  id="employeeId"
                  type="text"
                  value={employeeIdNumber}
                  onChange={(event) =>
                    setEmployeeIdNumber(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20 font-mono font-medium"
                  required
                />
              </div>

              {/* Name */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="firstName"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    First Name
                  </label>

                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(event) =>
                      setFirstName(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Last Name
                  </label>

                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(event) =>
                      setLastName(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                    required
                  />
                </div>
              </div>

              {/* Contact Info Grid */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Phone
                  </label>

                  <input
                    id="phone"
                    type="text"
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                    required
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label
                  htmlFor="address"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                >
                  Address
                </label>

                <textarea
                  id="address"
                  value={address}
                  onChange={(event) =>
                    setAddress(
                      event.target.value
                    )
                  }
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                />
              </div>

              {/* Job Position & Department */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="jobPosition"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Job Position
                  </label>

                  {jobPositions.length === 0 ? (
                    <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                      No job positions found.
                    </div>
                  ) : (
                    <select
                      id="jobPosition"
                      value={jobPositionId}
                      onChange={(event) =>
                        handleJobPositionChange(
                          event.target.value
                        )
                      }
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                    >
                      <option value="">
                        Select a job position
                      </option>

                      {jobPositions.map(
                        (position) => (
                          <option
                            key={position.id}
                            value={position.id}
                          >
                            {position.title}
                          </option>
                        )
                      )}
                    </select>
                  )}

                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Department is automatically determined by the selected job position.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="department"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Department
                  </label>

                  <input
                    id="department"
                    type="text"
                    value={department}
                    readOnly
                    className="w-full rounded-xl border border-gray-200 bg-gray-100/60 px-4 py-3 text-xs sm:text-sm text-gray-600 outline-none cursor-not-allowed"
                  />

                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Automatically determined from the selected job position.
                  </p>
                </div>
              </div>

              {/* Date Hired & Status */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="dateHired"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Date Hired
                  </label>

                  <input
                    id="dateHired"
                    type="date"
                    value={dateHired}
                    onChange={(event) =>
                      setDateHired(
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="status"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Employee Status
                  </label>

                  <select
                    id="status"
                    value={status}
                    onChange={(event) =>
                      setStatus(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                  >
                    {EMPLOYEE_STATUSES.map(
                      (employeeStatus) => (
                        <option
                          key={employeeStatus}
                          value={employeeStatus}
                        >
                          {employeeStatus}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="pt-6">
                <h3 className="text-sm font-bold text-gray-900">
                  Emergency Contact
                </h3>

                <p className="mt-0.5 text-xs text-gray-400">
                  Optional emergency contact information.
                </p>

                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="emergencyContactName"
                      className="mb-1.5 block text-xs font-medium text-gray-600"
                    >
                      Emergency Contact Name
                    </label>

                    <input
                      id="emergencyContactName"
                      type="text"
                      value={emergencyContactName}
                      onChange={(event) =>
                        setEmergencyContactName(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="emergencyContactPhone"
                      className="mb-1.5 block text-xs font-medium text-gray-600"
                    >
                      Emergency Contact Phone
                    </label>

                    <input
                      id="emergencyContactPhone"
                      type="text"
                      value={emergencyContactPhone}
                      onChange={(event) =>
                        setEmergencyContactPhone(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm text-gray-900 outline-none transition focus:border-[#E91E8F] focus:bg-white focus:ring-2 focus:ring-[#E91E8F]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
                  {error}
                </div>
              )}

            </div>

            {/* Buttons */}
            <div className="flex flex-col-reverse gap-3 bg-gray-50/50 px-6 sm:px-8 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleDelete}
                disabled={
                  deleting ||
                  saving
                }
                className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting
                  ? "Deleting..."
                  : "Delete Employee"}
              </button>

              <div className="flex items-center justify-end gap-3">
                <Link
                  href="/recruitment-core-hub-dashboard/employees"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    deleting ||
                    jobPositions.length === 0
                  }
                  className="inline-flex items-center justify-center rounded-xl bg-[#E91E8F] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d8177f] focus:ring-2 focus:ring-[#E91E8F]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </div>

          </form>
        </div>

      </div>

    </main>
  );
}