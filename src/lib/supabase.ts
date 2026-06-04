// Typed Supabase client. Keys come ONLY from EXPO_PUBLIC_* env vars — never
// hardcoded, and never the service_role key (privacy rule #1).
//
// The client is created lazily and may be null: the app is offline-first and
// MUST render from the local cache even when Supabase is not configured yet.
// Callers check `isSupabaseConfigured` (or that `supabase` is non-null).

import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both public env vars are present. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No URL session detection in a native app.
        detectSessionInUrl: false,
      },
    })
  : null;
