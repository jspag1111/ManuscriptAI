import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration for server client');
  }

  return { url, anonKey };
};

const buildCookieAdapter = () => {
  const cookieStore = cookies();

  return {
    get(name: string) {
      return cookieStore.get(name)?.value;
    },
    set(name: string, value: string, options?: CookieOptions) {
      try {
        cookieStore.set({ name, value, ...options });
      } catch (error) {
        // Read-only cookies in certain server contexts; ignore set/remove failures
        console.warn('Supabase cookie set skipped:', error);
      }
    },
    remove(name: string, options?: CookieOptions) {
      try {
        cookieStore.delete({ name, ...options });
      } catch (error) {
        console.warn('Supabase cookie delete skipped:', error);
      }
    },
  };
};

export const getServerSupabase = () => {
  const { url, anonKey } = getSupabaseConfig();
  return createServerClient<Database>(url, anonKey, {
    cookies: buildCookieAdapter(),
  });
};

export const getServerActionSupabase = getServerSupabase;

export const getServiceRoleSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role configuration');
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
