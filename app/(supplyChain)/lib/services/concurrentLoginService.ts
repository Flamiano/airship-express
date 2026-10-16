// app/(supplyChain)/lib/services/concurrentLoginService.ts
import { createClient } from '@supabase/supabase-js';

/**
 * Concurrent Login Intercept Service
 * 
 * Manages device-conflict authentication challenges when a user with an active session
 * attempts to sign in from another device/browser.
 * 
 * Production-ready for Vercel Serverless Functions:
 * Persists challenges in Supabase `login_challenges` table so state is shared across all
 * serverless lambda instances.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

export interface PendingLoginChallenge {
    requestId: string;
    userId: string;
    email: string;
    displayName: string;
    role: string;
    newDeviceUserAgent: string;
    newDeviceIp: string;
    createdAt: number;
    status: 'pending' | 'approved' | 'declined' | 'timeout';
    sessionPayload?: {
        sessionToken: string;
        expiresAt: string;
        rememberMe: boolean;
        redirectUrl: string;
        accessToken?: string | null;
        refreshToken?: string | null;
    };
}

// Challenge TTL: 60 seconds
const CHALLENGE_TTL_MS = 60 * 1000;

function mapRowToChallenge(row: any): PendingLoginChallenge {
    const createdTime = row.created_at ? new Date(row.created_at).getTime() : Date.now();
    return {
        requestId: row.id,
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name || 'User',
        role: row.role || 'Admin',
        newDeviceUserAgent: row.new_device_user_agent || 'Unknown Device',
        newDeviceIp: row.new_device_ip || 'Unknown IP',
        createdAt: createdTime,
        status: row.status as PendingLoginChallenge['status'],
        sessionPayload: row.session_payload,
    };
}

export async function createLoginChallenge(params: {
    userId: string;
    email: string;
    displayName: string;
    role: string;
    newDeviceUserAgent: string;
    newDeviceIp: string;
    sessionPayload: PendingLoginChallenge['sessionPayload'];
}): Promise<PendingLoginChallenge> {
    const normalizedEmail = (params.email || '').toLowerCase().trim();
    const requestId = `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    try {
        // 1. Cancel any previous pending requests for this user/email
        if (params.userId) {
            await supabaseAdmin
                .from('login_challenges')
                .update({ status: 'timeout', updated_at: nowIso })
                .eq('user_id', params.userId)
                .eq('status', 'pending');
        }

        if (normalizedEmail) {
            await supabaseAdmin
                .from('login_challenges')
                .update({ status: 'timeout', updated_at: nowIso })
                .eq('email', normalizedEmail)
                .eq('status', 'pending');
        }

        // 2. Insert new persistent challenge
        const { data, error } = await supabaseAdmin
            .from('login_challenges')
            .insert({
                id: requestId,
                user_id: params.userId,
                email: normalizedEmail,
                display_name: params.displayName,
                role: params.role,
                new_device_user_agent: params.newDeviceUserAgent,
                new_device_ip: params.newDeviceIp,
                status: 'pending',
                session_payload: params.sessionPayload,
                created_at: nowIso,
                updated_at: nowIso,
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to insert login challenge to Supabase:', error);
        } else if (data) {
            return mapRowToChallenge(data);
        }
    } catch (err) {
        console.error('Error in createLoginChallenge:', err);
    }

    return {
        requestId,
        userId: params.userId,
        email: normalizedEmail,
        displayName: params.displayName,
        role: params.role,
        newDeviceUserAgent: params.newDeviceUserAgent,
        newDeviceIp: params.newDeviceIp,
        createdAt: Date.now(),
        status: 'pending',
        sessionPayload: params.sessionPayload,
    };
}

export async function getPendingChallengeForUser(userId: string, email: string): Promise<PendingLoginChallenge | null> {
    const normalizedEmail = (email || '').toLowerCase().trim();

    try {
        let query = supabaseAdmin
            .from('login_challenges')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);

        if (userId && normalizedEmail) {
            query = query.or(`user_id.eq.${userId},email.eq.${normalizedEmail}`);
        } else if (userId) {
            query = query.eq('user_id', userId);
        } else if (normalizedEmail) {
            query = query.eq('email', normalizedEmail);
        } else {
            return null;
        }

        const { data: row, error } = await query.maybeSingle();

        if (error || !row) {
            return null;
        }

        // Check if expired
        const createdTime = new Date(row.created_at).getTime();
        if (Date.now() - createdTime > CHALLENGE_TTL_MS) {
            await supabaseAdmin
                .from('login_challenges')
                .update({ status: 'timeout', updated_at: new Date().toISOString() })
                .eq('id', row.id);
            return null;
        }

        return mapRowToChallenge(row);
    } catch (err) {
        console.error('Error in getPendingChallengeForUser:', err);
        return null;
    }
}

export async function getChallengeById(requestId: string): Promise<PendingLoginChallenge | null> {
    if (!requestId) return null;

    try {
        const { data: row, error } = await supabaseAdmin
            .from('login_challenges')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

        if (error || !row) {
            return null;
        }

        // Check if pending has expired
        const createdTime = new Date(row.created_at).getTime();
        if (row.status === 'pending' && Date.now() - createdTime > CHALLENGE_TTL_MS) {
            await supabaseAdmin
                .from('login_challenges')
                .update({ status: 'timeout', updated_at: new Date().toISOString() })
                .eq('id', row.id);
            row.status = 'timeout';
        }

        return mapRowToChallenge(row);
    } catch (err) {
        console.error('Error in getChallengeById:', err);
        return null;
    }
}

export async function resolveLoginChallenge(requestId: string, approved: boolean): Promise<boolean> {
    if (!requestId) return false;
    const nowIso = new Date().toISOString();
    const newStatus = approved ? 'approved' : 'declined';

    try {
        const { data: updated, error } = await supabaseAdmin
            .from('login_challenges')
            .update({ status: newStatus, updated_at: nowIso })
            .eq('id', requestId)
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error resolving login challenge:', error);
            return false;
        }

        // If declined, mark any other pending requests for the same user as declined as well
        if (!approved && updated) {
            const userId = updated.user_id;
            const email = (updated.email || '').toLowerCase().trim();

            if (userId) {
                await supabaseAdmin
                    .from('login_challenges')
                    .update({ status: 'declined', updated_at: nowIso })
                    .eq('user_id', userId)
                    .eq('status', 'pending');
            }

            if (email) {
                await supabaseAdmin
                    .from('login_challenges')
                    .update({ status: 'declined', updated_at: nowIso })
                    .eq('email', email)
                    .eq('status', 'pending');
            }
        }

        return true;
    } catch (err) {
        console.error('Error in resolveLoginChallenge:', err);
        return false;
    }
}
