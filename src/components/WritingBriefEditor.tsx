import React from 'react';
import { ArrowDown, ArrowUp, GripHorizontal, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { generateId } from '@/services/storageService';
import type { Project, WritingBrief, WritingBriefBlock } from '@/types';

interface WritingBriefEditorProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  onOpenDraft?: () => void;
}

const getBrief = (project: Project): WritingBrief =>
  project.writingBrief ?? {
    blocks: [],
  };

const createBriefBlock = (index: number): WritingBriefBlock => ({
  id: generateId(),
  title: `Brief Block ${index + 1}`,
  content: '',
});

export const WritingBriefEditor: React.FC<WritingBriefEditorProps> = ({
  project,
  onUpdateProject,
  onOpenDraft,
}) => {
  const brief = getBrief(project);

  const updateBlocks = (blocks: WritingBriefBlock[]) => {
    onUpdateProject({
      ...project,
      writingBrief: { blocks },
    });
  };

  const updateBlock = (blockId: string, updates: Partial<WritingBriefBlock>) => {
    updateBlocks(
      brief.blocks.map((block) => (block.id === blockId ? { ...block, ...updates } : block))
    );
  };

  const handleAddBlock = () => {
    updateBlocks([...brief.blocks, createBriefBlock(brief.blocks.length)]);
  };

  const handleDeleteBlock = (blockId: string) => {
    updateBlocks(brief.blocks.filter((block) => block.id !== blockId));
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    const index = brief.blocks.findIndex((block) => block.id === blockId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= brief.blocks.length) return;

    const nextBlocks = [...brief.blocks];
    const [moved] = nextBlocks.splice(index, 1);
    nextBlocks.splice(nextIndex, 0, moved);
    updateBlocks(nextBlocks);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-6 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Writing Brief</p>
          <h2 className="text-xl font-semibold text-slate-900">Build your own prompt context</h2>
          <p className="text-sm text-slate-500">Create custom brief blocks, then choose which ones the AI should see for each section.</p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenDraft && (
            <Button onClick={onOpenDraft} variant="secondary" className="px-4">
              Open Section
            </Button>
          )}
          <Button onClick={handleAddBlock} className="px-4">
            <Plus size={16} className="mr-2" />
            Add Brief Block
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="space-y-6 max-w-5xl">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-800">Project Details</h3>
                <p className="text-sm text-slate-500">Keep the project metadata tight and use custom blocks for everything you want to feed into drafting.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-5">
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

          {brief.blocks.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/80 p-10 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                <Sparkles size={20} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No brief blocks yet</h3>
              <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
                Add blocks for anything the drafter should know: brand voice, constraints, required talking points, source notes, examples, or structural rules.
              </p>
              <Button onClick={handleAddBlock} className="mt-5 px-4">
                <Plus size={16} className="mr-2" />
                Add Your First Block
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {brief.blocks.map((block, index) => (
                <div key={block.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
                        <GripHorizontal size={16} />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Block title</label>
                          <input
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            value={block.title}
                            onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                            placeholder="e.g., Voice and tone"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Block content</label>
                          <textarea
                            className="w-full min-h-[160px] p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                            value={block.content}
                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                            placeholder="Write anything you may want to include in AI context for one or more sections."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 lg:pl-4">
                      <button
                        type="button"
                        onClick={() => moveBlock(block.id, -1)}
                        disabled={index === 0}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(block.id, 1)}
                        disabled={index === brief.blocks.length - 1}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(block.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                        title="Delete block"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-900">
            <div className="flex items-center gap-2 font-semibold uppercase tracking-wide text-[11px]">
              <Sparkles size={14} /> AI context
            </div>
            <p className="mt-2 text-sm text-blue-800/80">
              Each writing section can choose which brief blocks and sibling text sections to include when drafting, so prompts stay focused instead of stuffing everything into one request.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
