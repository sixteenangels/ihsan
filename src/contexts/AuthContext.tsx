import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS, getStoredItem, removeStoredItems } from '@/lib/brand';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  userRole: string;
  managerPermissions: string[];
  signUp: (
    email: string,
    password: string,
    name: string,
    referralCode?: string | null,
  ) => Promise<{ error: Error | null; userId: string | null }>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
  signInWithGoogle: (rememberMe?: boolean) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TEMP_SESSION_KEY = STORAGE_KEYS.tempSession;
const TEMP_SESSION_LEGACY_KEYS = STORAGE_KEYS.tempSessionLegacy;
const SESSION_MODE_KEY = STORAGE_KEYS.sessionMode;
const SESSION_MODE_LEGACY_KEYS = STORAGE_KEYS.sessionModeLegacy;

function clearStoredSessionPreference() {
  removeStoredItems(sessionStorage, [TEMP_SESSION_KEY, ...TEMP_SESSION_LEGACY_KEYS]);
  removeStoredItems(localStorage, [SESSION_MODE_KEY, ...SESSION_MODE_LEGACY_KEYS]);
}

function setTemporarySessionPreference() {
  sessionStorage.setItem(TEMP_SESSION_KEY, 'true');
  localStorage.setItem(SESSION_MODE_KEY, 'session');
  removeStoredItems(sessionStorage, TEMP_SESSION_LEGACY_KEYS);
  removeStoredItems(localStorage, SESSION_MODE_LEGACY_KEYS);
}

function setPersistentSessionPreference() {
  sessionStorage.removeItem(TEMP_SESSION_KEY);
  localStorage.setItem(SESSION_MODE_KEY, 'persistent');
  removeStoredItems(sessionStorage, TEMP_SESSION_LEGACY_KEYS);
  removeStoredItems(localStorage, SESSION_MODE_LEGACY_KEYS);
}

function getOAuthRedirectUrl() {
  if (typeof window === 'undefined') {
    return '/auth';
  }

  const currentUrl = new URL(window.location.href);
  const callbackUrl = new URL('/auth', currentUrl.origin);
  callbackUrl.hash = '';

  if (currentUrl.pathname === '/auth') {
    callbackUrl.search = currentUrl.search;
  }

  return callbackUrl.toString();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>('customer');
  const [managerPermissions, setManagerPermissions] = useState<string[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            checkUserRole(session.user.id);
          }, 0);
        } else {
          clearStoredSessionPreference();
          setIsAdmin(false);
          setUserRole('customer');
          setManagerPermissions([]);
        }
      }
    );

    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      const sessionMode = getStoredItem(localStorage, [SESSION_MODE_KEY, ...SESSION_MODE_LEGACY_KEYS])?.value;
      const hasTempSession =
        getStoredItem(sessionStorage, [TEMP_SESSION_KEY, ...TEMP_SESSION_LEGACY_KEYS])?.value === 'true';

      if (session?.user && sessionMode === 'session' && !hasTempSession) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserRole(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        const role = data.role as string;
        setUserRole(role);
        setIsAdmin(role === 'admin' || role === 'manager');

        // Fetch manager permissions if role is manager
        if (role === 'manager') {
          const { data: perms } = await supabase
            .from('manager_permissions')
            .select('permission')
            .eq('user_id', userId);
          setManagerPermissions(perms?.map(p => p.permission) || []);
        } else {
          setManagerPermissions([]);
        }
      } else {
        setUserRole('customer');
        setIsAdmin(false);
        setManagerPermissions([]);
      }
    } catch (err) {
      console.error('Error checking user role:', err);
    }
  };

  const signUp = async (email: string, password: string, name: string, referralCode?: string | null) => {
    const redirectUrl = getOAuthRedirectUrl();
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
          ...(referralCode ? { referral_code: referralCode } : {}),
        },
      },
    });

    return { error: error as Error | null, userId: data.user?.id || null };
  };

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error && rememberMe) {
      setPersistentSessionPreference();
    } else if (!error) {
      setTemporarySessionPreference();
    }

    return { error: error as Error | null };
  };

  const signInWithGoogle = async (rememberMe: boolean = false) => {
    if (rememberMe) {
      setPersistentSessionPreference();
    } else {
      setTemporarySessionPreference();
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthRedirectUrl(),
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      clearStoredSessionPreference();
    }

    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?tab=reset`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error as Error | null };
  };

  const resendVerificationEmail = async (email: string) => {
    const redirectUrl = getOAuthRedirectUrl();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectUrl },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearStoredSessionPreference();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setUserRole('customer');
    setManagerPermissions([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAdmin,
        userRole,
        managerPermissions,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        updatePassword,
        resendVerificationEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
