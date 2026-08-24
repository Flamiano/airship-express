//api/chat

import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "../../lib/orchestrator";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { question, history, role } = body;

        if (!question || typeof question !== 'string') {
            return NextResponse.json(
                { error: "Question is required" },
                { status: 400 }
            );
        }


        const result = await orchestrator(question, history, role);

        return NextResponse.json({
            success: result.success,
            response: result.response,
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