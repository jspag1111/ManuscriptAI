'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
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
            Create your workspace
          </p>
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-semibold leading-tight text-white">Join ManuscriptAI</h1>
            <p className="text-slate-200 text-lg leading-relaxed">
              Build projects that stay organized from outline to export. Manage references, figures, and AI-assisted drafts in one elegant place.
            </p>
          </div>

        <div className="grid sm:grid-cols-3 gap-4">
            {["Collaborative ready", "Structured sections", "Export to DOCX"].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center shadow-lg shadow-slate-950/30">
                <p className="text-sm font-semibold text-white">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/10 border border-white/15 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-blue-900/30 p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-sm text-slate-200">Sign up to get started</p>
            <h2 className="text-2xl font-semibold text-white">Create your account</h2>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
            <SignUp
              path="/sign-up"
              routing="path"
              signInUrl="/sign-in"
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
