import { AI_CONFIG } from "../config";
import type { LLMRequest, LLMResponse, StreamChunk } from "../shared/types";

export async function groqChat(req: LLMRequest): Promise<LLMResponse> {
  const cfg = AI_CONFIG.groq;

  if (!cfg.apiKey) {
    throw new Error("Groq API key not configured.");
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 1024,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) {
      throw new Error(
        "Groq rejected the key. Regenerate at console.groq.com/keys."
      );
    }
    if (res.status === 404) {
      throw new Error(
        `Groq model "${cfg.model}" not available on your account. Try GROQ_MODEL_HR=llama-3.3-70b-versatile.`
      );
    }
    throw new Error(`Groq error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    provider: "groq",
    model: cfg.model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

export async function* groqStream(
  req: LLMRequest
): AsyncGenerator<StreamChunk> {
  const cfg = AI_CONFIG.groq;

  if (!cfg.apiKey) {
    throw new Error("Groq API key not configured.");
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 1024,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq stream error ${res.status}: ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const payload = trimmed.replace(/^data:\s*/, "");
      if (payload === "[DONE]") {
        yield { delta: "", done: true };
        return;
      }
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content || "";
        if (delta) yield { delta, done: false };
      } catch {}
    }
  }

  yield { delta: "", done: true };
}

export async function groqVision(opts: {
  prompt: string;
  imageBase64: string;
  mimeType: string;
  maxTokens?: number;
}): Promise<LLMResponse> {
  const cfg = AI_CONFIG.groq;
  if (!cfg.apiKey) throw new Error("Groq API key not configured.");

  const dataUrl = `data:${opts.mimeType};base64,${opts.imageBase64}`;

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: opts.prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: opts.maxTokens ?? 800,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq vision error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    provider: "groq",
    model: cfg.visionModel,
  };
}
