import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { handle, internalError, validateJson, type Schema } from "../lib/validate";
import { getAuthenticatedHrUser } from "../lib/auth";

export const dynamic = "force-dynamic";

type AiInsightsResult = {
  success: boolean;
  source: "gemini" | "heuristic";
  subjectName: string;
  scope: "self" | "org";
  insufficientData: boolean;
  insights: {
    summary: string;
    strengths: string[];
    developmentAreas: string[];
    recommendedActions: string[];
    recommendedLearning: string[];
    attention: string[];
  };
};

/* ------------------------------------------------------------------ */
/* Request contract                                                    */
/* ------------------------------------------------------------------ */

const AI_INSIGHTS_BODY_SCHEMA: Schema = {
  // Admins may optionally target a specific employee. Employees are always
  // bound to their own identity server-side; this value is never trusted
  // for an employee's analysis.
  employee_id: { type: "uuid", optional: true },
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

/* ------------------------------------------------------------------ */
/* Self / individual scoped data (employee, or admin picking an employee) */
/* ------------------------------------------------------------------ */

type IndividualData = {
  subjectName: string;
  roleLabel: string;
  goals: Record<string, unknown>[];
  appraisals: Record<string, unknown>[];
  feedback: Record<string, unknown>[];
  recognitions: Record<string, unknown>[];
  competencies: Record<string, unknown>[];
  courseEnrollments: Record<string, unknown>[];
  trainings: Record<string, unknown>[];
};

async function loadIndividualData(
  subjectEmployeeId: string,
  actorName: string
): Promise<IndividualData> {
  const [
    goalsQ,
    appraisalsQ,
    feedbackQ,
    recognitionsQ,
    competencyScoresQ,
    courseEnrollmentsQ,
    trainingsQ,
  ] = await Promise.all([
    supabaseAdmin.from("hr3_performance_goals").select("*").eq("employee_id", subjectEmployeeId),
    supabaseAdmin
      .from("hr3_performance_appraisals")
      .select("*")
      .eq("employee_id", subjectEmployeeId),
    supabaseAdmin
      .from("hr3_performance_feedback")
      .select("*")
      .eq("employee_id", subjectEmployeeId),
    supabaseAdmin
      .from("hr3_recognitions")
      .select("*, hr3_badges(name)")
      .eq("recipient_id", subjectEmployeeId),
    supabaseAdmin
      .from("hr3_employee_competency_scores")
      .select("*, hr3_competencies(name, category)")
      .eq("employee_id", subjectEmployeeId),
    supabaseAdmin
      .from("hr3_course_enrollments")
      .select("*, hr3_courses(title)")
      .eq("employee_id", subjectEmployeeId),
    supabaseAdmin
      .from("hr3_training_enrollments")
      .select("*, hr3_training_sessions(title, session_type, schedule_date)")
      .eq("employee_id", subjectEmployeeId),
  ]);

  const get = <T>(r: { data: T[] | null }): T[] => r.data ?? [];

  let subjectName = actorName;
  let roleLabel = "";
  try {
    const { data: emp } = await supabaseAdmin
      .from("hr1_employees")
      .select(
        "first_name, last_name, job_position:hr1_job_positions(title), department"
      )
      .eq("id", subjectEmployeeId)
      .maybeSingle();
    if (emp) {
      const rec = emp as {
        first_name?: string | null;
        last_name?: string | null;
        job_position?: { title: string | null } | { title: string | null }[] | null;
        department?: string | null;
      };
      const name = [rec.first_name, rec.last_name]
        .filter((p): p is string => Boolean(p))
        .join(" ")
        .trim();
      if (name) subjectName = name;
      roleLabel =
        (Array.isArray(rec.job_position)
          ? rec.job_position[0]?.title ?? null
          : rec.job_position?.title ?? null) ??
        rec.department ??
        "";
    }
  } catch {
    // name default retained
  }

  return {
    subjectName,
    roleLabel,
    goals: get(goalsQ),
    appraisals: get(appraisalsQ),
    feedback: get(feedbackQ),
    recognitions: get(recognitionsQ),
    competencies: get(competencyScoresQ),
    courseEnrollments: get(courseEnrollmentsQ),
    trainings: get(trainingsQ),
  };
}

/* ------------------------------------------------------------------ */
/* Org-wide data (admins only)                                          */
/* ------------------------------------------------------------------ */

type OrgData = {
  goals: Record<string, unknown>[];
  appraisals: Record<string, unknown>[];
  pips: Record<string, unknown>[];
  recognitions: Record<string, unknown>[];
  competencyScores: Record<string, unknown>[];
  courseEnrollments: Record<string, unknown>[];
  trainings: Record<string, unknown>[];
  succession: Record<string, unknown>[];
};

async function loadOrgData(): Promise<OrgData> {
  const [
    goalsQ,
    appraisalsQ,
    pipsQ,
    recognitionsQ,
    competencyScoresQ,
    courseEnrollmentsQ,
    trainingsQ,
    successionQ,
  ] = await Promise.all([
    supabaseAdmin.from("hr3_performance_goals").select("*"),
    supabaseAdmin.from("hr3_performance_appraisals").select("*"),
    supabaseAdmin.from("hr3_performance_improvement_plans").select("*"),
    supabaseAdmin.from("hr3_recognitions").select("*, hr3_badges(name)"),
    supabaseAdmin
      .from("hr3_employee_competency_scores")
      .select("*, hr3_competencies(name, category)"),
    supabaseAdmin
      .from("hr3_course_enrollments")
      .select("*, hr3_courses(title)"),
    supabaseAdmin
      .from("hr3_training_enrollments")
      .select("*, hr3_training_sessions(title, session_type, schedule_date)"),
    supabaseAdmin
      .from("hr3_succession_candidates")
      .select("*, hr3_critical_positions(position_id)"),
  ]);

  const get = <T>(r: { data: T[] | null }): T[] => r.data ?? [];

  return {
    goals: get(goalsQ),
    appraisals: get(appraisalsQ),
    pips: get(pipsQ),
    recognitions: get(recognitionsQ),
    competencyScores: get(competencyScoresQ),
    courseEnrollments: get(courseEnrollmentsQ),
    trainings: get(trainingsQ),
    succession: get(successionQ),
  };
}

/* ------------------------------------------------------------------ */
/* Heuristic fallbacks (deterministic, clearly labeled)                */
/* ------------------------------------------------------------------ */

function individualHeuristic(
  data: IndividualData
): AiInsightsResult["insights"] {
  const goals = data.goals;
  const completed = goals.filter((g) => g.status === "completed");
  const inProgress = goals.filter((g) => g.status === "in_progress");
  const activeAppraisals = data.appraisals.filter(
    (a) => a.status === "draft" || a.status === "reviewed"
  );
  const accessors = new Set<string>();
  data.feedback.forEach((f) => {
    if (typeof f.given_by === "string" && f.given_by) accessors.add(f.given_by);
  });
  const points = data.recognitions.reduce(
    (sum: number, r) => sum + (num(r.points) ?? 0),
    0
  );
  const gaps = data.competencies.filter((c) => {
    const cur = num(c.current_level);
    const req = num(c.required_level);
    return cur !== null && req !== null && cur < req;
  }) as { hr3_competencies?: { name?: string | null } | null }[];
  const inProgressCourses = data.courseEnrollments.filter(
    (e) => e.status === "in_progress"
  );
  const completedCourses = data.courseEnrollments.filter(
    (e) => e.status === "completed"
  );

  const strengths: string[] = [];
  if (completed.length > 0)
    strengths.push(`Completed ${completed.length} goal(s) to date.`);
  if (data.recognitions.length > 0)
    strengths.push(
      `Received ${data.recognitions.length} recognition(s) totaling ${points} points.`
    );
  if (accessors.size > 0)
    strengths.push(`Received feedback from ${accessors.size} different people.`);
  if (completedCourses.length > 0)
    strengths.push(`Completed ${completedCourses.length} course enrollment(s).`);

  const developmentAreas: string[] = [];
  if (gaps.length > 0) {
    const names = gaps
      .map((g) => g.hr3_competencies?.name ?? "a competency")
      .slice(0, 3)
      .join(", ");
    developmentAreas.push(
      `Competency gap(s): ${names} (current level below required).`
    );
  }
  if (activeAppraisals.length > 0)
    developmentAreas.push(
      `${activeAppraisals.length} performance record(s) not yet finalized.`
    );
  if (goals.length === 0)
    developmentAreas.push("No goals are being tracked yet.");

  const recommendedActions: string[] = [];
  if (goals.length > 0)
    recommendedActions.push(
      "Review open goals and keep progress and status current."
    );
  if (activeAppraisals.length > 0)
    recommendedActions.push(
      "Follow through on outstanding performance reviews and acknowledgment."
    );

  const recommendedLearning: string[] = [];
  if (gaps.length > 0) {
    const names = gaps
      .map((g) => g.hr3_competencies?.name ?? "a competency")
      .slice(0, 3)
      .join(", ");
    recommendedLearning.push(
      `Enroll in a course aligned to the top competency gap(s): ${names}.`
    );
  } else if (inProgressCourses.length > 0) {
    recommendedLearning.push(
      `Continue ${inProgressCourses.length} in-progress course enrollment(s).`
    );
  } else if (completedCourses.length > 0) {
    recommendedLearning.push(
      "No open competency gaps detected; consider a new advanced course."
    );
  }

  const attention: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  goals
    .filter(
      (g) =>
        g.status !== "completed" &&
        g.status !== "missed" &&
        str(g.due_date) &&
        str(g.due_date) < today
    )
    .slice(0, 3)
    .forEach((g) => attention.push(`Goal "${str(g.title) || "Untitled"}" is overdue.`));
  if (activeAppraisals.length > 0)
    attention.push("There are active HR performance review records to address.");

  return {
    summary: `Summary for ${data.subjectName} — derived from ${goals.length} goal(s), ${data.feedback.length} feedback item(s), ${data.recognitions.length} recognition(s), ${data.competencies.length} competency record(s), ${data.courseEnrollments.length} course enrollment(s), and ${data.trainings.length} training record(s).`,
    strengths,
    developmentAreas,
    recommendedActions,
    recommendedLearning,
    attention,
  };
}

function orgHeuristic(data: OrgData): AiInsightsResult["insights"] {
  const missedGoals = data.goals.filter((g) => g.status === "missed");
  const overdueGoals = data.goals.filter((g) => {
    const due = str(g.due_date);
    return (
      due &&
      g.status !== "completed" &&
      g.status !== "missed" &&
      due < new Date().toISOString().slice(0, 10)
    );
  });
  const pendingAppraisals = data.appraisals.filter(
    (a) => a.status === "draft" || a.status === "reviewed"
  );
  const activePips = data.pips.filter((p) => p.status === "active");
  const pendingTrainings = data.trainings.filter(
    (t) => t.approval_status === "pending"
  );
  const gapCount = data.competencyScores.filter((c) => {
    const cur = num(c.current_level);
    const req = num(c.required_level);
    return cur !== null && req !== null && cur < req;
  }).length;
  const readyCandidates = data.succession.filter(
    (s) => s.readiness_level === "ready_now"
  );
  const totalPoints = data.recognitions.reduce(
    (sum: number, r) => sum + (num(r.points) ?? 0),
    0
  );

  const attention: string[] = [];
  if (missedGoals.length > 0)
    attention.push(`${missedGoals.length} goal(s) are marked missed.`);
  if (overdueGoals.length > 0)
    attention.push(`${overdueGoals.length} goal(s) are overdue.`);
  if (pendingAppraisals.length > 0)
    attention.push(`${pendingAppraisals.length} performance review(s) are not finalized.`);
  if (activePips.length > 0)
    attention.push(`${activePips.length} performance improvement plan(s) are active.`);
  if (pendingTrainings.length > 0)
    attention.push(`${pendingTrainings.length} training request(s) await approval.`);

  const recommendedActions: string[] = [];
  if (pendingTrainings.length > 0)
    recommendedActions.push("Review pending training enrollment approvals.");
  if (pendingAppraisals.length > 0)
    recommendedActions.push("Drive outstanding performance reviews to finalization.");
  if (activePips.length > 0)
    recommendedActions.push("Recheck active performance improvement plan statuses.");

  const recommendedLearning: string[] = [];
  if (gapCount > 0)
    recommendedLearning.push(
      `${gapCount} competency gap(s) detected across the team; target the most common gaps with courses.`
    );

  const developmentAreas: string[] = [];
  if (gapCount > 0)
    developmentAreas.push(`${gapCount} competency gap(s) across scored employees.`);
  if (readyCandidates.length > 0)
    developmentAreas.push(
      `${readyCandidates.length} succession candidate(s) are ready now.`
    );

  const strengths: string[] = [];
  if (data.recognitions.length > 0)
    strengths.push(
      `${data.recognitions.length} recognition(s) given, totaling ${totalPoints} points.`
    );
  if (data.goals.length > 0)
    strengths.push(
      `${data.goals.length} goal(s) tracked across the organization.`
    );

  return {
    summary: `Organization-wide performance summary — ${data.goals.length} goal(s), ${data.appraisals.length} appraisal(s), ${data.recognitions.length} recognition(s), ${data.competencyScores.length} competency score(s), and ${data.trainings.length} training enrollment(s) across the workforce.`,
    strengths,
    developmentAreas,
    recommendedActions,
    recommendedLearning,
    attention,
  };
}

/* ------------------------------------------------------------------ */
/* Gemini (raw REST, mirrors sibling dashboard pattern)                */
/* ------------------------------------------------------------------ */

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION =
  "You are an HR Performance & Development Analyst. Analyze only the data " +
  "provided. Never invent facts that are not present in the data. If the data " +
  "does not support an insight, explicitly say there is insufficient data. " +
  "For an individual review, analyze only that person's data. For an " +
  "organization review, speak about the workforce holistically using only the " +
  "provided aggregate numbers, never fabricating individual employee details. " +
  "Return strictly valid JSON matching the requested schema.";

function buildIndividualPrompt(data: IndividualData): string {
  const goals = data.goals.map((g) => `- ${str(g.title)} [status: ${g.status}, progress: ${g.progress_percent}%${g.due_date ? ", due: " + g.due_date : ""}]`).join("\n");
  const appraisals = data.appraisals.map((a) => `- ${str(a.review_period)} [status: ${a.status}, final: ${a.final_score ?? "n/a"}]`).join("\n");
  const feedback = data.feedback.map((f) => `- [${f.feedback_type ?? "feedback"}] ${str(f.message)}`).join("\n");
  const recognitions = data.recognitions.map((r) => `- ${str((r as { hr3_badges?: { name?: string | null } | null }).hr3_badges?.name) ?? "recognition"}: ${str(r.message)}`).join("\n");
  const competencies = data.competencies.map((c) => `- ${str((c as { hr3_competencies?: { name?: string | null } | null }).hr3_competencies?.name) ?? "competency"}: current=${c.current_level}, required=${c.required_level}`).join("\n");
  const courses = data.courseEnrollments.map((e) => `- ${str((e as { hr3_courses?: { title?: string | null } | null }).hr3_courses?.title) ?? "course"} [status: ${e.status}, progress: ${e.progress_percent}%]`).join("\n");
  const trainings = data.trainings.map((e) => `- ${str((e as { hr3_training_sessions?: { title?: string | null } | null }).hr3_training_sessions?.title) ?? "session"} [approval: ${e.approval_status}, attendance: ${e.attendance_status ?? "n/a"}]`).join("\n");

  return `
Subject: ${data.subjectName}${data.roleLabel ? " (" + data.roleLabel + ")" : ""}

GOALS:
${goals || "(none)"}
APPRAISALS:
${appraisals || "(none)"}
FEEDBACK:
${feedback || "(none)"}
RECOGNITIONS:
${recognitions || "(none)"}
COMPETENCY SCORES:
${competencies || "(none)"}
COURSE ENROLLMENTS:
${courses || "(none)"}
TRAINING ENROLLMENTS:
${trainings || "(none)"}

Return JSON only with exactly these keys (arrays may be empty):
{"summary":"string","strengths":["string"],"developmentAreas":["string"],"recommendedActions":["string"],"recommendedLearning":["string"],"attention":["string"]}
State "insufficient data" where the data does not support a claim. Respond with JSON only.`.trim();
}

function buildOrgPrompt(data: OrgData): string {
  const uniqueEmp = <T>(rows: { employee_id?: unknown }[]) => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (typeof r.employee_id === "string") s.add(r.employee_id);
    });
    return s.size;
  };
  const gapCompetencies = data.competencyScores.filter((c) => {
    const cur = num(c.current_level);
    const req = num(c.required_level);
    return cur !== null && req !== null && cur < req;
  });
  const gapNames = Array.from(
    new Set(
      gapCompetencies
        .map((c) => (c as { hr3_competencies?: { name?: string | null } | null }).hr3_competencies?.name ?? "")
        .filter(Boolean)
    )
  ).slice(0, 5);

  return `
WORKFORCE (aggregate only; do not expose any individual's private details):
- Goals: ${data.goals.length} total, ${data.goals.filter((g) => g.status === "completed").length} completed, ${data.goals.filter((g) => g.status === "missed").length} missed, ${data.goals.filter((g) => g.status !== "completed" && g.status !== "missed" && str(g.due_date) && str(g.due_date) < new Date().toISOString().slice(0, 10)).length} overdue.
- Employees with goals: ${uniqueEmp(data.goals)}.
- Appraisals: ${data.appraisals.length} total, ${data.appraisals.filter((a) => a.status === "draft" || a.status === "reviewed").length} not finalized.
- PIPs: ${data.pips.filter((p) => p.status === "active").length} active.
- Recognitions: ${data.recognitions.length} total.
- Competency scores: ${data.competencyScores.length} total, ${gapCompetencies.length} gap(s); top gapped competencies: ${gapNames.join(", ") || "n/a"}.
- Course enrollments: ${data.courseEnrollments.length} total.
- Training enrollments: ${data.trainings.length} total, ${data.trainings.filter((t) => t.approval_status === "pending").length} pending.
- Succession: ${data.succession.length} candidates, ${data.succession.filter((s) => s.readiness_level === "ready_now").length} ready now.

Return JSON only with exactly these keys (arrays may be empty):
{"summary":"string","strengths":["string"],"developmentAreas":["string"],"recommendedActions":["string"],"recommendedLearning":["string"],"attention":["string"]}
Do not fabricate individual employee facts. Respond with JSON only.`.trim();
}

