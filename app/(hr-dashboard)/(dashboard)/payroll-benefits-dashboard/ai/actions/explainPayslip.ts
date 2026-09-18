import { chat } from "../providers";
import { loadKnowledgeClient } from "../knowledge/clientLoader";
import { buildChatContext } from "../knowledge/contextBuilder";
import type { PayrollContext } from "../shared/types";

export async function explainPayslip(context: PayrollContext): Promise<string> {
  const prompt = await loadKnowledgeClient("payslip-explainer");
  const ctxText = buildChatContext(context);

  const res = await chat({
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Explain this payslip:\n\n${ctxText}` },
    ],
    temperature: 0.3,
    maxTokens: 600,
  });

  return res.content;
}
