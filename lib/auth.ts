import type { Session, User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from './supabase';

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export type SignUpProfile = {
  full_name: string;
};

let state: AuthState = { session: null, user: null, loading: true };
const listeners = new Set<() => void>();
let initialized = false;

function emit(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAuth(session: Session | null) {
  emit({ session, user: session?.user ?? null, loading: false });
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export async function initializeAuth() {
  if (initialized) return;
  initialized = true;

  if (!isSupabaseConfigured) {
    setAuth(null);
    return;
  }

  const { data } = await supabase.auth.getSession();
  setAuth(data.session);
  supabase.auth.onAuthStateChange((_event, session) => setAuth(session));
}

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      ...(profile
        ? {
            data: {
              full_name: profile.full_name,
            },
          }
        : {}),
      // On web, send the confirmation email link back into the app so users
      // land on the sign-in screen right after confirming.
      ...(Platform.OS === 'web'
        ? { emailRedirectTo: `${window.location.origin}/login` }
        : {}),
    },
  });

  if (!error && data.session) {
    if (profile) {
      // Only the name is updated here — roles are managed exclusively by
      // administrators (enforced by the protect_role_change database trigger).
      await supabase
        .from('profiles')
        .update({ full_name: profile.full_name })
        .eq('id', data.session.user.id);
    }
    setAuth(data.session);
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error && data.session) setAuth(data.session);
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (!error) setAuth(null);
  return { error };
}
