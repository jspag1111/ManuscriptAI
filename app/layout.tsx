import type { Metadata } from 'next';
import './globals.css';
import { ReactNode } from 'react';
import { SupabaseProvider } from '../components/providers/SupabaseProvider';
import { InviteProvider } from '../components/providers/InviteProvider';

export const metadata: Metadata = {
  title: 'ManuscriptAI - Next.js',
  description: 'Manuscript drafting studio with Supabase auth and storage.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>
          <InviteProvider>
            {children}
          </InviteProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
