function env(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

function requiredEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.length === 0) {
    console.warn(`[ai] Missing env: ${key}`);
    return "";
  }
  return v;
}

export const AI_CONFIG = {
  groq: {
    apiKey: requiredEnv("GROQ_API_KEY_HR"),
    model: env("GROQ_MODEL_HR", "llama-3.3-70b-versatile"),
    visionModel: env("GROQ_VISION_MODEL_HR", "llama-3.2-11b-vision-preview"),
    baseUrl: env("GROQ_BASE_URL_HR", "https://api.groq.com/openai/v1"),
  },
  deepseek: {
    apiKey: requiredEnv("DEEP_SEEK_API_KEY_HR"),
    model: env("DEEPSEEK_MODEL_HR", "deepseek-chat"),
    baseUrl: env("DEEPSEEK_BASE_URL_HR", "https://api.deepseek.com/v1"),
  },
  gemini: {
    apiKey: requiredEnv("GEMINI_API_KEY_HR"),
    model: env("GEMINI_MODEL_HR", "gemini-1.5-flash"),
    baseUrl: env(
      "GEMINI_BASE_URL_HR",
      "https://generativelanguage.googleapis.com/v1beta"
    ),
  },
} as const;

export type ProviderName = keyof typeof AI_CONFIG;

export const DEFAULT_PROVIDER: ProviderName = "groq";

export const PROVIDER_FALLBACK_ORDER: ProviderName[] = [
  "groq",
  "deepseek",
  "gemini",
];

export const AI_FEATURES = {
  chatbot: true,
  payslipExplainer: true,
  anomalyDetection: true,
  autoCategorize: true,
  preflight: true,
  audit: true,
  briefing: true,
  recovery: true,
  distributeCheck: true,
  budgetGuard: true,
} as const;

export const CACHE_TTL_MS = 60_000;
