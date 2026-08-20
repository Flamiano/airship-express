const rateLimiter = new Map<string, { count: number; resetTime: number }>();

export function isRateLimited(key: string): boolean {
    const now = Date.now();
    const record = rateLimiter.get(key);

    if (!record || now > record.resetTime) {
        rateLimiter.set(key, { count: 1, resetTime: now + 60000 });
        return false;
    }

    if (record.count >= 20) {
        return true;
    }

    record.count++;
    rateLimiter.set(key, record);
    return false;
}