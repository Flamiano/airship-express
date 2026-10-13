import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const HMAC_SECRET = process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                    'airship-executive-confidential-reports-secret-salt-2026';

export const VERIFICATION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitRecord {
    attempts: number;
    lockoutUntil?: number;
}

// In-memory rate limiting map for password verification (max 5 attempts, 15 min lockout)
const verificationRateLimits = new Map<string, RateLimitRecord>();
const MAX_VERIFY_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function checkVerificationRateLimit(key: string): { locked: boolean; remainingSeconds: number; attempts: number } {
    const now = Date.now();
    const entry = verificationRateLimits.get(key);
    if (entry && entry.lockoutUntil && entry.lockoutUntil > now) {
        const remainingSeconds = Math.ceil((entry.lockoutUntil - now) / 1000);
        return { locked: true, remainingSeconds, attempts: entry.attempts };
    }
    return { locked: false, remainingSeconds: 0, attempts: entry?.attempts || 0 };
}

export function recordFailedVerification(key: string): { locked: boolean; remainingSeconds: number; attemptsRemaining: number } {
    const now = Date.now();
    const entry = verificationRateLimits.get(key);
    const currentAttempts = (entry && (!entry.lockoutUntil || entry.lockoutUntil <= now))
        ? (entry.attempts || 0) + 1
        : 1;

    if (currentAttempts >= MAX_VERIFY_ATTEMPTS) {
        verificationRateLimits.set(key, {
            attempts: currentAttempts,
            lockoutUntil: now + LOCKOUT_DURATION_MS,
        });
        return { locked: true, remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000), attemptsRemaining: 0 };
    } else {
        verificationRateLimits.set(key, { attempts: currentAttempts });
        return { locked: false, remainingSeconds: 0, attemptsRemaining: MAX_VERIFY_ATTEMPTS - currentAttempts };
    }
}

export function resetVerificationRateLimit(key: string): void {
    verificationRateLimits.delete(key);
}

export interface ExecutiveUserSession {
    session: any;
    user: {
        id: string;
        email: string;
        display_name: string;
        role: string;
        status?: string;
    };
}

/**
 * Validates that the request has an active session and that the user is authorized as an Executive.
 */
