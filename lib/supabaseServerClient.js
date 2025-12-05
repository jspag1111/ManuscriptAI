import { createClient } from '@supabase/supabase-js';

let serverClient = null;

const missingConfigMessage = 'Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.';

/**
 * Returns a singleton Supabase client configured with the service role key
 * for trusted server-side operations. Throws when required env vars are absent
 * so callers can surface a helpful error.
 */
export const getSupabaseServiceRoleClient = () => {
  if (serverClient) return serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(missingConfigMessage);
  }

  serverClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serverClient;
};

export const hasSupabaseConfig = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
