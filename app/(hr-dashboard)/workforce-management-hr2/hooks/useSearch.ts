import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import type { SearchResult } from '@/types/api';

const DEBOUNCE_MS = 250;
const MIN_LEN = 2;

interface UseSearchResult {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  loading: boolean;
  clear: () => void;
}

/**
 * Global command-palette search. Debounces the query, hits the RBAC-scoped
 * /api/search endpoint, and cancels in-flight requests when the query changes
 * (so a slow early response can't overwrite a newer one).
 */
export function useSearch(): UseSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_LEN) {
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await apiFetch<SearchResult[]>(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        setResults(data);
      } catch (err) {
        // Ignore aborts (a newer keystroke superseded this request).
        if ((err as Error)?.name !== 'AbortError') setResults([]);
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setQuery('');
    setResults([]);
    setLoading(false);
  }, []);

  return { query, setQuery, results, loading, clear };
}
