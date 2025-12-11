import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { AttributedDiffViewer } from './AttributedDiffViewer';
import { Button } from './Button';
import { Section, SectionVersion } from '@/types';

interface HistoryViewerProps {
  section: Section;
  onRestore: (v: SectionVersion) => void;
  onClose: () => void;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ section, onRestore, onClose }) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [showDiff, setShowDiff] = useState(false);

  const handleSelectVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
    setShowDiff(false);
  };

  const selectedVersion = section.versions.find(v => v.id === selectedVersionId);
  const selectedIndex = selectedVersion ? section.versions.findIndex(v => v.id === selectedVersionId) : -1;
  const previousContent = selectedVersion
    ? section.versions[selectedIndex + 1]?.content ?? section.currentVersionBase
    : section.versions[0]?.content ?? section.currentVersionBase;
  const displayContent = selectedVersion ? selectedVersion.content : section.content;
  const hasComparison = selectedVersion
    ? !!section.versions[selectedIndex + 1] || !!section.currentVersionBase
    : section.versions.length > 0 || !!section.currentVersionBase;
  const hasChanges = hasComparison && previousContent !== undefined && previousContent !== null && previousContent !== displayContent;

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-14 border-b border-slate-200 flex items-center px-4 justify-between bg-slate-50">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onClose} className="mr-2">
            <ArrowLeft size={16} />
          </Button>
          <span className="font-semibold text-slate-700">Version History: {section.title}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Showing: {selectedVersion ? 'Saved version' : 'Current draft'}</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar List */}
        <div className="w-1/3 min-w-[250px] border-r border-slate-200 overflow-y-auto bg-slate-50">
          <div className="p-2 space-y-2">
             <div 
                className={`p-3 rounded-md cursor-pointer border ${!selectedVersionId ? 'bg-white border-blue-500 shadow-sm' : 'border-transparent hover:bg-slate-100'}`}
                onClick={() => handleSelectVersion('')}
             >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm text-slate-800">
                    Current Draft
                  </span>
                  <span className="text-xs text-slate-400">Now</span>
                </div>
                <p className="text-xs text-slate-500 truncate">Latest edits</p>
             </div>

            {section.versions.map((v) => (
              <div 
                key={v.id}
                className={`p-3 rounded-md cursor-pointer border ${selectedVersionId === v.id ? 'bg-white border-blue-500 shadow-sm' : 'border-transparent hover:bg-slate-100'}`}
                onClick={() => handleSelectVersion(v.id)}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm text-slate-800">
                    {new Date(v.timestamp).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-slate-400">
                     {new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{v.commitMessage || 'Auto-save'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 flex flex-col bg-white min-h-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="text-sm text-slate-600">
                {selectedVersion ? 'Compare to previous version' : 'Compare current draft to last saved version'}
              </div>
              <button
                onClick={() => setShowDiff(!showDiff)}
                disabled={!hasComparison}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                  showDiff ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                } ${!hasComparison ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {showDiff ? <EyeOff size={14} /> : <Eye size={14} />}
                {showDiff ? 'Hide Diff' : 'Show Diff'}
              </button>
            </div>

            <div className="flex-1 min-h-0">
              {showDiff && hasComparison ? (
                <AttributedDiffViewer
                  base={previousContent ?? ''}
                  target={displayContent}
                  title="Version Diff"
                  subtitle={hasChanges ? 'Compared to prior version' : 'No changes since prior version'}
                />
              ) : (
                <div className="flex-1 p-8 overflow-y-auto font-serif text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {displayContent}
                  {!hasComparison && (
                    <p className="text-sm text-slate-500 mt-4">
                      No prior version available for comparison yet.
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {selectedVersionId && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                <Button onClick={() => selectedVersion && onRestore(selectedVersion)}>
                  <RotateCcw size={16} className="mr-2" />
                  Restore This Version
                </Button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
