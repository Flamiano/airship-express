"use client";

import { useCallback, useEffect, useState } from "react";
import type { DirectoryUser, EmployeeDirectoryEntry } from "./types";

const EMPLOYEES_ENDPOINT = "/performance-development-dashboard/api/employees";

let cache: DirectoryUser[] | null = null;
let inflight: Promise<DirectoryUser[]> | null = null;

function toDirectoryUsers(rows: EmployeeDirectoryEntry[]): DirectoryUser[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.full_name ?? row.employee_id_number ?? "Unknown",
    jobTitle: row.job_title ?? "",
  }));
}

async function loadDirectory(): Promise<DirectoryUser[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch(EMPLOYEES_ENDPOINT, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Unable to load the employee directory.");
        }
        const data = (await res.json()) as { employees?: EmployeeDirectoryEntry[] };
        const users = toDirectoryUsers(data.employees ?? []);
        cache = users;
        return users;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

export function clearDirectoryCache() {
  cache = null;
}

export function useDirectory() {
  const [directory, setDirectory] = useState<DirectoryUser[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    void (async () => {
      try {
        const users = await loadDirectory();
        if (!cancelled) setDirectory(users);
      } catch (cause) {
        if (!cancelled) {
          setDirectory([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load the employee directory."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getDirectoryUser = useCallback(
    (id: string | null | undefined): DirectoryUser | undefined =>
      id ? directory.find((user) => user.id === id) : undefined,
    [directory]
  );

  return { directory, loading, error, getDirectoryUser };
}
