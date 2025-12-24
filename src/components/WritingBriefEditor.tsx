import React from 'react';
import { AlignLeft, ClipboardList, ListChecks, Target, Users } from 'lucide-react';
import { Button } from './Button';
import type { Project, WritingBrief } from '@/types';

interface WritingBriefEditorProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  onOpenDraft?: () => void;
}

const getBrief = (project: Project): WritingBrief =>
  project.writingBrief ?? {
    goals: '',
    audience: '',
    format: '',
    outline: '',
    tone: '',
  };

export const WritingBriefEditor: React.FC<WritingBriefEditorProps> = ({
  project,
  onUpdateProject,
  onOpenDraft,
}) => {
  const brief = getBrief(project);

  const updateBrief = (updates: Partial<WritingBrief>) => {
    onUpdateProject({
      ...project,
      writingBrief: {
        ...brief,
        ...updates,
      },
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-6 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Writing Brief</p>
          <h2 className="text-xl font-semibold text-slate-900">Set goals, tone, and structure</h2>
          <p className="text-sm text-slate-500">This brief is included in AI drafting and edits.</p>
        </div>
        {onOpenDraft && (
          <Button onClick={onOpenDraft} className="px-4">
            Open Draft
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-500" /> Project Details
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project title</label>
                <input
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  value={project.title}
                  onChange={(e) => onUpdateProject({ ...project, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Short description</label>
                <input
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  value={project.description}
                  onChange={(e) => onUpdateProject({ ...project, description: e.target.value })}
                  placeholder="Optional summary to help you find this later"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Target size={16} className="text-blue-500" /> Goals
            </h3>
            <textarea
              className="w-full min-h-[120px] p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              placeholder="What should this piece accomplish? Key arguments, calls-to-action, or outcomes."
              value={brief.goals}
              onChange={(e) => updateBrief({ goals: e.target.value })}
            />
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Users size={16} className="text-blue-500" /> Audience
            </h3>
            <textarea
              className="w-full min-h-[90px] p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              placeholder="Who is this for? Include knowledge level, role, or context."
              value={brief.audience}
              onChange={(e) => updateBrief({ audience: e.target.value })}
            />
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlignLeft size={16} className="text-blue-500" /> Format & Style
            </h3>
            <div className="space-y-3">
              <textarea
                className="w-full min-h-[100px] p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                placeholder="Desired format (blog post, email, proposal, briefing) and structural requirements."
                value={brief.format}
                onChange={(e) => updateBrief({ format: e.target.value })}
              />
              <input
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Tone / voice (e.g., calm, persuasive, direct)"
                value={brief.tone}
                onChange={(e) => updateBrief({ tone: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <ListChecks size={16} className="text-blue-500" /> Outline
            </h3>
            <textarea
              className="w-full min-h-[160px] p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              placeholder="Draft a simple outline or bullet list of the sections you want. Gemini can use this to generate the draft."
              value={brief.outline}
              onChange={(e) => updateBrief({ outline: e.target.value })}
            />
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-900">
            <div className="flex items-center gap-2 font-semibold uppercase tracking-wide text-[11px]">
              <ClipboardList size={14} /> Brief usage
            </div>
            <p className="mt-2 text-sm text-blue-800/80">
              This brief is injected into Gemini drafting, refinements, and comment-assisted edits so the output stays aligned with your goals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
