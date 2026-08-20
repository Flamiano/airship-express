export const sanitizeSearch = (value: string): string => {
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .trim();
};

export const sanitizeBarcode = (value: string): string => {
    if (!value) return '';
    return value
        .replace(/\s/g, '')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .trim()
        .slice(0, 100);
};

export const sanitizeText = (value: string): string => {
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, 200);
};

export const sanitizeNumber = (value: number): number => {
    return Math.max(0, value);
};