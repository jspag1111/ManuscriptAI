
import React, { useMemo } from 'react';
import { computeDiff, DiffPart } from '../utils/diffUtils';
import { Button } from './Button';
import { Check, X, Split } from 'lucide-react';

interface DiffViewerProps {
  original: string;
  modified: string;
  onAccept: () => void;
  onReject: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ original, modified, onAccept, onReject }) => {
  const diffs = useMemo(() => computeDiff(original, modified), [original, modified]);

  // Statistics
  const additions = diffs.filter(d => d.type === 'insert').length;
  const deletions = diffs.filter(d => d.type === 'delete').length;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
           <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md">
             <Split size={18} />
           </div>
           <div>
             <h3 className="text-sm font-semibold text-slate-800">Review AI Changes</h3>
             <p className="text-xs text-slate-500">
               <span className="text-green-600 font-medium">{additions} additions</span>,{' '}
               <span className="text-red-600 font-medium">{deletions} deletions</span>
             </p>
           </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onReject}>
            <X size={16} className="mr-2" />
            Discard
          </Button>
          <Button variant="primary" size="sm" onClick={onAccept}>
            <Check size={16} className="mr-2" />
            Accept Changes
          </Button>
        </div>
      </div>

      {/* Diff Content */}
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
              <span key={index} className="bg-red-50 text-red-400 line-through decoration-red-300 select-none">
                {part.value}
              </span>
            );
          }
          return null;
        })}
      </div>
      
      {/* Footer / Legend */}
      <div className="h-8 border-t border-slate-200 flex items-center px-4 bg-slate-50 text-xs text-slate-500 gap-4 shrink-0">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-100 border border-green-200 block"></span>
          <span>Added Text</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-50 border border-red-200 block relative">
             <span className="absolute inset-x-0 top-1/2 h-px bg-red-400"></span>
          </span>
          <span>Deleted Text</span>
        </div>
      </div>
    </div>
  );
};
