import { createNotification } from '@/app/(supplyChain)/lib/services/notifications';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';

// In-memory strike & lockout store (persists across chat turns within the server instance)
export interface UserStrikeState {
    strikes: number;
    lastViolationAt: number;
    lockedUntil: number | null;
    violations: Array<{
        type: 'inappropriate' | 'gibberish';
        text: string;
        timestamp: number;
    }>;
}

const userStrikeStore = new Map<string, UserStrikeState>();

const MAX_STRIKES = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Inappropriate, sexually explicit, vulgar, offensive, and abusive word patterns
// Handled with word boundary & character-substitution tolerance
const INAPPROPRIATE_PATTERNS: RegExp[] = [
    // Profanity & harsh vulgarity
    /\b(fuck|fucker|fucking|fucked|f\*ck|f-ck|fck|fucc)\b/i,
    /\b(shit|shitting|shat|bullshit|b\.s|sh\*t)\b/i,
    /\b(bitch|bitches|bitching|b\*tch)\b/i,
    /\b(asshole|arsehole|ass|bastard|jackass|dumbass|dipshit)\b/i,
    /\b(cunt|twat|wanker|motherfucker|mf|mfer)\b/i,
    /\b(dick|cock|pussy|pussies|penis|vagina|clit|tits|boobs|boobies|whore|slut|hoe)\b/i,
    /\b(nigger|nigga|faggot|fag|retard|retarded|chink|kike|spic)\b/i,
    
    // Explicit sexual content & solicitation
    /\b(porn|porno|pornography|hentai|sex|nude|nudes|naked|blowjob|handjob|anal|cum|cumming|ejaculate|dildo|masturbat\w*|horny|erotic|bdsm)\b/i,
    /\b(send nudes|show tits|naked pic|sex video|hookup|sugar baby|sugar daddy)\b/i,
    
    // Severe harassment, threats, and hate speech
    /\b(kill yourself|kys|die in a fire|go die|murder you|rape you|slit your|bomb the|shoot you)\b/i,
    /\b(stfu|shut the fuck up|go to hell|piece of shit|burn in hell)\b/i,
    
    // Tagalog / Multi-language profanity (local context)
    /\b(tangina|tanginang|putangina|puta|gago|gaga|bobo|tanga|inutil|ulol|tarantado|leche|punyeta|pakyu|pakyaw|puke|kantot|kantutan|jakol|salsal|bayag|tite|burat)\b/i,
];

/**
 * Detect inappropriate, offensive, sexually explicit, or abusive language
 */
export function detectInappropriateContent(text: string): { isInappropriate: boolean; matchedPattern?: string } {
    if (!text || typeof text !== 'string') return { isInappropriate: false };
    const normalized = text.toLowerCase().replace(/[@$!]/g, (char) => {
        if (char === '@') return 'a';
        if (char === '$') return 's';
        if (char === '!') return 'i';
        return char;
    });

    for (const pattern of INAPPROPRIATE_PATTERNS) {
        if (pattern.test(normalized) || pattern.test(text)) {
            return { isInappropriate: true, matchedPattern: pattern.source };
        }
    }
    return { isInappropriate: false };
}

/**
 * Detect gibberish, keyboard smashes, and nonsense repetitive sequences
 */
