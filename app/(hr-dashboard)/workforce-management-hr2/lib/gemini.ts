import type { WorkforceForecast, SkillingProgress } from '@/types/workforce';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION =
  'You are an elite Workforce Planning & Logistics Operations AI Consultant for a ' +
  'Freight Management System. You give concise, actionable, professional advice to HR Admins.';

interface GeminiResult {
  text: string;
  source: 'gemini' | 'heuristic';
}

/**
 * Build the analysis prompt from real workforce data.
 */
function buildPrompt(forecast: WorkforceForecast[], skilling: SkillingProgress[]): string {
  const peaks = [...forecast]
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 3)
    .map((f) => `${f.month} (${f.freight_volume} loads, ${f.deficit} driver deficit)`)
    .join(', ');

  const gaps = [...skilling]
    .sort((a, b) => a.completion_rate - b.completion_rate)
    .slice(0, 3)
    .map((s) => `${s.department} (${s.completion_rate}% certified)`)
    .join(', ');

  const currentStaff = forecast.length ? forecast[forecast.length - 1].current_staff : 0;

  return `
Analyze our freight workload and workforce data for the next 6 to 12 months:
- Highest projected staffing-deficit months: ${peaks || 'n/a'}.
- Current active workforce: ${currentStaff} drivers/dispatchers.
- Lowest certification coverage: ${gaps || 'n/a'}.

Provide a concise 3-point action plan in markdown bullet points for the HR Admin on:
1. A recruiting timeline to mitigate the Q4 holiday freight spike.
2. A targeted upskilling path for the lowest-certified departments.
3. Shift optimization to prevent driver fatigue and manage overtime compliance risk.

Keep the tone professional, actionable, and succinct.`.trim();
}

/**
 * Heuristic fallback when no API key is configured or Gemini is unreachable.
 * Keeps the feature usable in local dev without credentials.
 */
function heuristicAnalysis(forecast: WorkforceForecast[], skilling: SkillingProgress[]): string {
  const worstMonth = [...forecast].sort((a, b) => b.deficit - a.deficit)[0];
  const worstSkill = [...skilling].sort((a, b) => a.completion_rate - b.completion_rate)[0];

  return `**Workforce Action Plan (heuristic — configure GEMINI_API_KEY for AI analysis)**

- **Recruiting timeline:** Peak deficit hits in **${worstMonth?.month ?? 'Q4'}** (~${worstMonth?.deficit ?? 0} drivers short). Begin sourcing & CDL onboarding **8–10 weeks ahead** to absorb the holiday freight spike.
- **Upskilling path:** **${worstSkill?.department ?? 'HazMat Handlers'}** is lowest at **${worstSkill?.completion_rate ?? 0}%** certified. Launch a fast-track certification cohort and pair uncertified staff with certified mentors.
- **Shift optimization:** Cap consecutive long-haul assignments and stagger start times to keep overtime within DOT hours-of-service limits, reducing fatigue-related risk.`;
}

/**
 * Query Gemini for a staffing forecast, with retry/backoff and a heuristic
 * fallback. Never throws — always returns a usable string.
 */
export async function generateStaffingForecast(
  forecast: WorkforceForecast[],
  skilling: SkillingProgress[]
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { text: heuristicAnalysis(forecast, skilling), source: 'heuristic' };
  }

  const prompt = buildPrompt(forecast, skilling);
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
  };

  let retries = 3;
  let delay = 800;

  while (retries > 0) {
    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = await res.json();
      const text: string | undefined =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty Gemini response');
      return { text, source: 'gemini' };
    } catch (err) {
      retries -= 1;
      if (retries === 0) {
        // Graceful degradation to heuristic output.
        return { text: heuristicAnalysis(forecast, skilling), source: 'heuristic' };
      }
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }

  return { text: heuristicAnalysis(forecast, skilling), source: 'heuristic' };
}
