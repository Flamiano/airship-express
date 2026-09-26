import type { ErrorCode } from "./errors";
import type { Schema } from "./validate";

export type FkCheck = {
  field: string;
  table: string;
  message: string;
  when: "always" | "if-present";
};

export type PgErrorMap = Record<string, { code: ErrorCode; message: string }>;

export type PostConfig = {
  schema: Schema;
  profileRequired?: boolean;
  fkChecks?: FkCheck[];
  toInsert: (
    body: Record<string, unknown>,
    actorEmployeeId: string | null
  ) => Record<string, unknown>;
  errorMap?: PgErrorMap;
};

export type PutConfig = {
  schema: Schema;
  toUpdate: (
    body: Record<string, unknown>,
    actorEmployeeId: string | null
  ) => Record<string, unknown>;
  notFoundMessage: string;
  errorMap?: PgErrorMap;
};

export type DeleteConfig = {
  schema: Schema;
  notFoundMessage: string;
  errorMap?: PgErrorMap;
};

export type ResourceConfig = {
  table: string;
  listKey: string;
  itemKey: string;
  select?: string;
  getAccess: "authenticated" | "admin";
  getScope?: "by-employee";
  orderBy?: { column: string; ascending?: boolean };
  post?: PostConfig;
  put?: PutConfig;
  del?: DeleteConfig;
};

export function getResourceConfig(
  resource: string
): ResourceConfig | undefined {
  return RESOURCE_CONFIGS[resource];
}

