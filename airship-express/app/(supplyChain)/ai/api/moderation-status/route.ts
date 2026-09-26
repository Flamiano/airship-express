import { NextRequest, NextResponse } from "next/server";
import { getUserStrikeState, getAllActiveStrikeStates, resetUserStrikes } from "../../lib/moderation";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const identifier = searchParams.get("identifier");
        const all = searchParams.get("all");

        if (all === "true") {
            const allStates = getAllActiveStrikeStates();
            const result: Record<string, any> = {};
            for (const [key, state] of allStates.entries()) {
                result[key] = {
                    strikes: state.strikes,
                    lockedUntil: state.lockedUntil,
                    isLockedOut: Boolean(state.lockedUntil && Date.now() < state.lockedUntil),
                    lockoutRemainingSeconds: state.lockedUntil ? Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000)) : 0,
                    lastViolationAt: state.lastViolationAt,
                };
            }
            return NextResponse.json({ success: true, states: result });
        }

        if (!identifier) {
            return NextResponse.json({ error: "Identifier is required" }, { status: 400 });
        }

        const state = getUserStrikeState(identifier);
        const isLockedOut = Boolean(state.lockedUntil && Date.now() < state.lockedUntil);
        const lockoutRemainingSeconds = state.lockedUntil ? Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000)) : 0;

        return NextResponse.json({
            success: true,
            strikes: state.strikes,
            isLockedOut,
            lockoutRemainingSeconds,
            lastViolationAt: state.lastViolationAt,
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to retrieve moderation status", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, identifier } = body;

        if (action === "reset" && identifier) {
            resetUserStrikes(identifier);
            return NextResponse.json({ success: true, message: `Strikes reset for ${identifier}` });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to perform moderation action", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
