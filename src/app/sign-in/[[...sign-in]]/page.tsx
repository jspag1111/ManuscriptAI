'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="absolute inset-0 opacity-60" style={{
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.18), transparent 25%),' +
          'radial-gradient(circle at 80% 10%, rgba(16,185,129,0.16), transparent 22%),' +
          'radial-gradient(circle at 50% 80%, rgba(14,165,233,0.14), transparent 30%)',
      }} />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-white/10 border border-white/10 uppercase tracking-wider">
            Secure workspace
          </p>
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-semibold leading-tight text-white">
              Welcome back to ManuscriptAI
            </h1>
            <p className="text-slate-200 text-lg leading-relaxed">
              Draft, polish, and manage every section of your manuscript with a focused workspace, rich version history,
              and AI-assisted drafting that keeps your references close at hand.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {["AI drafting", "Version history", "Responsive workspace"].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center shadow-lg shadow-slate-950/30">
                <p className="text-sm font-semibold text-white">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/10 border border-white/15 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-blue-900/30 p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-sm text-slate-200">Sign in to continue</p>
            <h2 className="text-2xl font-semibold text-white">Access your projects</h2>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
            <SignIn
              path="/sign-in"
              routing="path"
              signUpUrl="/sign-up"
              appearance={{
                elements: {
                  formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-sm hover:shadow-md',
                  card: 'shadow-none',
                },
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