export const RESOURCE_CONFIGS: Record<string, ResourceConfig> = {
  badges: {
    table: "hr3_badges",
    listKey: "badges",
    itemKey: "badge",
    getAccess: "authenticated",
    post: {
      schema: {
        name: { type: "string", min: 1, max: 200 },
        description: { type: "string", optional: true, max: 1000 },
        icon_url: { type: "string", optional: true, max: 500 },
      },
      toInsert: (body) => ({
        name: body.name,
        description: body.description,
        icon_url: body.icon_url,
      }),
    },
  },

  competency: {
    table: "hr3_competencies",
    listKey: "competencies",
    itemKey: "competency",
    getAccess: "authenticated",
    post: {
      schema: {
        name: { type: "string", min: 1, max: 200 },
        description: { type: "string", optional: true, max: 1000 },
        category: { type: "string", optional: true, max: 100 },
      },
      toInsert: (body) => ({
        name: body.name,
        description: body.description,
        category: body.category,
      }),
    },
    put: {
      schema: {
        id: { type: "uuid" },
        name: { type: "string", optional: true, max: 200 },
        description: { type: "string", optional: true, max: 1000 },
        category: { type: "string", optional: true, max: 100 },
      },
      toUpdate: (body) => ({
        name: body.name,
        description: body.description,
        category: body.category,
      }),
      notFoundMessage: "Competency not found",
    },
    del: {
      schema: { id: { type: "uuid" } },
      notFoundMessage: "Competency not found",
    },
  },

  pip: {
    table: "hr3_performance_improvement_plans",
    listKey: "pips",
    itemKey: "pip",
    getAccess: "authenticated",
    getScope: "by-employee",
    orderBy: { column: "created_at", ascending: false },
    post: {
      schema: {
        employee_id: { type: "uuid" },
        reason: { type: "string", min: 1, max: 1000 },
        action_plan: { type: "string", min: 1, max: 2000 },
        start_date: { type: "date" },
        end_date: { type: "date", optional: true },
      },
      toInsert: (body) => ({
        employee_id: body.employee_id,
        reason: body.reason,
        action_plan: body.action_plan,
        start_date: body.start_date,
        end_date: body.end_date,
      }),
    },
    put: {
      schema: {
        id: { type: "uuid" },
        action_plan: { type: "string", optional: true, max: 2000 },
        status: {
          type: "string",
          optional: true,
          enum: ["active", "completed", "failed"],
        },
        end_date: { type: "date", optional: true },
      },
      toUpdate: (body) => ({
        action_plan: body.action_plan,
        status: body.status,
        end_date: body.end_date,
      }),
      notFoundMessage: "Performance improvement plan not found",
    },
    del: {
      schema: { id: { type: "uuid" } },
      notFoundMessage: "Performance improvement plan not found",
    },
  },

  courses: {
    table: "hr3_courses",
    listKey: "courses",
    itemKey: "course",
    select: "*, hr3_competencies(name)",
    getAccess: "authenticated",
    post: {
      schema: {
        title: { type: "string", min: 1, max: 200 },
        description: { type: "string", optional: true, max: 2000 },
        duration_minutes: { type: "number", integer: true, min: 1, max: 10080 },
        competency_id: { type: "uuid", optional: true },
      },
      profileRequired: true,
      fkChecks: [
        {
          field: "competency_id",
          table: "hr3_competencies",
          message: "Competency not found",
          when: "if-present",
        },
      ],
      toInsert: (body, actorEmployeeId) => ({
        title: body.title,
        description: body.description,
        duration_minutes: body.duration_minutes,
        competency_id: body.competency_id || null,
        created_by: actorEmployeeId,
      }),
    },
    put: {
      schema: {
        id: { type: "uuid" },
        title: { type: "string", optional: true, max: 200 },
        description: { type: "string", optional: true, max: 2000 },
        duration_minutes: {
          type: "number",
          optional: true,
          integer: true,
          min: 1,
          max: 10080,
        },
        competency_id: { type: "uuid", optional: true },
      },
      toUpdate: (body) => ({
        title: body.title,
        description: body.description,
        duration_minutes: body.duration_minutes,
        competency_id: body.competency_id || null,
      }),
      notFoundMessage: "Course not found",
    },
    del: {
      schema: { id: { type: "uuid" } },
      notFoundMessage: "Course not found",
    },
  },

  sessions: {
    table: "hr3_training_sessions",
    listKey: "sessions",
    itemKey: "session",
    select: "*, hr3_competencies(name)",
    getAccess: "authenticated",
    post: {
      schema: {
        title: { type: "string", min: 1, max: 200 },
        trainer_name: { type: "string", min: 1, max: 200 },
        trainer_type: { type: "string", enum: ["internal", "external"] },
        mode: { type: "string", min: 1, max: 100 },
        venue: { type: "string", optional: true, max: 500 },
        schedule_date: { type: "date" },
        capacity: { type: "number", integer: true, min: 1, max: 10000 },
        cost: { type: "number", min: 0 },
        session_type: {
          type: "string",
          optional: true,
          enum: ["development", "mandatory"],
        },
        competency_id: { type: "uuid", optional: true },
        auto_enroll: { type: "boolean", optional: true },
      },
      fkChecks: [
        {
          field: "competency_id",
          table: "hr3_competencies",
          message: "Competency not found",
          when: "if-present",
        },
      ],
      toInsert: (body) => ({
        title: body.title,
        trainer_name: body.trainer_name,
        trainer_type: body.trainer_type,
        mode: body.mode,
        venue: body.venue,
        schedule_date: body.schedule_date,
        capacity: body.capacity,
        cost: body.cost,
        session_type: body.session_type ?? "development",
        competency_id: body.competency_id || null,
      }),
    },
    put: {
      schema: {
        id: { type: "uuid" },
        title: { type: "string", optional: true, max: 200 },
        trainer_name: { type: "string", optional: true, max: 200 },
        trainer_type: {
          type: "string",
          optional: true,
          enum: ["internal", "external"],
        },
        mode: { type: "string", optional: true, max: 100 },
        venue: { type: "string", optional: true, max: 500 },
        schedule_date: { type: "date", optional: true },
        capacity: {
          type: "number",
          optional: true,
          integer: true,
          min: 1,
          max: 10000,
        },
        cost: { type: "number", optional: true, min: 0 },
        session_type: {
          type: "string",
          optional: true,
          enum: ["development", "mandatory"],
        },
        competency_id: { type: "uuid", optional: true },
      },
      toUpdate: (body) => ({
        title: body.title,
        trainer_name: body.trainer_name,
        trainer_type: body.trainer_type,
        mode: body.mode,
        venue: body.venue,
        schedule_date: body.schedule_date,
        capacity: body.capacity,
        cost: body.cost,
        session_type: body.session_type,
        competency_id: body.competency_id || null,
      }),
      notFoundMessage: "Training session not found",
    },
    del: {
      schema: { id: { type: "uuid" } },
      notFoundMessage: "Training session not found",
    },
  },

  "competency-scores": {
    table: "hr3_employee_competency_scores",
    listKey: "scores",
    itemKey: "score",
    select: "*, hr3_competencies(name, category)",
    getAccess: "authenticated",
    getScope: "by-employee",
    post: {
      schema: {
        employee_id: { type: "uuid" },
        competency_id: { type: "uuid" },
        current_level: { type: "number", integer: true, min: 1, max: 5 },
        required_level: { type: "number", optional: true, integer: true, min: 1, max: 5 },
      },
      profileRequired: true,
      fkChecks: [
        {
          field: "competency_id",
          table: "hr3_competencies",
          message: "Competency not found",
          when: "always",
        },
      ],
      toInsert: (body, actorEmployeeId) => ({
        employee_id: body.employee_id,
        competency_id: body.competency_id,
        current_level: body.current_level,
        required_level: body.required_level,
        assessed_by: actorEmployeeId,
      }),
    },
    put: {
      schema: {
        id: { type: "uuid" },
        current_level: {
          type: "number",
          optional: true,
          integer: true,
          min: 1,
          max: 5,
        },
        required_level: {
          type: "number",
          optional: true,
          integer: true,
          min: 1,
          max: 5,
        },
      },
      toUpdate: (body) => ({
        current_level: body.current_level,
        required_level: body.required_level,
        assessed_at: new Date().toISOString(),
      }),
      notFoundMessage: "Competency score not found",
    },
    del: {
      schema: { id: { type: "uuid" } },
      notFoundMessage: "Competency score not found",
    },
  },

  "succession-candidates": {
    table: "hr3_succession_candidates",
    listKey: "candidates",
    itemKey: "candidate",
    select:
      "*, hr3_critical_positions(*, hr1_job_positions!hr3_critical_positions_position_id_fkey(id, title, department, is_active))",
    getAccess: "admin",
    post: {
      schema: {
        position_id: { type: "uuid" },
        employee_id: { type: "uuid" },
        readiness_level: {
          type: "string",
          enum: ["ready_now", "1-2_years", "3+_years"],
        },
        potential_rating: { type: "number", min: 1, max: 5 },
        performance_rating: { type: "number", min: 1, max: 5 },
        development_notes: { type: "string", optional: true, max: 2000 },
      },
      fkChecks: [
        {
          field: "position_id",
          table: "hr3_critical_positions",
          message: "Critical position not found",
          when: "always",
        },
      ],
      toInsert: (body) => ({
        position_id: body.position_id,
        employee_id: body.employee_id,
        readiness_level: body.readiness_level,
        potential_rating: body.potential_rating,
        performance_rating: body.performance_rating,
        development_notes: body.development_notes,
      }),
      errorMap: {
        "23505": {
          code: "CONFLICT",
          message:
            "This employee is already a candidate for this position",
        },
      },
    },
    put: {
      schema: {
        id: { type: "uuid" },
        readiness_level: {
          type: "string",
          optional: true,
          enum: ["ready_now", "1-2_years", "3+_years"],
        },
        potential_rating: { type: "number", optional: true, min: 1, max: 5 },
        performance_rating: { type: "number", optional: true, min: 1, max: 5 },
        development_notes: { type: "string", optional: true, max: 2000 },
      },
      toUpdate: (body) => ({
        readiness_level: body.readiness_level,
        potential_rating: body.potential_rating,
        performance_rating: body.performance_rating,
        development_notes: body.development_notes,
      }),
      notFoundMessage: "Succession candidate not found",
    },
    del: {
      schema: { id: { type: "uuid" } },
      notFoundMessage: "Succession candidate not found",
    },
  },

  "critical-positions": {
    table: "hr3_critical_positions",
    listKey: "positions",
    itemKey: "position",
    select:
      "*, hr1_job_positions!hr3_critical_positions_position_id_fkey(id, title, department, is_active)",
    getAccess: "admin",
    post: {
      schema: {
        position_id: { type: "uuid" },
        risk_level: {
          type: "string",
          optional: true,
          enum: ["low", "medium", "high"],
        },
        reason: { type: "string", optional: true, max: 1000 },
      },
      fkChecks: [
        {
          field: "position_id",
          table: "hr1_job_positions",
          message: "Job position not found",
          when: "always",
        },
      ],
      toInsert: (body) => ({
        position_id: body.position_id,
        risk_level: body.risk_level || "medium",
        reason: body.reason,
      }),
      errorMap: {
        "23505": {
          code: "CONFLICT",
          message: "This position is already flagged as critical",
        },
      },
    },
    del: {
      schema: { id: { type: "uuid" } },
      notFoundMessage: "Critical position not found",
      errorMap: {
        "23503": {
          code: "CONFLICT",
          message: "Remove this position's candidates first",
        },
      },
    },
  },
};
