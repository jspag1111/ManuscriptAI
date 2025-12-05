'use client';

import { createContext, useContext, useMemo } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

const createBrowserClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev-anon-key';
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Using fallback Supabase anon credentials in the client; configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPA',
      'BASE_ANON_KEY.');
  }
  return createClient<Database>(url, anonKey);
};

interface Props {
  children: React.ReactNode;
}

const SupabaseContext = createContext<SupabaseClient<Database> | null>(null);

export function SupabaseProvider({ children }: Props) {
  const supabase = useMemo(() => createBrowserClient(), []);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const client = useContext(SupabaseContext);
  if (!client) {
    throw new Error('Supabase client is not available in this context');
  }
  return client;
}
