import { chat } from "../providers";
import { loadKnowledgeClient } from "../knowledge/clientLoader";
import type { AIInsight } from "../shared/types";

export async function flagAnomalies(records: any[]): Promise<AIInsight[]> {
  const prompt = await loadKnowledgeClient("anomaly-detector");

  const summary = records.map((r) => ({
    id: r.id,
    employee: r.employee_name,
    netPay: r.net_pay,
    daysWorked: r.days_worked,
    overtimeHours: r.overtime_hours,
  }));

  const res = await chat({
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: JSON.stringify({ records: summary.slice(0, 50) }),
      },
    ],
    temperature: 0.1,
    maxTokens: 800,
  });

  try {
    const parsed = JSON.parse(res.content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