export type AiInsightsRuntime = {
  call: (prompt: string, timeoutMs: number) => Promise<Partial<AiInsightsResult["insights"]> | null>;
};

async function callGemini(
  prompt: string,
  timeoutMs: number
): Promise<Partial<AiInsightsResult["insights"]> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    return {
      summary:
        typeof parsed?.summary === "string" ? parsed.summary : undefined,
      strengths: Array.isArray(parsed?.strengths)
        ? parsed.strengths.map(String)
        : undefined,
      developmentAreas: Array.isArray(parsed?.developmentAreas)
        ? parsed.developmentAreas.map(String)
        : undefined,
      recommendedActions: Array.isArray(parsed?.recommendedActions)
        ? parsed.recommendedActions.map(String)
        : undefined,
      recommendedLearning: Array.isArray(parsed?.recommendedLearning)
        ? parsed.recommendedLearning.map(String)
        : undefined,
      attention: Array.isArray(parsed?.attention)
        ? parsed.attention.map(String)
        : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function mergeInsights(
  gemini: Partial<AiInsightsResult["insights"]> | null,
  fallback: AiInsightsResult["insights"]
): { insights: AiInsightsResult["insights"]; source: "gemini" | "heuristic" } {
  if (!gemini || !gemini.summary) {
    return { insights: fallback, source: "heuristic" };
  }
  return {
    insights: {
      summary: gemini.summary,
      strengths: gemini.strengths ?? [],
      developmentAreas: gemini.developmentAreas ?? [],
      recommendedActions: gemini.recommendedActions ?? [],
      recommendedLearning: gemini.recommendedLearning ?? [],
      attention: gemini.attention ?? [],
    },
    source: "gemini",
  };
}

function hasMeaningfulIndividualData(data: IndividualData): boolean {
  return (
    data.goals.length > 0 ||
    data.appraisals.length > 0 ||
    data.feedback.length > 0 ||
    data.recognitions.length > 0 ||
    data.competencies.length > 0 ||
    data.courseEnrollments.length > 0 ||
    data.trainings.length > 0
  );
}

function hasMeaningfulOrgData(data: OrgData): boolean {
  return (
    data.goals.length > 0 ||
    data.appraisals.length > 0 ||
    data.pips.length > 0 ||
    data.recognitions.length > 0 ||
    data.competencyScores.length > 0 ||
    data.courseEnrollments.length > 0 ||
    data.trainings.length > 0 ||
    data.succession.length > 0
  );
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export const POST = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const actor = auth.user;

  const parsed = await validateJson(request, AI_INSIGHTS_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  // --- Employee path: strictly bound to self, never a supplied employee_id.
  if (!actor.isAdmin) {
    const selfId = actor.employeeId;
    if (!selfId) {
      return NextResponse.json({
        success: true,
        source: "heuristic",
        subjectName: actor.fullName || "Employee",
        scope: "self",
        insufficientData: true,
        insights: {
          summary:
            "Your account is not linked to an employee profile, so there is no performance data to analyze.",
          strengths: [],
          developmentAreas: [],
          recommendedActions: [],
          recommendedLearning: [],
          attention: [],
        },
      } satisfies AiInsightsResult);
    }

    const data = await loadIndividualData(selfId, actor.fullName);
    const fallback = individualHeuristic(data);
    const gemini = await callGemini(buildIndividualPrompt(data), 20000);
    const merged = mergeInsights(gemini, fallback);
    return NextResponse.json({
      success: true,
      source: merged.source,
      subjectName: data.subjectName,
      scope: "self",
      insufficientData: !hasMeaningfulIndividualData(data),
      insights: merged.insights,
    } satisfies AiInsightsResult);
  }

  // --- Admin path: either an explicitly requested employee or the org view.
  const requestedEmployeeId = typeof body.employee_id === "string" ? body.employee_id : "";

  if (requestedEmployeeId) {
    const data = await loadIndividualData(requestedEmployeeId, actor.fullName);
    const fallback = individualHeuristic(data);
    const gemini = await callGemini(buildIndividualPrompt(data), 20000);
    const merged = mergeInsights(gemini, fallback);
    return NextResponse.json({
      success: true,
      source: merged.source,
      subjectName: data.subjectName,
      scope: "self",
      insufficientData: !hasMeaningfulIndividualData(data),
      insights: merged.insights,
    } satisfies AiInsightsResult);
  }

  // Default admin view: organization-wide aggregate.
  const data = await loadOrgData();
  const fallback = orgHeuristic(data);
  const gemini = await callGemini(buildOrgPrompt(data), 20000);
  const merged = mergeInsights(gemini, fallback);
  return NextResponse.json({
    success: true,
    source: merged.source,
    subjectName: "Team",
    scope: "org",
    insufficientData: !hasMeaningfulOrgData(data),
    insights: merged.insights,
  } satisfies AiInsightsResult);
});
