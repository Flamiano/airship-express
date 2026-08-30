import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "../../lib/orchestrator";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { question, history, role, userId, userEmail, userName } = body;

        if (!question || typeof question !== 'string') {
            return NextResponse.json(
                { error: "Question is required" },
                { status: 400 }
            );
        }

        // Extract client information for moderation and audit logging
        const forwardedFor = request.headers.get("x-forwarded-for");
        const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : request.headers.get("x-real-ip") || "127.0.0.1";
        const userAgent = request.headers.get("user-agent") || "unknown-agent";

        const moderationContext = {
            userId: userId || undefined,
            userEmail: userEmail || undefined,
            userName: userName || undefined,
            ipAddress,
            userAgent,
        };

        const result = await orchestrator(question, history, role || "User", moderationContext);

        return NextResponse.json({
            success: result.success,
            response: result.response,
            moderation: result.moderation,
            meta: {
                classification: result.classification,
                resourcesUsed: result.resourcesUsed,
                actionResults: result.actionResults,
                knowledgeUsed: result.knowledgeUsed?.map((k: any) => k.name),
                thinking: result.thinking,
                suggestions: result.suggestions || [],
            }
        });

    } catch (error) {
        return NextResponse.json(
            {
                error: "Failed to process request",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}