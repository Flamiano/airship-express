"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type JobPosition = {
  id: string;
  title: string;
  department: string;
};

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  job_position_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

const EMPLOYEE_STATUSES = [
  "Active",
  "Probationary",
  "Regular",
  "Resigned",
  "Terminated",
  "Archived",
];

export default function NewEmployeePage() {
  const router = useRouter();
  const supabase = createClient();

  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [applicantId, setApplicantId] = useState("");
  const [employeeIdNumber, setEmployeeIdNumber] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [address, setAddress] = useState("");

  const [jobPositionId, setJobPositionId] = useState("");

  const [department, setDepartment] = useState("");

  const [dateHired, setDateHired] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [status, setStatus] = useState("Probationary");

  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  /*
   * Load applicants and job positions
   */
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoadingData(true);
      setError("");

      try {
        const [applicantsResult, positionsResult, employeesResult] =
          await Promise.all([
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
                job_position_id,
                emergency_contact_name,
                emergency_contact_phone
              `
              )
              .order("first_name"),

            supabase
              .from("hr1_job_positions")
              .select(
                `
                id,
                title,
                department
              `
              )
              .order("title"),

            supabase.from("hr1_employees").select("applicant_id"),
          ]);

        if (!isMounted) return;

        if (applicantsResult.error) {
          console.error("APPLICANTS LOAD ERROR:", applicantsResult.error);
          setError(
            `Unable to load applicants: ${applicantsResult.error.message}`
          );
          setLoadingData(false);
          return;
        }

        if (positionsResult.error) {
          console.error("JOB POSITIONS LOAD ERROR:", positionsResult.error);
          setError(
            `Unable to load job positions: ${positionsResult.error.message}`
          );
          setLoadingData(false);
          return;
        }

        if (employeesResult.error) {
          console.error("EMPLOYEES LOAD ERROR:", employeesResult.error);
          setError(
            `Unable to load existing employees: ${employeesResult.error.message}`
          );
          setLoadingData(false);
          return;
        }

        const existingApplicantIds = new Set(
          (employeesResult.data ?? [])
            .map((employee) => employee.applicant_id)
            .filter(Boolean)
        );

        const availableApplicants = (applicantsResult.data ?? []).filter(
          (applicant) => !existingApplicantIds.has(applicant.id)
        );

        setApplicants(availableApplicants);
        setJobPositions(positionsResult.data ?? []);
      } catch (err: any) {
        if (!isMounted) return;
        console.error("UNEXPECTED LOAD ERROR:", err);
        setError(`An unexpected error occurred: ${err.message || err}`);
      } finally {
        if (isMounted) {
          setLoadingData(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  /*
   * When an applicant is selected,
   * automatically fill applicant information.
   */
  function handleApplicantChange(selectedApplicantId: string) {
    setApplicantId(selectedApplicantId);

    if (!selectedApplicantId) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setEmergencyContactName("");
      setEmergencyContactPhone("");
      setJobPositionId("");
      setDepartment("");
      return;
    }

    const selectedApplicant = applicants.find(
      (applicant) => applicant.id === selectedApplicantId
    );

    if (!selectedApplicant) return;

    setFirstName(selectedApplicant.first_name ?? "");
    setLastName(selectedApplicant.last_name ?? "");
    setEmail(selectedApplicant.email ?? "");
    setPhone(selectedApplicant.phone ?? "");
    setAddress(selectedApplicant.address ?? "");

    setEmergencyContactName(
      selectedApplicant.emergency_contact_name ?? ""
    );

    setEmergencyContactPhone(
      selectedApplicant.emergency_contact_phone ?? ""
    );

    const selectedPosId = selectedApplicant.job_position_id ?? "";
    setJobPositionId(selectedPosId);

    const selectedPosition = jobPositions.find(
      (pos) => pos.id === selectedPosId
    );
    setDepartment(selectedPosition?.department ?? "");
  }

  /*
   * Handle manual Job Position Selection
   */
  function handleJobPositionChange(selectedPosId: string) {
    setJobPositionId(selectedPosId);

    const selectedPos = jobPositions.find((pos) => pos.id === selectedPosId);
    setDepartment(selectedPos?.department ?? "");
  }

  /*
   * Save employee
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");

    if (!employeeIdNumber.trim()) {
      setError("Please enter an employee ID number.");
      setSaving(false);
      return;
    }

    if (!firstName.trim()) {
      setError("Please enter the employee first name.");
      setSaving(false);
      return;
    }

    if (!lastName.trim()) {
      setError("Please enter the employee last name.");
      setSaving(false);
      return;
    }

    if (!email.trim()) {
      setError("Please enter the employee email.");
      setSaving(false);
      return;
    }

    if (!phone.trim()) {
      setError("Please enter the employee phone number.");
      setSaving(false);
      return;
    }

    if (!jobPositionId) {
      setError("Please select a job position.");
      setSaving(false);
      return;
    }

    const selectedPosition = jobPositions.find(
      (pos) => pos.id === jobPositionId
    );

    if (!selectedPosition) {
      setError("Selected job position was not found.");
      setSaving(false);
      return;
    }

    const selectedDepartment = selectedPosition.department;

    if (!selectedDepartment.trim()) {
      setError("The selected job position has no department.");
      setSaving(false);
      return;
    }

    if (!dateHired) {
      setError("Please select the date hired.");
      setSaving(false);
      return;
    }

    try {
      /*
       * Create employee record
       */
      const { data, error: employeeError } = await supabase
        .from("hr1_employees")
        .insert({
          applicant_id: applicantId || null,
          employee_id_number: employeeIdNumber.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim() || null,
          job_position_id: jobPositionId,
          department: selectedDepartment.trim(),
          date_hired: dateHired,
          status: status,
          emergency_contact_name: emergencyContactName.trim() || null,
          emergency_contact_phone: emergencyContactPhone.trim() || null,
        })
        .select()
        .single();

      if (employeeError) {
        console.error("EMPLOYEE INSERT ERROR:", employeeError);
        setError(`Save failed: ${employeeError.message}`);
        setSaving(false);
        return;
      }

      /*
       * Update applicant status if linked
       */
      if (applicantId) {
        const { error: applicantError } = await supabase
          .from("hr1_applicants")
          .update({ status: "Hired" })
          .eq("id", applicantId);

        if (applicantError) {
          console.error("APPLICANT STATUS UPDATE ERROR:", applicantError);
        }
      }

      router.push("/recruitment-core-hub-dashboard/employees");
      router.refresh();
    } catch (err: any) {
      console.error("UNEXPECTED SAVE ERROR:", err);
      setError(`An unexpected error occurred: ${err.message || err}`);
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E91E8F]/10 text-[#E91E8F]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-slate-400">Human Resource Department</p>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Recruitment & Employee Records
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-slate-100">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">
                Super Admin
              </p>
              <p className="text-xs text-slate-400 mt-1">Administrator</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#E91E8F] to-[#f458ad] text-xs font-bold text-white shadow-sm ring-2 ring-white">
              SA
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Navigation & Header */}
        <div className="mb-6">
          <Link
            href="/recruitment-core-hub-dashboard/employees"
            className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-[#E91E8F] transition-colors group mb-3"
          >
            <span className="mr-1.5 transition-transform group-hover:-translate-x-1">←</span>
            Back to Employees
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Add New Employee</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fill in the details below or select an existing applicant to pre-populate the form.
              </p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="divide-y divide-slate-100">

            {/* Applicant Quick-Import Banner Section */}
            <div className="bg-gradient-to-r from-slate-50 via-pink-50/20 to-slate-50 p-5 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <label
                  htmlFor="applicant"
                  className="text-sm font-semibold text-slate-800 flex items-center gap-2"
                >
                  <svg className="h-4 w-4 shrink-0 text-[#E91E8F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Import From Existing Applicant
                </label>
                <span className="text-xs text-slate-400 font-normal">(Optional)</span>
              </div>

              {loadingData ? (
                <div className="flex items-center gap-3 py-3 px-4 rounded-xl border border-slate-200 bg-white/60 text-sm text-slate-500 animate-pulse">
                  <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-[#E91E8F]" />
                  <span>Loading eligible applicants...</span>
                </div>
              ) : applicants.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500">No eligible applicants found for import.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">You can proceed by manually filling out the employee details below.</p>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="applicant"
                    value={applicantId}
                    onChange={(e) => handleApplicantChange(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 shadow-sm pr-10 truncate"
                  >
                    <option value="">Select an applicant to auto-fill form...</option>
                    {applicants.map((applicant) => (
                      <option key={applicant.id} value={applicant.id}>
                        {applicant.first_name} {applicant.last_name} — {applicant.email}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Selecting an applicant automatically populates their contact details, position, and emergency contacts.
              </p>
            </div>

            {/* Primary Details Section */}
            <div className="p-5 sm:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">1</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Personal Details</h3>
              </div>
              
              {/* Employee ID */}
              <div>
                <label
                  htmlFor="employeeId"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Employee ID Number <span className="text-rose-500">*</span>
                </label>
                <input
                  id="employeeId"
                  type="text"
                  value={employeeIdNumber}
                  onChange={(e) => setEmployeeIdNumber(e.target.value)}
                  placeholder="EMP-0001"
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 placeholder:text-slate-400"
                />
              </div>

              {/* First & Last Name */}
              <div className="grid gap-5 sm:gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="firstName"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="Enter first name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Enter last name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid gap-5 sm:gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="09123456789"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label
                  htmlFor="address"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Residential Address
                </label>
                <textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="Street address, city, province, postal code"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 placeholder:text-slate-400 resize-none"
                />
              </div>
            </div>

            {/* Employment & Assignment Section */}
            <div className="p-5 sm:p-8 space-y-6 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">2</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Job Assignment</h3>
              </div>

              {/* Job Position & Department Grid */}
              <div className="grid gap-5 sm:gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="jobPosition"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Job Position <span className="text-rose-500">*</span>
                  </label>

                  {loadingData ? (
                    <div className="h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400 animate-pulse flex items-center">
                      Loading positions...
                    </div>
                  ) : jobPositions.length === 0 ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
                      No job positions available. Please create a position first.
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        id="jobPosition"
                        value={jobPositionId}
                        onChange={(e) => handleJobPositionChange(e.target.value)}
                        required
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 pr-10"
                      >
                        <option value="">Select a job position</option>
                        {jobPositions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {position.title}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="department"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Department
                  </label>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    readOnly
                    placeholder="Auto-populated from position"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100/70 px-4 py-2.5 text-sm text-slate-500 outline-none cursor-not-allowed placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Date Hired & Status */}
              <div className="grid gap-5 sm:gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="dateHired"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Date Hired <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="dateHired"
                    type="date"
                    value={dateHired}
                    onChange={(e) => setDateHired(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="status"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Employee Status <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 pr-10"
                    >
                      {EMPLOYEE_STATUSES.map((employeeStatus) => (
                        <option key={employeeStatus} value={employeeStatus}>
                          {employeeStatus}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Contacts Section */}
            <div className="p-5 sm:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">3</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Emergency Contact</h3>
              </div>

              <div className="grid gap-5 sm:gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="emergencyContactName"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Contact Name
                  </label>
                  <input
                    id="emergencyContactName"
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Enter contact name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="emergencyContactPhone"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Contact Phone Number
                  </label>
                  <input
                    id="emergencyContactPhone"
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="09123456789"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Error Message & Form Actions */}
            <div className="p-5 sm:p-8 bg-slate-50/80 flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200/60 p-4 text-xs font-medium text-rose-700">
                  <svg className="h-4 w-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                <Link
                  href="/recruitment-core-hub-dashboard/employees"
                  className="w-full sm:w-auto text-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={saving || loadingData || jobPositions.length === 0}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#E91E8F] px-6 py-2.5 text-xs font-semibold text-white shadow-sm shadow-[#E91E8F]/30 transition hover:bg-[#d8177f] focus:outline-none focus:ring-4 focus:ring-[#E91E8F]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    "Create Employee"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}