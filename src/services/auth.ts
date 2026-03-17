import type { AuthChangeEvent, User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

export interface AuthUser {
  email: string;
  createdAt: string;
}

export interface SignUpResult {
  user: AuthUser | null;
  requiresEmailConfirmation: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const toAuthUser = (user: User): AuthUser => ({
  email: user.email ?? '',
  createdAt: user.created_at
});

const validateCredentials = (email: string, password: string) => {
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    throw new Error('Please enter a valid email address.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user?.email) {
    return toAuthUser(data.user);
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.user?.email) {
    return null;
  }

  return toAuthUser(refreshed.user);
};

export const signUp = async (email: string, password: string): Promise<SignUpResult> => {
  validateCredentials(email, password);
  const supabase = getSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user?.email) {
    throw new Error('Unable to create user account.');
  }

  return {
    user: data.session ? toAuthUser(data.user) : null,
    requiresEmailConfirmation: !data.session
  };
};

export const login = async (email: string, password: string): Promise<AuthUser> => {
  validateCredentials(email, password);
  const supabase = getSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user?.email) {
    throw new Error('Unable to sign in.');
  }

  return toAuthUser(data.user);
};

export const requestPasswordReset = async (email: string) => {
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    throw new Error('Please enter a valid email address.');
  }

  const supabase = getSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const redirectTo = `${window.location.origin}${window.location.pathname}?reset=1`;
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
  if (error) {
    throw new Error(error.message);
  }
};

export const updatePassword = async (password: string): Promise<AuthUser> => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new Error(error.message);
  }

  if (!data.user?.email) {
    throw new Error('Unable to update password.');
  }

  return toAuthUser(data.user);
};

export const logout = async () => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
};

export const isRecoverySessionInUrl = (): boolean => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashRaw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hashRaw);

  return searchParams.get('reset') === '1' || searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
};

export const clearRecoveryParamsInUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('reset');
  url.searchParams.delete('type');
  url.searchParams.delete('code');
  url.searchParams.delete('token');
  url.searchParams.delete('token_hash');
  url.searchParams.delete('access_token');
  url.searchParams.delete('refresh_token');
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
};

export const subscribeToAuthState = (onUserChanged: (user: AuthUser | null, event: AuthChangeEvent) => void) => {
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const authUser = session?.user?.email ? toAuthUser(session.user) : null;
    onUserChanged(authUser, event);
  });

  return data.subscription;
};
