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

export const sanitizeSearch = (value: string): string => {
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .trim();
};

export const sanitizeText = (value: string): string => {
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, 200);
};

export const formatDate = (date: string | null | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
