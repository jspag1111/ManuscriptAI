'use client';

import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import ManuscriptApp from '@/components/ManuscriptApp';

export default function HomePage() {
  return (
    <>
      <SignedIn>
        <ManuscriptApp />
      </SignedIn>
      <SignedOut>
        <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-3">Welcome to ManuscriptAI</h1>
          <p className="text-slate-500 max-w-2xl mb-6">
            Sign in to manage your projects, draft manuscripts, and sync your work securely.
          </p>
          <div className="flex gap-3">
            <SignInButton mode="modal" />
            <SignUpButton mode="modal" />
          </div>
        </main>
      </SignedOut>
    </>
  );
}
