import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const groq = process.env.GROQ_API_KEY_HR;
  const gemini = process.env.GEMINI_API_KEY_HR;
  const deepseek = process.env.DEEP_SEEK_API_KEY_HR;

  return NextResponse.json({
    groq: {
      present: !!groq,
      length: groq?.length ?? 0,
      prefix: groq?.slice(0, 8) ?? null,
      suffix: groq?.slice(-4) ?? null,
    },
    gemini: {
      present: !!gemini,
      length: gemini?.length ?? 0,
      prefix: gemini?.slice(0, 8) ?? null,
    },
    deepseek: {
      present: !!deepseek,
      length: deepseek?.length ?? 0,
      prefix: deepseek?.slice(0, 8) ?? null,
    },
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd(),
    envFilesFound: {
      env: !!process.env.NEXT_PUBLIC_SITE_URL,
      gmail: !!process.env.GMAIL_HR_USER,
    },
  });
}
