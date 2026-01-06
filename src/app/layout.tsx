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
import './globals.css';

export const metadata: Metadata = {
  title: 'ManuscriptAI',
  description: 'Plan, draft, and manage manuscripts with AI-assisted tooling.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider dynamic>
      <html lang="en">
        <body className="min-h-screen text-slate-900 antialiased">
          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 via-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
                  <span className="text-lg font-bold">M</span>
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">ManuscriptAI</p>
                  <p className="text-xs text-slate-500">Smart, elegant manuscript workspace</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-300 hover:text-blue-700 transition-colors">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="px-3 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-sky-500 rounded-lg shadow-sm hover:shadow-md transition-transform hover:-translate-y-0.5">
                      Create account
                    </button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
