import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setAuthTokenGetter } from '../lib/api';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  isSupabaseConfigured: boolean;
  signInWithEmail: (email: string, password?: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password?: string, fullName?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize token with API client
  useEffect(() => {
    setAuthTokenGetter(() => session?.access_token || null);
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (isMounted) {
          setSession(data.session);
          setUser(data.session?.user || null);
        }
      } catch (err) {
        console.warn('Failed to get initial session:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession);
        setUser(currentSession?.user || null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription?.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string = 'password') => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      setSession(data.session);
      setUser(data.user);
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Login failed') };
    }
  };

  const signUpWithEmail = async (email: string, password: string = 'password', fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Signup failed') };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
      // In mock/direct flow, data is handled by callback or immediate session
      if (data && 'session' in data && (data as unknown as { session: Session }).session) {
        setSession((data as unknown as { session: Session }).session);
        setUser((data as unknown as { session: Session }).session.user);
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Google sign-in failed') };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Password reset failed') };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        accessToken: session?.access_token || null,
        isLoading,
        isSupabaseConfigured,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
