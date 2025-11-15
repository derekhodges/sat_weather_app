/**
 * Supabase Client Configuration
 *
 * This sets up the Supabase client for authentication and database access.
 * Make sure to set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'your-project-url.supabase.co' &&
    supabaseAnonKey !== 'your-anon-key'
  );
};

// Create Supabase client
let supabase = null;

if (isSupabaseConfigured()) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} else {
  console.warn(
    '⚠️ Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env file.\n' +
    'Auth features will be disabled until configured.'
  );
}

export { supabase };

/**
 * Helper to check if auth is enabled and configured
 */
export const isAuthEnabled = () => {
  const authEnabled = process.env.EXPO_PUBLIC_ENABLE_AUTH === 'true';
  return authEnabled && isSupabaseConfigured();
};
