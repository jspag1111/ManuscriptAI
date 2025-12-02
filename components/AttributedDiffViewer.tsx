import React, { useMemo } from 'react';
import { computeDiff, DiffPart } from '../utils/diffUtils';
import { Split } from 'lucide-react';

interface AttributedDiffViewerProps {
  base: string;
  target: string;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  closeLabel?: string;
}

export const AttributedDiffViewer: React.FC<AttributedDiffViewerProps> = ({
  base,
  target,
  title = 'Changes',
  subtitle,
  onClose,
  closeLabel
}) => {
  const diffs = useMemo<DiffPart[]>(() => computeDiff(base, target), [base, target]);

  const stats = useMemo(() => {
    const totals = { additions: 0, deletions: 0 };
    for (const part of diffs) {
      if (part.type === 'insert') {
        totals.additions += 1;
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
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {closeLabel || 'Hide Diff'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">
        {diffs.map((part, index) => {
          if (part.type === 'equal') {
            return <span key={index}>{part.value}</span>;
          }
          if (part.type === 'insert') {
            return (
              <span key={index} className="bg-green-100 text-green-800 decoration-green-300 underline decoration-2 underline-offset-2">
                {part.value}
              </span>
            );
          }
          if (part.type === 'delete') {
            return (
              <span key={index} className="bg-red-50 text-red-600 line-through decoration-red-300 decoration-2 decoration-wavy">
                {part.value}
              </span>
            );
          }
          return null;
        })}
      </div>

      <div className="h-10 border-t border-slate-200 flex items-center px-4 bg-slate-50 text-[11px] text-slate-500 gap-4 shrink-0">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-200 block"></span>
          <span>Additions</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-200 block relative">
            <span className="absolute inset-x-0 top-1/2 h-px bg-red-500"></span>
          </span>
          <span>Removed text</span>
        </div>
      </div>
    </div>
  );
};
