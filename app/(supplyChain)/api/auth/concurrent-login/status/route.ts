// app/(supplyChain)/api/auth/concurrent-login/status/route.ts
import { NextResponse } from 'next/server';
import { getChallengeById } from '../../../../lib/services/concurrentLoginService';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const requestId = searchParams.get('requestId') || '';

        if (!requestId) {
            return NextResponse.json({ status: 'invalid', message: 'Missing requestId' }, { status: 400 });
        }

        const challenge = await getChallengeById(requestId);
        if (!challenge) {
            return NextResponse.json({ status: 'timeout', message: 'Challenge expired or not found' });
        }

        if (challenge.status === 'approved') {
            return NextResponse.json({
                status: 'approved',
                sessionPayload: challenge.sessionPayload
            });
        }

        if (challenge.status === 'declined') {
            return NextResponse.json({
                status: 'declined',
                message: 'Permission denied. The currently logged in user declined your login request.'
            });
        }

        return NextResponse.json({
            status: 'pending',
            createdAt: challenge.createdAt
        });
    } catch (err: any) {
        return NextResponse.json({ status: 'error', message: err?.message }, { status: 500 });
    }
}
