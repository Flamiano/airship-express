export function isAdminRole(role: string): boolean {
  return (
    role === "super_admin" ||
    role === "hr_payroll_admin" ||
    role === "hr_performance_admin"
  );
}

export type AuthenticatedHrUser = {
  authUserId: string;
  role: "super_admin" | "hr_payroll_admin" | "hr_performance_admin" | (string & {});
  employeeId: string | null;
  employeeNumber: string | null;
  fullName: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
};

export type EmployeeDirectoryEntry = {
  id: string;
  employee_id_number: string | null;
  full_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  status: string | null;
};

export type DirectoryUser = {
  id: string;
  name: string;
  jobTitle: string;
};

export type DimensionScore = {
  dimension: string;
  score: number;
};

export type GoalScore = {
  goal_id: string;
  title: string;
  score: number;
};

export type Appraisal = {
  id: string;
  employee_id: string | null;
  reviewer_id: string | null;
  reviewer_hr_admin_id: string | null;
  review_period: string;
  self_rating: number | null;
  manager_rating: number | null;
  performance_rating: string | null;
  letter_grade: string | null;
  final_score: number | null;
  status: string;
  comments: string | null;
  strengths: string | null;
  improvements: string | null;
  manager_dimension_scores: DimensionScore[] | null;
  goal_scores: GoalScore[] | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

export function roleLabel(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "hr_payroll_admin":
      return "HR Admin";
    case "hr_performance_admin":
      return "Performance Admin";
    default:
      return "Employee";
  }
}
