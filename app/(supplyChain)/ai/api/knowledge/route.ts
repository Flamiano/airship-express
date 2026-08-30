import { NextResponse } from "next/server";
import { loadAllKnowledge, searchKnowledge } from "../../lib/knowledge";

export async function GET() {
    try {
        const knowledge = loadAllKnowledge();
        const allFiles = Array.from(knowledge.values());

        return NextResponse.json({
            success: true,
            totalFiles: knowledge.size,
            files: allFiles.map(k => ({
                name: k.name,
                contentPreview: k.content.substring(0, 100) + '...',
                contentLength: k.content.length,
                category: k.category
            }))
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}