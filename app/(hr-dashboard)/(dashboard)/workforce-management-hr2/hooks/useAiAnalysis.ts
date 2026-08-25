import { useState, useCallback } from 'react';
import type { AiForecastResponse } from '@/types/api';

interface UseAiAnalysisResult {
  analysis: string | null;
  source: 'gemini' | 'heuristic' | null;
  loading: boolean;
  error: string | null;
  run: () => Promise<void>;
  reset: () => void;
}

/**
 * Calls the secure server route /api/ai/forecast (which holds the Gemini key)
 * and exposes loading / result / error state for the AiInsightsModal.
 */
export function useAiAnalysis(): UseAiAnalysisResult {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [source, setSource] = useState<'gemini' | 'heuristic' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch('/api/ai/forecast', { method: 'POST' });
      const body = (await res.json()) as AiForecastResponse | { error: string };
      if (!res.ok || 'error' in body) {
        throw new Error('error' in body ? body.error : `Request failed (${res.status})`);
      }
      setAnalysis(body.analysis);
      setSource(body.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error running AI analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnalysis(null);
    setSource(null);
    setError(null);
  }, []);

  return { analysis, source, loading, error, run, reset };
}
