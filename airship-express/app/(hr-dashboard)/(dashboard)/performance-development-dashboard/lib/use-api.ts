"use client";

import { useState, useCallback, useEffect } from "react";
import { ApiError, readApiError } from "./api-error";

const API_BASE = "/performance-development-dashboard/api";

type UseApiResourceOpts<T> = {
  path: string;
  listKey: string;
  disabled?: boolean;
  initialData?: T[];
  errorMessage?: string;
};

type UseApiResourceResult<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useApiResource<T>({
  path,
  listKey,
  disabled = false,
  initialData,
  errorMessage,
}: UseApiResourceOpts<T>): UseApiResourceResult<T> {
  const [data, setData] = useState<T[]>(initialData ?? []);
  const [loading, setLoading] = useState(!disabled);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${path}`, {
          credentials: "include",
        });
        if (!res.ok) throw await readApiError(res, "Failed to load data");
        const json = await res.json();
        if (cancelled) return;
        setData(Array.isArray(json[listKey]) ? json[listKey] : []);
      } catch (err) {
        if (!cancelled) {
          setError(
            errorMessage ??
              (err instanceof Error ? err.message : "Failed to load data")
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [path, listKey, refreshKey, disabled]);

  return { data, loading, error, refetch };
}

type UseApiMutationOpts = {
  path: string;
  method?: "POST" | "PUT" | "DELETE";
  onSuccess?: (data: Record<string, unknown>) => void;
};

type SubmitResult = {
  data: Record<string, unknown> | null;
  error: ApiError | null;
};

type UseApiMutationResult = {
  submit: (
    body?: Record<string, unknown> | null,
    queryParams?: Record<string, string>
  ) => Promise<SubmitResult>;
  submitting: boolean;
  error: ApiError | null;
  reset: () => void;
};

export function useApiMutation({
  path,
  method = "POST",
  onSuccess,
}: UseApiMutationOpts): UseApiMutationResult {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const reset = useCallback(() => setError(null), []);

  const submit = useCallback(
    async (
      body?: Record<string, unknown> | null,
      queryParams?: Record<string, string>
    ): Promise<SubmitResult> => {
      setSubmitting(true);
      setError(null);

      try {
        let url = `${API_BASE}/${path}`;
        if (queryParams) {
          const params = new URLSearchParams(queryParams);
          url += `?${params.toString()}`;
        }

        const opts: RequestInit = {
          method,
          credentials: "include",
        };

        if (method !== "DELETE" && body != null) {
          opts.headers = { "Content-Type": "application/json" };
          opts.body = JSON.stringify(body);
        }

        const res = await fetch(url, opts);
        if (!res.ok) throw await readApiError(res, "Request failed");

        const json = await res.json();
        onSuccess?.(json);
        return { data: json, error: null };
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError({
                code: "UNKNOWN" as ApiError["code"],
                status: 0,
                message: err instanceof Error ? err.message : "Request failed",
              });
        setError(apiError);
        return { data: null, error: apiError };
      } finally {
        setSubmitting(false);
      }
    },
    [path, method, onSuccess]
  );

  return { submit, submitting, error, reset };
}
