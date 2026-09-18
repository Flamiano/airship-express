'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../../../supabase/client';

let sessionReadyPromise: Promise<boolean> | null = null;

function waitForSession(): Promise<boolean> {
    if (sessionReadyPromise) return sessionReadyPromise;

    sessionReadyPromise = new Promise<boolean>((resolve) => {
        let resolved = false;

        const finish = (ok: boolean) => {
            if (resolved) return;
            resolved = true;
            resolve(ok);
        };

        supabase.auth.getSession().then(({ data }) => {
            if (data.session) finish(true);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                finish(true);
                sub.subscription.unsubscribe();
            }
        });

        setTimeout(() => finish(false), 3000);
    });

    return sessionReadyPromise;
}

async function getAccessToken(): Promise<string | null> {
    await waitForSession();

    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Session error:', error);
        return null;
    }
    if (data.session?.access_token) {
        return data.session.access_token;
    }

    if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';').reduce((acc: Record<string, string>, cookie) => {
            const [key, value] = cookie.trim().split('=');
            if (key) acc[key] = value;
            return acc;
        }, {});
        const cookieToken = cookies['hr_access_token'];
        if (cookieToken) return decodeURIComponent(cookieToken);
    }

    return null;
}

export function handleSessionExpired() {
    if (typeof window === 'undefined') return;
    window.location.href = '/hrAuth';
}

export class ApiError extends Error {
    status: number;
    response: any;
    remaining?: number;
    locked?: boolean;
    minutesLeft?: number;
    maxAttempts?: number;

    constructor(message: string, status: number, response: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.response = response;

        if (response && typeof response === 'object') {
            if (typeof response.remaining === 'number') this.remaining = response.remaining;
            if (typeof response.locked === 'boolean') this.locked = response.locked;
            if (typeof response.minutesLeft === 'number') this.minutesLeft = response.minutesLeft;
            if (typeof response.maxAttempts === 'number') this.maxAttempts = response.maxAttempts;
        }
    }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useApi = (baseUrl: string = '') => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inflightRef = useRef<Map<string, Promise<any>>>(new Map());

    const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        const token = await getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }, []);

    const parseError = async (response: Response): Promise<{ message: string; data: any }> => {
        try {
            const errorData = await response.json();
            return {
                message:
                    (errorData as any).error ||
                    (errorData as any).message ||
                    `Request failed with status ${response.status}`,
                data: errorData,
            };
        } catch {
            return {
                message: `Request failed with status ${response.status}`,
                data: {},
            };
        }
    };

    const handleResponse = async (
        response: Response,
        retry: () => Promise<Response>
    ) => {
        if (response.ok) {
            if (response.status === 204) return null;
            return response.json();
        }

        if (response.status === 401) {
            await sleep(150);
            const retryResponse = await retry();

            if (retryResponse.ok) {
                if (retryResponse.status === 204) return null;
                return retryResponse.json();
            }

            if (retryResponse.status === 401) {
                const parsed = await parseError(retryResponse);
                throw new ApiError(
                    parsed.message || 'Session expired. Please login again.',
                    401,
                    parsed.data
                );
            }

            const parsed = await parseError(retryResponse);
            throw new ApiError(parsed.message, retryResponse.status, parsed.data);
        }

        const parsed = await parseError(response);
        throw new ApiError(parsed.message, response.status, parsed.data);
    };

    const request = useCallback(
        async (
            url: string,
            init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }
        ) => {
            const cacheKey = `${init.method || 'GET'}:${url}`;

            const existing = inflightRef.current.get(cacheKey);
            if (existing) return existing;

            const run = async () => {
                const headers = init.headers ?? (await getAuthHeaders());

                const doFetch = () =>
                    fetch(url, { ...init, credentials: 'include', headers });

                const doRetry = async () => {
                    const freshHeaders = await getAuthHeaders();
                    return fetch(url, { ...init, credentials: 'include', headers: freshHeaders });
                };

                const response = await doFetch();
                return handleResponse(response, doRetry);
            };

            const promise = run().finally(() => {
                inflightRef.current.delete(cacheKey);
            });

            inflightRef.current.set(cacheKey, promise);
            return promise;
        },
        [getAuthHeaders]
    );

    const fetchData = useCallback(
        async (endpoint: string = '') => {
            setLoading(true);
            setError(null);
            try {
                const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
                return await request(url, { method: 'GET' });
            } catch (err: any) {
                setError(err.message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [baseUrl, request]
    );

    const postData = useCallback(
        async (endpoint: string = '', body: unknown) => {
            setLoading(true);
            setError(null);
            try {
                const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
                return await request(url, {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
            } catch (err: any) {
                setError(err.message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [baseUrl, request]
    );

    const putData = useCallback(
        async (endpoint: string = '', body: unknown) => {
            setLoading(true);
            setError(null);
            try {
                const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
                return await request(url, {
                    method: 'PUT',
                    body: JSON.stringify(body),
                });
            } catch (err: any) {
                setError(err.message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [baseUrl, request]
    );

    const patchData = useCallback(
        async (endpoint: string = '', body: unknown) => {
            setLoading(true);
            setError(null);
            try {
                const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
                return await request(url, {
                    method: 'PATCH',
                    body: JSON.stringify(body),
                });
            } catch (err: any) {
                setError(err.message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [baseUrl, request]
    );

    const deleteData = useCallback(
        async (endpoint: string = '') => {
            setLoading(true);
            setError(null);
            try {
                const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
                return await request(url, { method: 'DELETE' });
            } catch (err: any) {
                setError(err.message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [baseUrl, request]
    );

    return { fetchData, postData, putData, patchData, deleteData, loading, error };
};