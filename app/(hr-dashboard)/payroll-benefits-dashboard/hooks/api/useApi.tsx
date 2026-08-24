'use client';

import { useState, useCallback } from 'react';

export const useApi = (baseUrl: string = '') => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleResponse = async (response: Response) => {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 401) {
                localStorage.removeItem('hr_access_token');
                if (typeof window !== 'undefined') {
                    window.location.href = '/hrAuth';
                }
                throw new Error('Session expired. Please login again.');
            }

            throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
        }
        return response.json();
    };

    const getAuthHeaders = () => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Get token from localStorage if available
        const token = typeof window !== 'undefined' ? localStorage.getItem('hr_access_token') : null;
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    };

    const fetchData = useCallback(async (endpoint: string = '') => {
        setLoading(true);
        setError(null);
        try {
            const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
            const response = await fetch(url, {
                credentials: 'include',
                headers: getAuthHeaders(),
            });
            const data = await handleResponse(response);
            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [baseUrl]);

    const postData = useCallback(async (endpoint: string = '', body: any) => {
        setLoading(true);
        setError(null);
        try {
            const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
            const response = await fetch(url, {
                method: 'POST',
                headers: getAuthHeaders(),
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
    }, [baseUrl]);

    const putData = useCallback(async (endpoint: string = '', body: any) => {
        setLoading(true);
        setError(null);
        try {
            const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
            const response = await fetch(url, {
                method: 'PUT',
                headers: getAuthHeaders(),
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
    }, [baseUrl]);

    const deleteData = useCallback(async (endpoint: string = '') => {
        setLoading(true);
        setError(null);
        try {
            const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
            const response = await fetch(url, {
                method: 'DELETE',
                credentials: 'include',
                headers: getAuthHeaders(),
            });
            await handleResponse(response);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [baseUrl]);

    return { fetchData, postData, putData, deleteData, loading, error };
};