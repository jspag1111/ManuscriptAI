'use client';

import { createContext, useContext, useState } from 'react';

interface InviteContextValue {
  inviteToken: string | null;
  setInviteToken: (token: string | null) => void;
}

const InviteContext = createContext<InviteContextValue | undefined>(undefined);

export function InviteProvider({ children }: { children: React.ReactNode }) {
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  return (
    <InviteContext.Provider value={{ inviteToken, setInviteToken }}>
      {children}
    </InviteContext.Provider>
  );
}

export function useInvite() {
  const ctx = useContext(InviteContext);
  if (!ctx) {
    throw new Error('useInvite must be used within InviteProvider');
  }
  return ctx;
}
