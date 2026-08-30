'use client';

import { useState, useCallback } from 'react';
import { createClient } from '../../../../supabase/client';

export const useApi = (baseUrl: string = '') => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    const getAuthHeaders = useCallback(async () => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                console.error('Session error:', sessionError);
            }

            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
                console.log('useApi: Using Supabase session token');
                return headers;
            }

            const cookies = document.cookie.split(';').reduce((acc: Record<string, string>, cookie) => {
                const [key, value] = cookie.trim().split('=');
                acc[key] = value;
                return acc;
            }, {});

            const token = cookies['hr_access_token'];
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('useApi: Using cookie token');
                return headers;
            }

            console.log('useApi: No token found');
        } catch (err) {
            console.error('Error getting auth headers:', err);
        }

        return headers;
    }, [supabase]);

    const handleResponse = async (response: Response) => {
        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json().catch(() => ({}));
                console.log('useApi: Error response:', errorData);
            } catch (e) {
                console.log('useApi: Could not parse error response');
            }

            if (response.status === 401) {
                console.log('useApi: 401 Unauthorized - Redirecting to login');
                if (typeof window !== 'undefined') {
                    window.location.href = '/hrAuth';
                }
                throw new Error('Session expired. Please login again.');
            }

            const errorMessage = (errorData as any).error || (errorData as any).message || `Request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }
        return response.json();
    };

    const fetchData = useCallback(async (endpoint: string = '') => {
        setLoading(true);
        setError(null);
        try {
            const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
            const headers = await getAuthHeaders();
            console.log(`useApi: Fetching ${url}`);
            const response = await fetch(url, {
                credentials: 'include',
                headers,
            });
            const data = await handleResponse(response);
            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [baseUrl, getAuthHeaders]);

    const postData = useCallback(async (endpoint: string = '', body: any) => {
        setLoading(true);
        setError(null);
        try {
            const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
            const headers = await getAuthHeaders();
            const response = await fetch(url, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const data = await handleResponse(response);
            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [baseUrl, getAuthHeaders]);

    const putData = useCallback(async (endpoint: string = '', body: any) => {
        setLoading(true);
        setError(null);
        try {
            const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
            const headers = await getAuthHeaders();
            const response = await fetch(url, {
                method: 'PUT',
                headers,
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const data = await handleResponse(response);
            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [baseUrl, getAuthHeaders]);

    const deleteData = useCallback(async (endpoint: string = '') => {
        setLoading(true);
        setError(null);
        try {
            const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
            const headers = await getAuthHeaders();
            const response = await fetch(url, {
                method: 'DELETE',
                credentials: 'include',
                headers,
            });
            await handleResponse(response);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [baseUrl, getAuthHeaders]);

    return { fetchData, postData, putData, deleteData, loading, error };
};