export async function validateExecutiveSession(request: Request): Promise<{
    auth?: ExecutiveUserSession;
    errorResponse?: { error: string; status: number };
}> {
    let sessionToken = request.headers.get('x-session-token');

    if (!sessionToken) {
        const { searchParams } = new URL(request.url);
        sessionToken = searchParams.get('session_token') || searchParams.get('token');
    }

    if (!sessionToken) {
        const cookieHeader = request.headers.get('cookie') || '';
        const match = cookieHeader.match(/(?:session_token|sc_session_token)=([^;]+)/);
        if (match && match[1]) {
            sessionToken = decodeURIComponent(match[1].trim());
        }
    }

    if (!sessionToken) {
        return {
            errorResponse: { error: 'Authentication required. No session token provided.', status: 401 }
        };
    }

    // Lookup session in Supabase
    const { data: session, error: sessionError } = await supabaseAdmin
        .from('sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .maybeSingle();

    if (sessionError || !session) {
        return {
            errorResponse: { error: 'Invalid or expired session. Please log in again.', status: 401 }
        };
    }

    if (!session.is_active) {
        return {
            errorResponse: { error: 'Session is terminated or inactive.', status: 401 }
        };
    }

    // Check expiration
    const expiryDate = session.expires_at_remember || session.expires_at;
    if (expiryDate && new Date(expiryDate) < new Date()) {
        await supabaseAdmin
            .from('sessions')
            .update({ is_active: false })
            .eq('id', session.id);
        return {
            errorResponse: { error: 'Session has expired. Please log in again.', status: 401 }
        };
    }

    // Lookup user in users table
    let userQuery = supabaseAdmin.from('users').select('id, email, display_name, role, status');
    if (session.user_id) {
        userQuery = userQuery.eq('id', session.user_id);
    } else if (session.email) {
        userQuery = userQuery.ilike('email', session.email);
    }

    const { data: userData, error: userError } = await userQuery.maybeSingle();

    if (userError || !userData) {
        return {
            errorResponse: { error: 'Authorized user account not found.', status: 403 }
        };
    }

    if (userData.status && userData.status.toLowerCase() !== 'active') {
        return {
            errorResponse: { error: 'User account is deactivated.', status: 403 }
        };
    }

    // Verify Executive role
    const normalizedRole = (userData.role || '').toLowerCase().trim();
    const isExecutive = normalizedRole === 'executive' || 
                        normalizedRole === 'superadmin' || 
                        normalizedRole === 'super_admin';

    if (!isExecutive) {
        return {
            errorResponse: { 
                error: 'Forbidden. Executive authorization required for confidential reports.', 
                status: 403 
            }
        };
    }

    return {
        auth: {
            session,
            user: {
                id: userData.id,
                email: userData.email || session.email,
                display_name: userData.display_name || 'Executive',
                role: userData.role || 'Executive',
                status: userData.status,
            }
        }
    };
}

/**
 * Creates a cryptographically signed HMAC verification token valid for 15 minutes.
 */
export function signExecutiveVerificationToken(userId: string, email: string): { token: string; expiresAt: string } {
    const now = Date.now();
    const exp = now + VERIFICATION_EXPIRY_MS;
    const payload = JSON.stringify({
        uid: userId,
        eml: email.toLowerCase().trim(),
        iat: now,
        exp: exp,
    });

    const encodedPayload = Buffer.from(payload).toString('base64url');
    const signature = createHmac('sha256', HMAC_SECRET).update(encodedPayload).digest('base64url');
    const token = `${encodedPayload}.${signature}`;

    return {
        token,
        expiresAt: new Date(exp).toISOString(),
    };
}

/**
 * Validates a cryptographically signed verification token against the authenticated user.
 */
export function verifyExecutiveVerificationToken(
    token: string | null | undefined, 
    expectedUserId: string, 
    expectedEmail: string
): { valid: boolean; reason?: string } {
    if (!token || typeof token !== 'string') {
        return { valid: false, reason: 'Missing verification token.' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return { valid: false, reason: 'Malformed verification token format.' };
    }

    const [encodedPayload, providedSignature] = parts;

    // Verify HMAC signature
    const expectedSignature = createHmac('sha256', HMAC_SECRET).update(encodedPayload).digest('base64url');
    
    try {
        const bufA = Buffer.from(providedSignature);
        const bufB = Buffer.from(expectedSignature);
        if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
            return { valid: false, reason: 'Invalid token signature.' };
        }
    } catch {
        return { valid: false, reason: 'Token signature verification failed.' };
    }

    // Decode and parse payload
    try {
        const decoded = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        const now = Date.now();

        if (!decoded.exp || decoded.exp < now) {
            return { valid: false, reason: 'Executive verification has expired. Please verify your password again.' };
        }

        const matchUser = (decoded.uid && decoded.uid === expectedUserId) ||
                          (decoded.eml && decoded.eml === expectedEmail.toLowerCase().trim());

        if (!matchUser) {
            return { valid: false, reason: 'Verification token does not match active session user.' };
        }

        return { valid: true };
    } catch {
        return { valid: false, reason: 'Failed to decode verification payload.' };
    }
}

/**
 * Timezone helper: Returns UTC bounds and formatted strings for Asia/Manila (UTC+8)
 */
export function getManilaMonthRange(year: number, month: number) {
    const safeYear = Math.max(2020, Math.min(2035, Number(year) || new Date().getFullYear()));
    const safeMonth = Math.max(1, Math.min(12, Number(month) || (new Date().getMonth() + 1)));

    const lastDay = new Date(safeYear, safeMonth, 0).getDate();
    const mm = String(safeMonth).padStart(2, '0');

    // 00:00:00.000 in Manila (UTC+8) -> YYYY-MM-01T00:00:00+08:00
    const startStr = `${safeYear}-${mm}-01T00:00:00+08:00`;
    // 23:59:59.999 in Manila (UTC+8) -> YYYY-MM-DD-T23:59:59.999+08:00
    const endStr = `${safeYear}-${mm}-${String(lastDay).padStart(2, '0')}T23:59:59.999+08:00`;

    const startUtc = new Date(startStr).toISOString();
    const endUtc = new Date(endStr).toISOString();

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[safeMonth - 1];

    return {
        year: safeYear,
        month: safeMonth,
        monthName,
        lastDay,
        startStr,
        endStr,
        startUtc,
        endUtc,
        datePrefix: `${safeYear}-${mm}`,
        periodLabel: `${monthName} 1, ${safeYear} – ${monthName} ${lastDay}, ${safeYear} (Asia/Manila)`,
        cutoffLabel: `Cutoff: ${monthName} ${lastDay}, ${safeYear}`,
    };
}
