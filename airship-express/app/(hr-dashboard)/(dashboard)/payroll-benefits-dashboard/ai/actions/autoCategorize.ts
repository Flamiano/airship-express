import { chat } from "../providers";
import { loadKnowledgeClient } from "../knowledge/clientLoader";

const VALID = [
  "travel",
  "meals",
  "supplies",
  "medical",
  "training",
  "equipment",
  "other",
];

export async function autoCategorize(
  description: string,
  amount: number
): Promise<string> {
  const prompt = await loadKnowledgeClient("auto-categorize");

  const res = await chat({
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `Description: ${description}\nAmount: ₱${amount}`,
      },
    ],
    temperature: 0,
    maxTokens: 20,
  });

  const category = res.content.trim().toLowerCase();
  return VALID.includes(category) ? category : "other";
}
