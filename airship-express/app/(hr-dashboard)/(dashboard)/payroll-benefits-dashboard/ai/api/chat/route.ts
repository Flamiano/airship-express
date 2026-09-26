import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import { chat, streamChat } from "../../providers";
import { buildSystemPrompt } from "../../knowledge/builder";
import { loadKnowledgeServer } from "../../knowledge/serverLoader";
import { detectPayslipImageIntent } from "../../shared/intent";
import { findEmployeeByName } from "../../actions/findEmployeeByName";
import { generatePayslipImage } from "../../actions/generatePayslipImage";
import type { LLMRequest } from "../../shared/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult;

  let body: LLMRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, temperature, maxTokens, context, employeeId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required" },
      { status: 400 }
    );
  }

  let systemPrompt: string;
  try {
    const staticGuidelines = loadKnowledgeServer("chatbot");
    systemPrompt = await buildSystemPrompt({
      staticGuidelines,
      runtimeContext: context,
      employeeId,
    });
  } catch (err) {
    console.error("[ai/api/chat] system prompt build failed:", err);
    systemPrompt = "You are Airy, a payroll assistant.";
  }

  systemPrompt += `\n\n## Current Admin\nYou are chatting with ${admin.fullName} (${admin.email}), role: ${admin.role}. Address them by name when it feels natural. Reply in whichever language they use — English, Tagalog, or Taglish — matching their tone and wording naturally, without announcing that you're switching languages.`;

  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const payslipIntent = lastUserMessage
    ? detectPayslipImageIntent(lastUserMessage.content)
    : null;

  let attachment: { type: "image"; url: string; label: string } | null = null;

  if (payslipIntent?.employeeName) {
    try {
      const employee = await findEmployeeByName(payslipIntent.employeeName);

      if (employee) {
        const result = await generatePayslipImage(employee);
        attachment = {
          type: "image",
          url: result.svgDataUrl,
          label: `Payslip - ${result.employeeFullName} (${result.periodLabel})`,
        };
        systemPrompt += `\n\n## Tool Result\nYou just generated a print-ready payslip image for ${result.employeeFullName}, covering ${result.periodLabel}. The image is already shown to the admin above your reply — do not describe it as something they need to click or open, just briefly confirm it's ready and mention the name/period, in the same language the admin used.`;
      } else {
        systemPrompt += `\n\n## Tool Result\nThe admin asked for a payslip image for "${payslipIntent.employeeName}" but no matching active employee was found. Tell them clearly, in the language they used, and ask them to check the spelling or give the employee ID instead.`;
      }
    } catch (err) {
      console.error("[ai/api/chat] payslip image generation failed:", err);
      systemPrompt += `\n\n## Tool Result\nGenerating the payslip image failed due to a system error. Apologize briefly, in the language the admin used, and suggest trying again.`;
    }
  }

  const finalMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.filter((m) => m.role !== "system"),
  ];

  const wantsStream = request.nextUrl.searchParams.get("stream") === "1";

  if (!wantsStream) {
    try {
      const res = await chat({
        messages: finalMessages,
        temperature,
        maxTokens,
      });
      return NextResponse.json({
        ...res,
        attachments: attachment ? [attachment] : [],
      });
    } catch (err: any) {
      console.error("[ai/api/chat] non-stream error:", err);
      return NextResponse.json(
        { error: err.message || "AI request failed" },
        { status: 500 }
      );
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (attachment) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ attachment })}\n\n`)
          );
        }

        for await (const chunk of streamChat({
          messages: finalMessages,
          temperature,
          maxTokens,
        })) {
          if (chunk.delta) {
            const payload = `data: ${JSON.stringify({
              delta: chunk.delta,
            })}\n\n`;
            controller.enqueue(encoder.encode(payload));
          }
          if (chunk.done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            break;
          }
        }
      } catch (err: any) {
        console.error("[ai/api/chat] stream error:", err);
        const payload = `data: ${JSON.stringify({
          error: err.message || "Stream failed",
        })}\n\n`;
        controller.enqueue(encoder.encode(payload));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
