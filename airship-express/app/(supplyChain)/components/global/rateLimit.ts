const rateLimiter = new Map<string, { count: number; resetTime: number }>();
let lastCleanup = Date.now();

// periodic sweep to prune expired entries and prevent unbounded memory growth
function pruneExpiredRecords(now: number) {
    // only run cleanup at most once every 60 seconds or if map exceeds 500 entries
    if (now - lastCleanup < 60000 && rateLimiter.size < 500) {
        return;
    }
    lastCleanup = now;
    for (const [key, record] of rateLimiter.entries()) {
        if (now > record.resetTime) {
            rateLimiter.delete(key);
        }
    }
}

export function isRateLimited(key: string): boolean {
    const now = Date.now();
    pruneExpiredRecords(now);

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