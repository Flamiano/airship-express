import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  isPerDevHrAdminRole,
  requireHrEmployee,
} from "@/performance-development-dashboard/lib/auth/hrIdentity";
import { listCompetencies } from "@/performance-development-dashboard/lib/performance/competencies";
import {
  listCertifications,
  listCourseEnrollments,
  listCourses,
  listTrainingEnrollments,
  listTrainingEvaluations,
  listTrainingSessions,
} from "@/performance-development-dashboard/lib/performance/learning";
import { LearningDevelopment } from "@/performance-development-dashboard/components/learning/LearningDevelopment";
import type {
  Certification,
  Course,
  CourseEnrollment,
  CurrentPerDevUser,
  EmployeeOption,
  TrainingEnrollment,
  TrainingEvaluation,
  TrainingSession,
} from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

async function loadEmployeeOptions(): Promise<EmployeeOption[]> {
  // Intentionally UNFILTERED by status: the L&D tabs render per-employee
  // history (enrollments, evaluations, certifications) and the employee filter
  // dropdowns are historical queries. New enrollment/certification assignment
  // is restricted to active employees inside the creation modals
  // (EnrollInCourseModal, EnrollInSessionModal, IssueCertificationModal);
  // server creation endpoints reject inactive employees independently.
  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, first_name, last_name, department, job_position_id, status")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    console.error("loadEmployeeOptions: query error:", error);
    return [];
  }

  return (data ?? []).map((employee) => ({
    id: employee.id,
    name: fullName(employee.first_name, employee.last_name),
    department: employee.department,
    job_position_id: employee.job_position_id,
    status: employee.status ?? null,
  }));
}

async function loadOwnEmployeeName(employeeUuid: string | null): Promise<
  Record<string, string>
> {
  if (!employeeUuid) return {};

  const { data } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, first_name, last_name")
    .eq("id", employeeUuid)
    .maybeSingle();

  if (!data) return {};
  return { [data.id]: fullName(data.first_name, data.last_name) };
}

async function loadLearningData() {
  const results = await Promise.all([
    listCourses({}),
    listCourseEnrollments({}),
    listTrainingSessions({}),
    listTrainingEnrollments({}),
    listTrainingEvaluations({}),
    listCertifications({}),
  ]);

  const anyError = results.some((result) => result instanceof NextResponse);

  const fromResult = <T,>(index: number): T[] =>
    results[index] instanceof NextResponse ? [] : (results[index] as T[]);

  return {
    initialCourses: fromResult<Course>(0),
    initialCourseEnrollments: fromResult<CourseEnrollment>(1),
    initialTrainingSessions: fromResult<TrainingSession>(2),
    initialTrainingEnrollments: fromResult<TrainingEnrollment>(3),
    initialTrainingEvaluations: fromResult<TrainingEvaluation>(4),
    initialCertifications: fromResult<Certification>(5),
    initialError: anyError
      ? "Failed to load learning data. Please try again."
      : undefined,
  };
}

export default async function LearningDevelopmentPage() {
  const employee = await requireHrEmployee();
  if (employee instanceof NextResponse) redirect("/hrAuth");

  const isHrAdmin = isPerDevHrAdminRole(employee.role);

  if (!isHrAdmin) {
    const serverUser: CurrentPerDevUser = {
      fullName: employee.fullName,
      role: employee.role,
      email: employee.email,
    };

    const [learning, competenciesResult, employeeNamesById] =
      await Promise.all([
        loadLearningData(),
        listCompetencies({}),
        loadOwnEmployeeName(employee.employeeUuid),
      ]);

    const competenciesById: Record<string, string> = {};
    for (const competency of competenciesResult instanceof NextResponse
      ? []
      : competenciesResult) {
      competenciesById[competency.id] = competency.name;
    }

    return (
      <LearningDevelopment
        serverUser={serverUser}
        isHrAdmin={false}
        initialCourses={learning.initialCourses}
        initialCourseEnrollments={learning.initialCourseEnrollments}
        initialTrainingSessions={learning.initialTrainingSessions}
        initialTrainingEnrollments={learning.initialTrainingEnrollments}
        initialTrainingEvaluations={learning.initialTrainingEvaluations}
        initialCertifications={learning.initialCertifications}
        initialError={learning.initialError}
        employees={[]}
        competenciesById={competenciesById}
        employeeNamesById={employeeNamesById}
        currentUserEmployeeId={employee.employeeUuid}
        defaultEmployeeId={employee.employeeUuid}
      />
    );
  }

  const serverUser: CurrentPerDevUser = {
    fullName: employee.fullName,
    role: employee.role,
    email: employee.email,
  };

  const [learning, competenciesResult, employees] = await Promise.all([
    loadLearningData(),
    listCompetencies({}),
    loadEmployeeOptions(),
  ]);

  const competenciesById: Record<string, string> = {};
  for (const competency of competenciesResult instanceof NextResponse
    ? []
    : competenciesResult) {
    competenciesById[competency.id] = competency.name;
  }

  const employeeNamesById: Record<string, string> = {};
  for (const employeeRow of employees) {
    employeeNamesById[employeeRow.id] = employeeRow.name;
  }

  return (
    <LearningDevelopment
      serverUser={serverUser}
      isHrAdmin
      initialCourses={learning.initialCourses}
      initialCourseEnrollments={learning.initialCourseEnrollments}
      initialTrainingSessions={learning.initialTrainingSessions}
      initialTrainingEnrollments={learning.initialTrainingEnrollments}
      initialTrainingEvaluations={learning.initialTrainingEvaluations}
      initialCertifications={learning.initialCertifications}
      initialError={learning.initialError}
      employees={employees}
      competenciesById={competenciesById}
      employeeNamesById={employeeNamesById}
      currentUserEmployeeId={employee.employeeUuid}
      defaultEmployeeId={employee.employeeUuid}
    />
  );
}