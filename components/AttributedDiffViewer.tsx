import React, { useMemo } from 'react';
import { ChangeSource } from '../types';
import { AttributedDiffPart, computeAttributedDiff } from '../utils/diffUtils';
import { Split } from 'lucide-react';

interface AttributedDiffViewerProps {
  base: string;
  target: string;
  llmSnapshot?: string | null;
  forceSource?: ChangeSource;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  closeLabel?: string;
}

const sourceStyles: Record<ChangeSource, { insert: string; delete: string; swatch: string }> = {
  LLM: {
    insert: 'bg-indigo-100 text-indigo-800 decoration-indigo-300',
    delete: 'bg-indigo-50 text-indigo-600 decoration-indigo-300',
    swatch: 'bg-indigo-500'
  },
  USER: {
    insert: 'bg-emerald-100 text-emerald-800 decoration-emerald-300',
    delete: 'bg-amber-50 text-amber-700 decoration-amber-300',
    swatch: 'bg-emerald-500'
  }
};

export const AttributedDiffViewer: React.FC<AttributedDiffViewerProps> = ({
  base,
  target,
  llmSnapshot,
  forceSource,
  title = 'Changes',
  subtitle,
  onClose,
  closeLabel
}) => {
  const diffs = useMemo<AttributedDiffPart[]>(() => computeAttributedDiff(base, target, { llmSnapshot, forceSource }), [base, target, llmSnapshot, forceSource]);

  const stats = useMemo(() => {
    const totals = { additions: 0, deletions: 0, llmAdds: 0, userAdds: 0 };
    for (const part of diffs) {
      if (part.type === 'insert') {
        totals.additions += 1;
        if (part.source === 'LLM') totals.llmAdds += 1;
        if (part.source === 'USER') totals.userAdds += 1;
      }
      if (part.type === 'delete') {
        totals.deletions += 1;
      }
    }
    return totals;
  }, [diffs]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md">
            <Split size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <p className="text-[11px] text-slate-500">
              <span className="text-emerald-600 font-medium">{stats.additions} additions</span>
              <span className="mx-2 text-slate-400">•</span>
              <span className="text-rose-500 font-medium">{stats.deletions} deletions</span>
              {subtitle && <span className="ml-2 text-slate-400">{subtitle}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-indigo-700 font-medium">
              <span className={`w-3 h-3 rounded ${sourceStyles.LLM.swatch}`}></span>
              LLM
              <span className="text-slate-400 ml-1">({stats.llmAdds})</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-700 font-medium">
              <span className={`w-3 h-3 rounded ${sourceStyles.USER.swatch}`}></span>
              User
              <span className="text-slate-400 ml-1">({stats.userAdds})</span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {closeLabel || 'Hide Diff'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">
        {diffs.map((part, index) => {
          if (part.type === 'equal') {
            return <span key={index}>{part.value}</span>;
          }
          if (part.type === 'insert') {
            const style = part.source ? sourceStyles[part.source].insert : 'bg-emerald-50 text-emerald-800';
            return (
              <span key={index} className={`${style} decoration-2 underline-offset-2`}>
                {part.value}
              </span>
            );
          }
          if (part.type === 'delete') {
            const style = part.source ? sourceStyles[part.source].delete : 'bg-amber-50 text-amber-700';
            return (
              <span key={index} className={`${style} line-through decoration-2 decoration-wavy`}>
                {part.value}
              </span>
            );
          }
          return null;
        })}
      </div>

      <div className="h-10 border-t border-slate-200 flex items-center px-4 bg-slate-50 text-[11px] text-slate-500 gap-4 shrink-0">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200 block"></span>
          <span>LLM additions</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 block"></span>
          <span>User additions</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 block relative">
            <span className="absolute inset-x-0 top-1/2 h-px bg-amber-500"></span>
          </span>
          <span>Removed text</span>
        </div>
      </div>
    </div>
  );
};
