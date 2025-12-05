import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/merriweather/index.css';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ManuscriptAI',
  description: 'An intelligent, iterative research manuscript creation environment with built-in reference management and figure generation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
