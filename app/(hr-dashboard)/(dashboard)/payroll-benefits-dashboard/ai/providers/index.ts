import {
  DEFAULT_PROVIDER,
  PROVIDER_FALLBACK_ORDER,
  type ProviderName,
} from "../config";
import { withRetry } from "../shared/utils";
import type { LLMRequest, LLMResponse, StreamChunk } from "../shared/types";
import { groqChat, groqStream } from "./groq";
import { deepseekChat } from "./deepseek";
import { geminiChat } from "./gemini";

async function chatWithProvider(
  provider: ProviderName,
  req: LLMRequest
): Promise<LLMResponse> {
  switch (provider) {
    case "groq":
      return groqChat(req);
    case "deepseek":
      return deepseekChat(req);
    case "gemini":
      return geminiChat(req);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export async function chat(
  req: LLMRequest,
  preferredProvider: ProviderName = DEFAULT_PROVIDER
): Promise<LLMResponse> {
  const order = [
    preferredProvider,
    ...PROVIDER_FALLBACK_ORDER.filter((p) => p !== preferredProvider),
  ];

  let lastError: any;
  for (const provider of order) {
    try {
      return await withRetry(() => chatWithProvider(provider, req), {
        retries: 1,
      });
    } catch (err) {
      lastError = err;
      console.warn(`[ai] Provider ${provider} failed, trying next...`, err);
    }
  }

  throw lastError || new Error("All AI providers failed");
}

export async function* streamChat(
  req: LLMRequest,
  preferredProvider: ProviderName = DEFAULT_PROVIDER
): AsyncGenerator<StreamChunk> {
  if (preferredProvider === "groq") {
    try {
      yield* groqStream(req);
      return;
    } catch (err) {
      console.warn("[ai] Groq stream failed, falling back", err);
    }
  }

  const res = await chat(req, preferredProvider);
  yield { delta: res.content, done: true };
}

export const Providers = { chat, streamChat };
