'use client';

import React, { useState } from 'react';

import OpenAiChatKitPanel from '@/components/OpenAiChatKitPanel';
import PubmedAssistantPanel from '@/components/PubmedAssistantPanel';
import type { Project } from '@/types';

interface ReferenceAssistantPanelProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

type AssistantMode = 'gemini' | 'openai';

const ReferenceAssistantPanel: React.FC<ReferenceAssistantPanelProps> = ({ project, onUpdateProject }) => {
  const [mode, setMode] = useState<AssistantMode>('gemini');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assistant mode</p>
          <p className="text-sm text-slate-600">
            Switch between the Gemini PubMed agent and the OpenAI ChatKit workflow.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setMode('gemini')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              mode === 'gemini'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            Gemini
          </button>
          <button
            type="button"
            onClick={() => setMode('openai')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              mode === 'openai'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:text-emerald-600'
            }`}
          >
            OpenAI (ChatKit)
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {mode === 'gemini' ? (
          <PubmedAssistantPanel project={project} onUpdateProject={onUpdateProject} />
        ) : (
          <OpenAiChatKitPanel project={project} onUpdateProject={onUpdateProject} />
        )}
      </div>
    </div>
  );
};

export default ReferenceAssistantPanel;
