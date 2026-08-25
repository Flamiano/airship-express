"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isAdminRole, type AuthenticatedHrUser } from "./types";
import { clearDirectoryCache } from "./directory";
import {
  DEV_PREVIEW_PROFILES,
  getSelectedDevPreviewProfileId,
  isHrDevPreviewEnabled,
  subscribeToDevPreviewProfile,
} from "./dev-preview";

export type HrAuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "expired";

type HrAuthContextValue = {
  status: HrAuthStatus;
  user: AuthenticatedHrUser | null;
  isAdmin: boolean;
  refreshSession: () => Promise<boolean>;
  logout: () => Promise<void>;
};

const HrAuthContext = createContext<HrAuthContextValue | null>(null);

const SESSION_ENDPOINT = "/performance-development-dashboard/api/auth/session";
const LOGOUT_ENDPOINT = "/performance-development-dashboard/api/auth/logout";

async function fetchSession(): Promise<AuthenticatedHrUser | null> {
  try {
    const res = await fetch(SESSION_ENDPOINT, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated?: boolean;
      user?: AuthenticatedHrUser;
    };
    return data.authenticated && data.user ? data.user : null;
  } catch {
    return null;
  }
}

function applySession(
  nextUser: AuthenticatedHrUser | null,
  wasAuthenticated: React.RefObject<boolean>,
  setUser: (user: AuthenticatedHrUser | null) => void,
  setStatus: (status: HrAuthStatus) => void
): boolean {
  if (nextUser) {
    wasAuthenticated.current = true;
    setUser(nextUser);
    setStatus("authenticated");
    return true;
  }
  setUser(null);
  setStatus(wasAuthenticated.current ? "expired" : "unauthenticated");
  wasAuthenticated.current = false;
  return false;
}

export function HrAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<HrAuthStatus>(() =>
    isHrDevPreviewEnabled() ? "authenticated" : "loading"
  );
  const [user, setUser] = useState<AuthenticatedHrUser | null>(() =>
    isHrDevPreviewEnabled()
      ? DEV_PREVIEW_PROFILES[getSelectedDevPreviewProfileId()]
      : null
  );
  const wasAuthenticated = useRef(false);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (isHrDevPreviewEnabled()) return true;
    const nextUser = await fetchSession();
    return applySession(nextUser, wasAuthenticated, setUser, setStatus);
  }, []);

  const logout = useCallback(async () => {
    if (isHrDevPreviewEnabled()) {
      clearDirectoryCache();
      wasAuthenticated.current = false;
      setUser(null);
      setStatus("unauthenticated");
      return;
    }
    try {
      await fetch(LOGOUT_ENDPOINT, { method: "POST" });
    } catch {
      wasAuthenticated.current = false;
    }
    clearDirectoryCache();
    wasAuthenticated.current = false;
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    if (isHrDevPreviewEnabled()) {
      return subscribeToDevPreviewProfile(() => {
        setUser(DEV_PREVIEW_PROFILES[getSelectedDevPreviewProfileId()]);
        setStatus("authenticated");
      });
    }
    let cancelled = false;
    void (async () => {
      const nextUser = await fetchSession();
      if (cancelled) return;
      applySession(nextUser, wasAuthenticated, setUser, setStatus);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<HrAuthContextValue>(
    () => ({
      status,
      user,
      isAdmin: user ? isAdminRole(user.role) : false,
      refreshSession,
      logout,
    }),
    [status, user, refreshSession, logout]
  );

  return (
    <HrAuthContext.Provider value={value}>{children}</HrAuthContext.Provider>
  );
}

export function useHrAuth() {
  const context = useContext(HrAuthContext);
  if (!context) {
    throw new Error("useHrAuth must be used within HrAuthProvider");
  }
  return context;
}
