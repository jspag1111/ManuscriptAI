import { cookies, headers } from 'next/headers';
import { createServerComponentClient, createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

export const getServerSupabase = () =>
  createServerComponentClient<Database>({
    cookies,
    headers,
  });

export const getServerActionSupabase = () =>
  createServerActionClient<Database>({
    cookies,
    headers,
  });

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
