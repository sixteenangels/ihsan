import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  userRole: string;
  managerPermissions: string[];
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
          setIsAdmin(false);
          setUserRole('customer');
          setManagerPermissions([]);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
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

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error && !rememberMe) {
      sessionStorage.setItem('ihsan_temp_session', 'true');
    } else if (!error && rememberMe) {
      sessionStorage.removeItem('ihsan_temp_session');
    }

    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: `${window.location.origin}/`,
    });
    return { error: (result.error as Error | undefined) ?? null };
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
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectUrl },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('ihsan_temp_session');
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