export function detectGibberish(text: string): { isGibberish: boolean; reason?: string } {
    if (!text || typeof text !== 'string') return { isGibberish: false };
    const trimmed = text.trim().toLowerCase();
    if (trimmed.length < 3) return { isGibberish: false };

    // Valid common short words / greetings / acronyms to exclude from false positives
    const allowedShortWords = new Set([
        'hi', 'hey', 'hello', 'yo', 'ok', 'yes', 'no', 'po', 'pr', 'sku', 'id',
        'qty', 'wms', 'erp', 'api', 'app', 'hub', 'box', 'item', 'list', 'help'
    ]);
    if (allowedShortWords.has(trimmed)) {
        return { isGibberish: false };
    }

    // 1. Single character repetition e.g. "aaa", "zzzz", "1111"
    if (/(.)\1{2,}/.test(trimmed)) {
        return { isGibberish: true, reason: 'Repeated characters' };
    }

    // 2. Keyboard smash sequences on standard QWERTY rows
    const keyboardSmashPatterns = [
        /asdf|ghjk|qwerty|qwert|uiop|zxcv|bnm|lkjh|poiu|mnbvc|dfgh/i,
        /12345|54321|!@#\$%|\$%^&/i,
        /qweasd|asdzxc|zxcqwe|qweqwe|asdasd|zxczxc|wewew|aweaw|aweawe/i,
        /jkljkl|hjkhjk|bnmbnm|tyutyu/i
    ];
    for (const pattern of keyboardSmashPatterns) {
        if (pattern.test(trimmed)) {
            return { isGibberish: true, reason: 'Keyboard smash pattern' };
        }
    }

    // 3. Syllable repetition / alternation loops e.g. "aweaw", "asdasd", "ababab", "qwqwqw"
    if (trimmed.length >= 4 && /^(.{2,4})\1+/i.test(trimmed)) {
        return { isGibberish: true, reason: 'Repetitive syllable loop' };
    }

    // Alternating 2-3 char patterns e.g. "aweaw", "xyzyx"
    if (trimmed.length >= 5 && !trimmed.includes(' ')) {
        const uniqueChars = new Set(trimmed.split('')).size;
        // E.g. "aweaw" is 5 chars with only 3 unique letters (a, w, e) in non-dictionary pattern
        if (uniqueChars <= 3 && /^(.)(.)(.)\1\2?$/.test(trimmed)) {
            return { isGibberish: true, reason: 'Nonsense character pattern' };
        }
    }

    // 4. High consonant-to-vowel ratio in single words (no spaces)
    const words = trimmed.split(/\s+/);
    for (const word of words) {
        if (word.length >= 5 && /^[a-z]+$/.test(word)) {
            const vowels = (word.match(/[aeiouy]/gi) || []).length;
            const consonants = word.length - vowels;
            // E.g., "sdfgh" has 0 vowels, or 5+ consonants with 0 vowels
            if (vowels === 0 || (consonants / word.length) >= 0.8) {
                return { isGibberish: true, reason: 'Unpronounceable consonant cluster' };
            }
        }
    }

    // 5. Repeated multi-character patterns e.g. "abcabcabcabc", "hahahahahaha"
    if (trimmed.length >= 6 && /^(.{2,4})\1{2,}$/i.test(trimmed)) {
        return { isGibberish: true, reason: 'Repetitive pattern loop' };
    }

    return { isGibberish: false };
}

export interface ModerationResult {
    isAllowed: boolean;
    isLockedOut: boolean;
    isViolation: boolean;
    violationType?: 'inappropriate' | 'gibberish';
    strikeCount: number;
    maxStrikes: number;
    lockoutRemainingSeconds: number;
    message?: string;
}

export interface ModerationContext {
    userId?: string;
    userEmail?: string;
    userName?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
}

/**
 * Get the unique identification key for strike tracking
 */
function getTrackingKey(context: ModerationContext): string {
    return context.userId || context.userEmail || context.ipAddress || 'anonymous_user';
}

/**
 * Get current strike and lockout status for a user/device
 */
export function getUserStrikeState(identifier: string): UserStrikeState {
    const existing = userStrikeStore.get(identifier);
    if (!existing) {
        return {
            strikes: 0,
            lastViolationAt: 0,
            lockedUntil: null,
            violations: [],
        };
    }

    // Auto-expire lockout if time has passed
    if (existing.lockedUntil && Date.now() > existing.lockedUntil) {
        existing.lockedUntil = null;
        existing.strikes = 0; // Reset strikes after serving full lockout
        userStrikeStore.set(identifier, existing);
    }

    return existing;
}

/**
 * Reset strikes for a user (Admin capability)
 */
export function resetUserStrikes(identifier: string): boolean {
    return userStrikeStore.delete(identifier);
}

/**
 * Get all active strikes and lockouts (for Device Management / Admin dashboards)
 */
export function getAllActiveStrikeStates(): Map<string, UserStrikeState> {
    const active = new Map<string, UserStrikeState>();
    const now = Date.now();
    for (const [key, state] of userStrikeStore.entries()) {
        if (state.lockedUntil && now <= state.lockedUntil) {
            active.set(key, state);
        } else if (state.strikes > 0) {
            active.set(key, state);
        }
    }
    return active;
}

/**
 * Comprehensive Safety & Content Moderation Checker
 */
