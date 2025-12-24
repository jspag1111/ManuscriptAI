'use client';

import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import GeneralWriterApp from '@/components/GeneralWriterApp';

export default function WritingPage() {
  return (
    <>
      <SignedIn>
        <GeneralWriterApp />
      </SignedIn>
      <SignedOut>
        <main className="relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 20%, rgba(14,165,233,0.22), transparent 26%),' +
                'radial-gradient(circle at 85% 10%, rgba(99,102,241,0.18), transparent 24%),' +
                'radial-gradient(circle at 50% 80%, rgba(16,185,129,0.15), transparent 30%)',
            }}
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 text-left">
                <p className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-white/60 border border-white/80 uppercase tracking-wider text-slate-700">
                  General writing studio
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-slate-900">
                  Draft any document with AI-enhanced editing
                </h1>
                <p className="text-lg text-slate-600 leading-relaxed">
                  Capture a brief, sketch an outline, and draft fast with the same tracked edits, comments, and version history you trust.
                </p>

                <div className="flex flex-wrap gap-3">
                  <SignInButton mode="modal">
                    <button className="px-5 py-3 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 shadow-lg shadow-blue-500/25 hover:-translate-y-0.5 transition-transform">
                      Sign in to continue
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="px-5 py-3 text-sm font-semibold text-slate-800 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 hover:text-blue-700 transition-colors">
                      Create a workspace
                    </button>
                  </SignUpButton>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 pt-4">
                  {[
                    {
                      title: 'Brief-first planning',
                      desc: 'Capture goals, audience, format, and outline before drafting.',
                    },
                    {
                      title: 'Same editing power',
                      desc: 'Track changes, comments, and AI refinements in every draft.',
                    },
                    {
                      title: 'Version history',
                      desc: 'Review drafts and restore past versions in one click.',
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-3xl shadow-2xl shadow-blue-500/10 p-6 lg:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Writing brief preview</p>
                    <p className="text-xs text-slate-500">Plan quickly, draft with confidence</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700">New</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-4 space-y-3 shadow-inner shadow-blue-900/20">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/60 border border-white/10 flex items-center justify-center text-white font-semibold">BR</div>
                    <div className="h-8 w-24 rounded-full bg-white/10" />
                  </div>
                  <div className="h-28 rounded-xl bg-white/5 border border-white/5" />
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-white/10 border border-white/10 h-16" />
                    <div className="rounded-lg bg-white/10 border border-white/10 h-16" />
                    <div className="rounded-lg bg-white/10 border border-white/10 h-16" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </SignedOut>
    </>
  );
}
