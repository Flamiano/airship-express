import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import type { Employee, UserRole } from '@/types/workforce';

interface AuthContextValue {
  user: User | null;
  profile: Employee | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Sign-in has been removed: the app always runs as the demo HR Admin.
 * The identity is fixed here rather than read from a Supabase session, so the
 * dashboard and every API route work without any login or cookies.
 */
const DEMO_USER: User = {
  id: 'demo-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'meliza.bangkok@airshipexpress.test',
  app_metadata: {},
  user_metadata: { full_name: 'Meliza Bangkok' },
  created_at: new Date().toISOString(),
};

const DEMO_PROFILE: Employee = {
  id: 'demo-admin',
  email: 'meliza.bangkok@airshipexpress.test',
  full_name: 'Meliza Bangkok',
  role: 'HR Generalist',
  avatar_initials: 'MB',
  terminal: 'HQ — Operations Center',
  created_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEMO_USER);
  const [profile, setProfile] = useState<Employee | null>(DEMO_PROFILE);
  const loading = false;

  const refreshProfile = async () => {
    setProfile(DEMO_PROFILE);
  };

  const signIn = async () => ({ error: null });
  const signUp = async () => ({ error: null });
  const signOut = async () => {
    setUser(DEMO_USER);
    setProfile(DEMO_PROFILE);
  };

  const value: AuthContextValue = {
    user,
    profile,
    role: profile?.role ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
