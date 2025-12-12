import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';
import SpeedInsightsComponent from '@/components/SpeedInsights';
import './globals.css';

export const metadata: Metadata = {
  title: 'ManuscriptAI',
  description: 'Plan, draft, and manage manuscripts with AI-assisted tooling.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-slate-100 min-h-screen text-slate-900">
          <header className="bg-white border-b border-slate-200">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-slate-800">ManuscriptAI</span>
                <span className="text-xs text-slate-400 hidden sm:inline">Research drafting workspace</span>
              </div>
              <div className="flex items-center gap-2">
                <SignedOut>
                  <SignInButton mode="modal" />
                  <SignUpButton mode="modal" />
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </div>
          </header>
          {children}
          <SpeedInsightsComponent />
        </body>
      </html>
    </ClerkProvider>
  );
}
