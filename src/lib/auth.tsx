import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Bump this when the terms change: everyone is asked to accept again. */
export const TERMS_VERSION = '2026-11-v1';

export type Profile = {
  id: string;
  display_name: string;
  handle: string | null;
  parish: string | null;
  level: number;
};

type AuthState = {
  /** False until the saved session (and profile) have been checked. */
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True once the user has accepted the current terms. */
  consented: boolean;
  /** Reload profile and consent from the database. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consented, setConsented] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const userId = session?.user.id ?? null;

  const loadUserData = useCallback(async (id: string) => {
    const [profileResult, consentResult] = await Promise.all([
      supabase.from('profiles').select('id, display_name, handle, parish, level').eq('id', id).maybeSingle(),
      supabase.from('consents').select('id').eq('user_id', id).eq('terms_version', TERMS_VERSION).limit(1),
    ]);
    setProfile((profileResult.data as Profile | null) ?? null);
    setConsented((consentResult.data?.length ?? 0) > 0);
    setLoadedFor(id);
  }, []);

  // Restore the saved session, then follow sign-in / sign-out events.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    // Keep this callback synchronous: calling Supabase inside it can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setConsented(false);
      setLoadedFor(null);
      return;
    }
    loadUserData(userId);
  }, [userId, loadUserData]);

  // On phones, only refresh the login token while the app is open.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(async () => {
    if (userId) await loadUserData(userId);
  }, [userId, loadUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const ready = sessionChecked && (!userId || loadedFor === userId);

  const value = useMemo(
    () => ({ ready, session, user: session?.user ?? null, profile, consented, refresh, signOut }),
    [ready, session, profile, consented, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}

/** The name to greet the user with. */
export function displayName(profile: Profile | null, user: User | null): string {
  const name = profile?.display_name?.trim();
  if (name) return name;
  return user?.email?.split('@')[0] ?? 'Friend';
}
