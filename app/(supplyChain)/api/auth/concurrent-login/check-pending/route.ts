// app/(supplyChain)/api/auth/concurrent-login/check-pending/route.ts
import { NextResponse } from 'next/server';
import { getPendingChallengeForUser } from '../../../../lib/services/concurrentLoginService';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || '';
        const email = searchParams.get('email') || '';

        if (!userId && !email) {
            return NextResponse.json({ hasPending: false }, { status: 400 });
        }

        const pending = await getPendingChallengeForUser(userId, email);
        if (!pending) {
            return NextResponse.json({ hasPending: false });
        }

        return NextResponse.json({
            hasPending: true,
            challenge: {
                requestId: pending.requestId,
                displayName: pending.displayName,
                email: pending.email,
                role: pending.role,
                userAgent: pending.newDeviceUserAgent,
                ipAddress: pending.newDeviceIp,
                createdAt: pending.createdAt,
            }
        });
    } catch (err: any) {
        return NextResponse.json({ hasPending: false, error: err?.message }, { status: 500 });
    }
}
