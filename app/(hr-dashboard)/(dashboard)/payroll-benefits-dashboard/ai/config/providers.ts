export const AI_CONFIG = {
    groq: {
        apiKey: process.env.GROQ_API_KEY_HR!,
        model: process.env.GROQ_MODEL_HR || 'openai/gpt-oss-120b',
        visionModel: process.env.GROQ_VISION_MODEL_HR || 'qwen/qwen3.6-27b',
        baseUrl: 'https://api.groq.com/openai/v1',
    },
    deepseek: {
        apiKey: process.env.DEEP_SEEK_API_KEY_HR!,
        model: process.env.DEEPSEEK_MODEL_HR || 'deepseek-reasoner',
        baseUrl: 'https://api.deepseek.com/v1',
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY_HR!,
        model: process.env.GEMINI_MODEL_HR || 'gemini-3.7-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    },
} as const;

export type ProviderName = keyof typeof AI_CONFIG;

export const DEFAULT_PROVIDER: ProviderName = 'groq';

export const PROVIDER_FALLBACK_ORDER: ProviderName[] = ['groq', 'deepseek', 'gemini'];

export const AI_FEATURES = {
    chatbot: true,
    payslipExplainer: true,
    anomalyDetection: true,
    autoCategorize: true,
} as const;

export const CACHE_TTL_MS = 60_000;