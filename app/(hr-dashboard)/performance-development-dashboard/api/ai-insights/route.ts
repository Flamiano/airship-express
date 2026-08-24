import { NextResponse } from "next/server";
import {
  handle,
  validateJson,
  validationResponse,
  type FieldError,
  type Schema,
} from "../lib/validate";
import { getAuthenticatedHrUser } from "../lib/auth";

type EmployeeInput = {
  name: string;
  role: string;
};

type GoalInput = {
  title: string;
};

type FeedbackInput = {
  message: string;
  feedback_type?: string;
};

type CompetencyInput = {
  name: string;
  score?: number;
};

type AppraisalInput = Record<string, unknown>;

type AiInsightsRequest = {
  employee: EmployeeInput;
  goals?: GoalInput[];
  appraisal?: AppraisalInput;
  feedback?: FeedbackInput[];
  competencies?: CompetencyInput[];
};

type AiInsightsResponse = {
  success: boolean;
  mock: boolean;
  insights: {
    summary: string;
    strengths: string[];
    areasForImprovement: string[];
    recommendations: string[];
  };
};

const AI_INSIGHTS_BODY_SCHEMA: Schema = {
  goals: {
    type: "array",
    optional: true,
    max: 200,
    item: {
      title: { type: "string", min: 1, max: 500 },
    },
  },
  feedback: {
    type: "array",
    optional: true,
    max: 100,
    item: {
      message: { type: "string", min: 1, max: 1000 },
      feedback_type: { type: "string", optional: true, max: 50 },
    },
  },
  competencies: {
    type: "array",
    optional: true,
    max: 100,
    item: {
      name: { type: "string", min: 1, max: 200 },
      score: { type: "number", optional: true, min: 0, max: 100 },
    },
  },
};

function validateEmployee(employee: unknown): FieldError[] {
  const errors: FieldError[] = [];

  if (employee === undefined || employee === null) {
    return [{ field: "employee", message: "employee is required" }];
  }

  if (typeof employee !== "object" || Array.isArray(employee)) {
    return [{ field: "employee", message: "employee must be an object" }];
  }

  const { name, role } = employee as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.push({
      field: "employee.name",
      message: "employee.name must be a non-empty string",
    });
  }

  if (typeof role !== "string" || role.trim().length === 0) {
    errors.push({
      field: "employee.role",
      message: "employee.role must be a non-empty string",
    });
  }

  return errors;
}

function validateAppraisal(appraisal: unknown): FieldError[] {
  if (appraisal === undefined || appraisal === null) return [];
  if (typeof appraisal !== "object" || Array.isArray(appraisal)) {
    return [{ field: "appraisal", message: "appraisal must be an object" }];
  }
  return [];
}

function buildMockInsights(body: AiInsightsRequest): AiInsightsResponse {
  const goals = Array.isArray(body.goals) ? body.goals : [];
  const feedback = Array.isArray(body.feedback) ? body.feedback : [];
  const competencies = Array.isArray(body.competencies)
    ? body.competencies
    : [];
  const hasAppraisal =
    body.appraisal !== undefined &&
    body.appraisal !== null &&
    Object.keys(body.appraisal).length > 0;

  return {
    success: true,
    mock: true,
    insights: {
      summary: `Demo AI summary for ${body.employee.name} (${body.employee.role}) — generated from ${goals.length} goal(s), ${feedback.length} feedback item(s), and ${competencies.length} competency record(s)${hasAppraisal ? ", plus an appraisal" : ""}. This is placeholder mock output and not real analysis.`,
      strengths: [
        "Strong goal completion rate (sample)",
        "Consistently positive feedback from peers (sample)",
        "High competency score in core skills (sample)",
      ],
      areasForImprovement: [
        "Follow-through on long-term objectives (sample)",
        "Cross-team collaboration visibility (sample)",
      ],
      recommendations: [
        "Schedule a development check-in to review progress (sample)",
        "Enroll in a course aligned to the top competency gap (sample)",
      ],
    },
  };
}

export const POST = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;

  const parsed = await validateJson(request, AI_INSIGHTS_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const errors = [
    ...validateEmployee(body.employee),
    ...validateAppraisal(body.appraisal),
  ];
  if (errors.length > 0) return validationResponse(errors);

  const response = buildMockInsights(body as AiInsightsRequest);
  return NextResponse.json(response);
});
