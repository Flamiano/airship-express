import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/app/(hr-dashboard)/supabase/client';
import type { Employee, UserRole } from '../types/workforce';

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

function formatRole(rawRole?: string | null): UserRole {
  if (!rawRole) return 'HR Admin';
  if (rawRole === 'hr_workforce_admin' || rawRole === 'hr_admin') return 'HR Admin';
  if (rawRole.toLowerCase().includes('manager')) return 'Operations Manager';
  if (rawRole.toLowerCase().includes('driver')) return 'Fleet Driver';
  return 'HR Admin';
}

function getInitials(name?: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveProfile = useCallback(async (authUser?: User | null) => {
    try {
      setLoading(true);
      if (authUser?.id || authUser?.email) {
        // Query hr_admin by id or email
        let query = supabase.from('hr_admin').select('*');
        if (authUser.id) {
          query = query.eq('id', authUser.id);
        } else if (authUser.email) {
          query = query.eq('email', authUser.email);
        }
        const { data: admin } = await query.maybeSingle();

        if (admin) {
          setUser(authUser);
          setProfile({
            id: admin.id,
            email: admin.email || authUser.email || '',
            full_name: admin.full_name || 'Admin',
            role: formatRole(admin.role),
            department: 'Human Resources',
            employee_group: 'Office',
            avatar_initials: getInitials(admin.full_name),
            terminal: 'HQ — Operations Center',
            created_at: admin.created_at || new Date().toISOString(),
          });
          return;
        }
      }

      // Fallback: look up the workforce admin or first admin in hr_admin table
      const { data: workforceAdmin } = await supabase
        .from('hr_admin')
        .select('*')
        .eq('role', 'hr_workforce_admin')
        .maybeSingle();

      const activeAdmin = workforceAdmin ?? (
        await supabase.from('hr_admin').select('*').limit(1).maybeSingle()
      ).data;

      if (activeAdmin) {
        setProfile({
          id: activeAdmin.id,
          email: activeAdmin.email || 'admin@airshipexpress.com',
          full_name: activeAdmin.full_name || 'Admin',
          role: formatRole(activeAdmin.role),
          department: 'Human Resources',
          employee_group: 'Office',
          avatar_initials: getInitials(activeAdmin.full_name),
          terminal: 'HQ — Operations Center',
          created_at: activeAdmin.created_at || new Date().toISOString(),
        });
      } else {
        setProfile({
          id: 'admin',
          email: 'admin@airshipexpress.com',
          full_name: 'Workforce Admin',
          role: 'HR Admin',
          department: 'Human Resources',
          employee_group: 'Office',
          avatar_initials: 'WA',
          terminal: 'HQ — Operations Center',
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error resolving admin profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      resolveProfile(data?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveProfile(session?.user ?? null);
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, [resolveProfile]);

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getUser();
    await resolveProfile(data?.user ?? null);
  };

  const signIn = async () => ({ error: null });
  const signUp = async () => ({ error: null });
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    await resolveProfile(null);
  };

  const value: AuthContextValue = {
    user,
    profile,
    role: profile?.role ?? 'HR Admin',
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
