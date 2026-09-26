import {
  DEFAULT_PROVIDER,
  PROVIDER_FALLBACK_ORDER,
  type ProviderName,
} from "../config";
import { withRetry } from "../shared/utils";
import type { LLMRequest, LLMResponse, StreamChunk } from "../shared/types";
import { groqChat, groqStream, groqVision } from "./groq";
import { deepseekChat } from "./deepseek";
import { geminiChat, geminiVision } from "./gemini";

export type AiryTask =
  | "chat"
  | "briefing"
  | "preflight"
  | "audit"
  | "summary"
  | "rejection"
  | "recovery"
  | "payslip_explainer"
  | "distribute_check"
  | "budget_guard"
  | "anomaly_deep"
  | "vision";

export function routeForTask(task: AiryTask): ProviderName {
  const map: Record<AiryTask, ProviderName> = {
    chat: "groq",
    briefing: "groq",
    preflight: "groq",
    audit: "deepseek",
    summary: "groq",
    rejection: "groq",
    recovery: "deepseek",
    payslip_explainer: "groq",
    distribute_check: "groq",
    budget_guard: "groq",
    anomaly_deep: "deepseek",
    vision: "gemini",
  };
  return map[task] || DEFAULT_PROVIDER;
}

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
  const failures: string[] = [];

  for (const provider of order) {
    try {
      return await withRetry(() => chatWithProvider(provider, req), {
        retries: 0,
        delayMs: 300,
      });
    } catch (err: any) {
      lastError = err;
      failures.push(`${provider}: ${err?.message || "unknown"}`);
      console.warn(`[airy] ${provider} failed, trying next`);
    }
  }

  throw new Error(`All AI providers failed — ${failures.join(" | ")}`);
}

export async function* streamChat(
  req: LLMRequest,
  preferredProvider: ProviderName = DEFAULT_PROVIDER
): AsyncGenerator<StreamChunk> {
  if (preferredProvider === "groq") {
    try {
      yield* groqStream(req);
      return;
    } catch {
      console.warn("[airy] Groq stream failed, falling back");
    }
  }
  const res = await chat(req, preferredProvider);
  yield { delta: res.content, done: true };
}

export type VisionRequest = {
  prompt: string;
  imageBase64: string;
  mimeType: string;
  maxTokens?: number;
};

const VISION_PROVIDER_ORDER: ProviderName[] = ["gemini", "groq"];

async function visionWithProvider(
  provider: ProviderName,
  req: VisionRequest
): Promise<LLMResponse> {
  switch (provider) {
    case "gemini": {
      const r = await geminiVision({
        prompt: req.prompt,
        imageBase64: req.imageBase64,
        mimeType: req.mimeType,
        maxTokens: req.maxTokens,
      });
      return {
        content: r.content,
        provider: "gemini",
        model: r.model,
      };
    }
    case "groq": {
      return await groqVision({
        prompt: req.prompt,
        imageBase64: req.imageBase64,
        mimeType: req.mimeType,
        maxTokens: req.maxTokens,
      });
    }
    case "deepseek":
      throw new Error(
        "DeepSeek does not support vision. Skipping for image requests."
      );
    default:
      throw new Error(`Unknown vision provider: ${provider}`);
  }
}

export async function visionChat(req: VisionRequest): Promise<LLMResponse> {
  let lastError: any;
  const failures: string[] = [];

  for (const provider of VISION_PROVIDER_ORDER) {
    try {
      return await visionWithProvider(provider, req);
    } catch (err: any) {
      lastError = err;
      failures.push(`${provider}: ${err?.message || "unknown"}`);
      console.warn(`[airy-vision] ${provider} failed, trying next`);
    }
  }

  throw new Error(`All vision providers failed — ${failures.join(" | ")}`);
}

export const Providers = {
  chat,
  streamChat,
  visionChat,
  routeForTask,
};
