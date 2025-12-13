'use client';

import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { ProseMirrorEditor } from '@/components/ProseMirrorEditor';

const baseline = `We designed a series of experiments to evaluate how AI-assisted drafting could accelerate early manuscript planning. Participants were asked to outline, write, and revise sections while tracking their rationale.`;

const llmDraft = `We designed controlled experiments to measure how AI-assisted drafting accelerates manuscript planning. Participants outlined, wrote, and revised each section while documenting their rationale and capturing references suggested by the system.`;

export default function ProseMirrorPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <SignedIn>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Editing workspace</p>
          <h1 className="text-2xl font-semibold text-slate-900">ProseMirror track-changes preview</h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            This workspace layers ProseMirror decorations for user edits, AI-generated diffs, and inline comment threads. Use the
            comment drawer to jump to selections, apply AI fixes to individual threads or all of them, and review the running
            version activity feed.
          </p>
        </div>
        <ProseMirrorEditor baselineText={baseline} llmDraft={llmDraft} />
      </SignedIn>

      <SignedOut>
        <div className="rounded-2xl bg-white/80 border border-slate-200 shadow-sm p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Sign in to preview the new editor</h2>
          <p className="text-sm text-slate-600">Access the ProseMirror-based track changes and comment workflow by signing in.</p>
          <SignInButton mode="modal">
            <button className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition">
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </main>
  );
}

