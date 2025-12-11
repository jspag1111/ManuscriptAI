import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ManuscriptAI',
  description: 'Plan, draft, and manage manuscripts with AI-assisted tooling.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 min-h-screen text-slate-900">{children}</body>
    </html>
  );
}