export async function checkModeration(
    query: string,
    context: ModerationContext = {}
): Promise<ModerationResult> {
    const trackingKey = getTrackingKey(context);
    const now = Date.now();
    let state = getUserStrikeState(trackingKey);

    // 1. Check if currently under 5-minute lockout
    if (state.lockedUntil && now < state.lockedUntil) {
        const remainingMs = state.lockedUntil - now;
        const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
        const remainingMins = Math.floor(remainingSec / 60);
        const remainingSecsMod = remainingSec % 60;
        const timeDisplay = remainingMins > 0 
            ? `${remainingMins}m ${remainingSecsMod}s`
            : `${remainingSec}s`;

        return {
            isAllowed: false,
            isLockedOut: true,
            isViolation: true,
            strikeCount: state.strikes,
            maxStrikes: MAX_STRIKES,
            lockoutRemainingSeconds: remainingSec,
            message: `[Query Blocked] You have accumulated ${MAX_STRIKES} moderation strikes. Your access to the AI Chatbot is temporarily locked. Please wait ${timeDisplay} before submitting new queries.`,
        };
    }

    // 2. Perform Content Detection
    const inappropriateCheck = detectInappropriateContent(query);
    const gibberishCheck = detectGibberish(query);

    const isViolation = inappropriateCheck.isInappropriate || gibberishCheck.isGibberish;

    if (!isViolation) {
        return {
            isAllowed: true,
            isLockedOut: false,
            isViolation: false,
            strikeCount: state.strikes,
            maxStrikes: MAX_STRIKES,
            lockoutRemainingSeconds: 0,
        };
    }

    // 3. Process Violation & Increment Strikes
    const violationType = inappropriateCheck.isInappropriate ? 'inappropriate' : 'gibberish';
    const newStrikes = state.strikes + 1;
    const isNowLockedOut = newStrikes >= MAX_STRIKES;
    const lockedUntil = isNowLockedOut ? now + LOCKOUT_DURATION_MS : null;

    state = {
        strikes: newStrikes,
        lastViolationAt: now,
        lockedUntil,
        violations: [
            ...state.violations,
            { type: violationType, text: query.slice(0, 150), timestamp: now }
        ],
    };
    userStrikeStore.set(trackingKey, state);

    // 4. Send Admin Notification & Log Audit Activity Asynchronously
    (async () => {
        try {
            const userIdentifier = context.userEmail || context.userName || context.userId || context.ipAddress || 'Unknown User';
            
            // Send Admin Notification
            if (isNowLockedOut || newStrikes >= 3) {
                await createNotification({
                    creatorName: 'AI Security Guard',
                    creatorEmail: 'system-ai@airship-express.com',
                    title: isNowLockedOut 
                        ? `AI Security Alert: User Blocked (${newStrikes}/${MAX_STRIKES} Strikes)`
                        : `AI Content Warning: User Striked (${newStrikes}/${MAX_STRIKES})`,
                    message: `User ${userIdentifier} has been flagged for ${violationType} language in the AI Chatbot. Total strikes: ${newStrikes}/${MAX_STRIKES}.${isNowLockedOut ? ' User is currently under a 5-minute query lockout.' : ''}`,
                    type: 'security',
                    role: 'Admin',
                    link: '/user-activity',
                });
            }

            // Insert into user_activity table
            if (context.userId || context.userEmail) {
                await supabase.from('user_activity').insert({
                    user_id: context.userId || null,
                    action: isNowLockedOut ? 'AI_CHATBOT_LOCKOUT' : 'AI_MODERATION_STRIKE',
                    module: 'AI Chatbot',
                    description: `User ${userIdentifier} triggered AI moderation (${violationType}). Strike ${newStrikes}/${MAX_STRIKES}.${isNowLockedOut ? ' Imposed 5-minute query lockout.' : ''}`,
                    ip_address: context.ipAddress || null,
                    user_agent: context.userAgent || null,
                });
            }
        } catch (err) {
            console.error('Failed to dispatch moderation alerts:', err);
        }
    })();

    // 5. Construct Warning / Lockout Message
    if (isNowLockedOut) {
        return {
            isAllowed: false,
            isLockedOut: true,
            isViolation: true,
            violationType,
            strikeCount: newStrikes,
            maxStrikes: MAX_STRIKES,
            lockoutRemainingSeconds: 300,
            message: `[Query Blocked] You have reached ${MAX_STRIKES} moderation strikes for policy violations (${violationType === 'inappropriate' ? 'inappropriate language' : 'gibberish / spam'}). Your AI Chatbot access is blocked for 5 minutes. The system administrator has been notified.`,
        };
    }

    if (violationType === 'inappropriate') {
        return {
            isAllowed: false,
            isLockedOut: false,
            isViolation: true,
            violationType: 'inappropriate',
            strikeCount: newStrikes,
            maxStrikes: MAX_STRIKES,
            lockoutRemainingSeconds: 0,
            message: `[Warning - Strike ${newStrikes} of ${MAX_STRIKES}] Inappropriate, offensive, or sexually explicit language is strictly disallowed on the Airship Express platform. Please keep all communications professional and related to supply chain operations. Accumulating ${MAX_STRIKES} strikes will result in a temporary 5-minute query block.`,
        };
    } else {
        return {
            isAllowed: false,
            isLockedOut: false,
            isViolation: true,
            violationType: 'gibberish',
            strikeCount: newStrikes,
            maxStrikes: MAX_STRIKES,
            lockoutRemainingSeconds: 0,
            message: `[Warning - Strike ${newStrikes} of ${MAX_STRIKES}] Your query appears to be gibberish or keystroke spam. Please submit clear, meaningful queries regarding warehouse inventory, parcels, or procurement. Accumulating ${MAX_STRIKES} strikes will result in a temporary 5-minute query block.`,
        };
    }
}
