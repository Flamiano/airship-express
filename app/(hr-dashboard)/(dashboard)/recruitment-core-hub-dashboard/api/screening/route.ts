
import { NextResponse } from "next/server";
import { createClient } from "@/app/(hr-dashboard)/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const validRecommendations = [
  "Strongly Recommended",
  "Recommended",
  "Consider",
  "Not Recommended",
] as const;

type ScreeningResult = {
  match_score: number;
  recommendation: (typeof validRecommendations)[number];
  strengths: string[];
  gaps: string[];
  summary: string;
};

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === "string" && item.trim().length > 0
    )
  );
}

function validateScreeningResult(
  value: unknown
): ScreeningResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const result = value as Record<string, unknown>;

  if (
    !Number.isInteger(result.match_score) ||
    (result.match_score as number) < 0 ||
    (result.match_score as number) > 100 ||
    typeof result.recommendation !== "string" ||
    !validRecommendations.includes(
      result.recommendation as ScreeningResult["recommendation"]
    ) ||
    !isStringArray(result.strengths) ||
    !isStringArray(result.gaps) ||
    typeof result.summary !== "string" ||
    !result.summary.trim()
  ) {
    return null;
  }

  return {
    match_score: result.match_score as number,
    recommendation:
      result.recommendation as ScreeningResult["recommendation"],
    strengths: result.strengths,
    gaps: result.gaps,
    summary: result.summary,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Require a signed-in user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    // 2. Validate the request.
    let body: { applicant_id?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const applicantId = body.applicant_id;

    if (
      typeof applicantId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        applicantId
      )
    ) {
      return NextResponse.json(
        { error: "A valid applicant ID is required." },
        { status: 400 }
      );
    }

    // 3. Load the applicant from the shared HR1 table.
    const { data: applicant, error: applicantError } =
      await supabase
        .from("hr1_applicants")
        .select(
          "id, first_name, last_name, resume_text, job_position_id"
        )
        .eq("id", applicantId)
        .maybeSingle();

    if (applicantError) {
      console.error("Applicant lookup failed.");
      return NextResponse.json(
        { error: "Unable to load applicant information." },
        { status: 500 }
      );
    }

    if (!applicant) {
      return NextResponse.json(
        { error: "Applicant not found." },
        { status: 404 }
      );
    }

    if (
      typeof applicant.resume_text !== "string" ||
      !applicant.resume_text.trim()
    ) {
      return NextResponse.json(
        { error: "This applicant has no resume text available for screening." },
        { status: 400 }
      );
    }

    // 4. Load the related job position separately.
    const { data: position, error: positionError } =
      await supabase
        .from("hr1_job_positions")
        .select("id, title, requirements, description")
        .eq("id", applicant.job_position_id)
        .maybeSingle();

    if (positionError) {
      console.error("Job position lookup failed.");
      return NextResponse.json(
        { error: "Unable to load job position information." },
        { status: 500 }
      );
    }

    if (!position) {
      return NextResponse.json(
        { error: "The applicant's job position was not found." },
        { status: 404 }
      );
    }

    // 5. Check the Gemini API key.
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "AI screening is not configured on the server." },
        { status: 500 }
      );
    }

    // 6. Ask Gemini for an advisory assessment.
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      // Keep your existing model for now.
      // Verify model availability in your Gemini API setup.
      model: "gemini-3.6-flash",
    });

    const prompt = `
You are an assistant supporting an HR recruitment team.

Compare the applicant's resume with the job requirements.

Rules:
- This is an advisory assessment, not a hiring decision.
- Do not invent or assume qualifications.
- Evaluate only job-related qualifications and evidence.
- Do not infer protected or sensitive personal characteristics.
- If evidence is missing, describe it as unavailable or unclear.
- Return only valid JSON, without Markdown fences.

Applicant:
${applicant.first_name} ${applicant.last_name}

Job title:
${position.title}

Job description:
${position.description ?? "Not provided"}

Job requirements:
${position.requirements ?? "Not provided"}

Resume:
${applicant.resume_text}

Return this structure:
{
  "match_score": 0,
  "recommendation": "Consider",
  "strengths": ["Evidence-based strength"],
  "gaps": ["Requirement needing further verification"],
  "summary": "Brief objective explanation."
}

match_score must be an integer from 0 to 100.
recommendation must be exactly one of:
"Strongly Recommended", "Recommended", "Consider", "Not Recommended".

Use specific evidence from the resume. Missing information is not proof
that the applicant lacks a qualification.
`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    // 7. Parse and validate the AI response.
    const cleanedText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let parsed: unknown;

    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      console.error("AI screening returned invalid JSON.");
      return NextResponse.json(
        { error: "AI returned an invalid response. Please try again." },
        { status: 502 }
      );
    }

    const aiResult = validateScreeningResult(parsed);

    if (!aiResult) {
      console.error("AI screening response failed validation.");
      return NextResponse.json(
        { error: "AI returned an invalid screening result." },
        { status: 502 }
      );
    }

    // 8. Save a NEW screening record.
    // The shared table does not enforce unique applicant_id values.
    const { data: screening, error: saveError } =
      await supabase
        .from("hr1_ai_screenings")
        .insert({
          applicant_id: applicantId,
          match_score: aiResult.match_score,
          recommendation: aiResult.recommendation,
          strengths: aiResult.strengths,
          gaps: aiResult.gaps,
          summary: aiResult.summary,
        })
        .select(
          "id, applicant_id, match_score, recommendation, strengths, gaps, summary, created_at"
        )
        .single();

    if (saveError) {
      console.error("AI screening record could not be saved.");
      return NextResponse.json(
        { error: "Unable to save the screening result." },
        { status: 500 }
      );
    }

    // 9. Return the saved screening.
    return NextResponse.json(
      { success: true, screening },
      { status: 200 }
    );
  } catch {
    // Avoid logging resumes, AI responses, or sensitive error details.
    console.error("AI screening request failed.");
    return NextResponse.json(
      { error: "An unexpected error occurred during AI screening." },
      { status: 500 }
    );
  }
}
