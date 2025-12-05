import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev-anon-key';

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Using fallback Supabase anon credentials; set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
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
  return createServerClient<Database, 'public'>(url, anonKey, {
    cookies: buildCookieAdapter(),
  });
};

export const getServerActionSupabase = getServerSupabase;

export const getServiceRoleSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder';
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Using fallback Supabase service role credentials; set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient<Database, 'public'>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
