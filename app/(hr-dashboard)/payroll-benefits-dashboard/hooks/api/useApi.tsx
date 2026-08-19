'use client';

import { useState, useCallback } from 'react';

export const useApi = (baseUrl: string = '') => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleResponse = async (response: Response) => {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Request failed with status ${response.status}`);
        }
        return response.json();
    };

    const fetchData = useCallback(async (endpoint: string = '') => {
        setLoading(true);
        setError(null);
        try {
            const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
            const response = await fetch(url, {
                credentials: 'include' 
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
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
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
                credentials: 'include' 
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