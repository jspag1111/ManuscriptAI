'use client';

import { createContext, useContext, useMemo } from 'react';
import { createClientComponentClient, SessionContextProvider, Session } from '@supabase/auth-helpers-react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

interface Props {
  children: React.ReactNode;
  initialSession?: Session | null;
}

const SupabaseContext = createContext<ReturnType<typeof createClient> | null>(null);

export function SupabaseProvider({ children, initialSession }: Props) {
  const supabase = useMemo(() => createClientComponentClient<Database>(), []);

  return (
    <SupabaseContext.Provider value={supabase as unknown as ReturnType<typeof createClient>}>
      <SessionContextProvider supabaseClient={supabase} initialSession={initialSession}>
        {children}
      </SessionContextProvider>
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
