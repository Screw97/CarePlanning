// Auth for the single owner. The app signs in to ONE account (the email/
// password created in Supabase); the session is persisted in SecureStore by the
// supabase client, so this is a one-time sign-in, not a recurring login wall.

import { supabase } from './supabase';

export async function getSessionUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'App is not connected to Supabase yet (missing keys).' };
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Subscribe to auth changes. Fires immediately with the current user id (or
 *  null), then on every sign-in/out. Returns an unsubscribe fn. */
export function subscribeAuth(cb: (userId: string | null) => void): () => void {
  if (!supabase) {
    cb(null);
    return () => {};
  }
  supabase.auth.getSession().then(({ data }) => cb(data.session?.user?.id ?? null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    cb(session?.user?.id ?? null),
  );
  return () => data.subscription.unsubscribe();
}
