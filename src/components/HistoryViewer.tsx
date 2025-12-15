import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { AttributedDiffViewer } from './AttributedDiffViewer';
import { ChangePanel } from './ChangePanel';
import { Button } from './Button';
import { ProseMirrorEditor } from './ProseMirrorEditor';
import type { ChangeActor, Reference, Section, SectionChangeEvent, SectionVersion } from '@/types';

interface HistoryViewerProps {
  section: Section;
  bibliographyOrder: string[];
  references: Reference[];
  onRestore: (v: SectionVersion) => void;
  onClose: () => void;
}

const HISTORY_ACTOR: ChangeActor = { type: 'USER', userId: 'history', name: 'History' };

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ section, bibliographyOrder, references, onRestore, onClose }) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [showHighlights, setShowHighlights] = useState(false);

  const handleSelectVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
    setShowHighlights(false);
  };

  const selectedVersion = section.versions.find(v => v.id === selectedVersionId);
  const selectedIndex = selectedVersion ? section.versions.findIndex(v => v.id === selectedVersionId) : -1;
  const isViewingSavedVersion = !!selectedVersionId && !!selectedVersion;

  const fallbackBase =
    selectedVersion && selectedIndex >= 0
      ? section.versions[selectedIndex + 1]?.content ?? section.currentVersionBase
      : section.currentVersionBase;

  const displayContent = selectedVersion ? selectedVersion.content : section.content;
  const trackedBaseContent = selectedVersion?.baseContent ?? (isViewingSavedVersion ? fallbackBase : section.currentVersionBase);
  const trackedEvents: SectionChangeEvent[] = selectedVersion
    ? Array.isArray(selectedVersion.changeEvents)
      ? selectedVersion.changeEvents
      : []
    : Array.isArray(section.changeEvents)
      ? section.changeEvents
      : [];

  const hasAttributionData =
    selectedVersion
      ? selectedVersion.baseContent !== undefined || Array.isArray(selectedVersion.changeEvents)
      : section.currentVersionBase !== undefined || Array.isArray(section.changeEvents);

  const hasComparison = trackedBaseContent !== undefined && trackedBaseContent !== null;
  const hasChanges = hasComparison && trackedBaseContent !== displayContent;

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

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 lg:gap-0">
        {/* Sidebar List */}
        <div className="w-full lg:w-80 lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto bg-slate-50/80 max-h-64 lg:max-h-none lg:overflow-y-auto rounded-xl lg:rounded-none">
          <div className="p-3 space-y-2">
             <div
                className={`p-3 rounded-lg cursor-pointer border transition-colors ${!selectedVersionId ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-100' : 'border-transparent hover:bg-slate-100'}`}
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
                className={`p-3 rounded-lg cursor-pointer border transition-colors ${selectedVersionId === v.id ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-100' : 'border-transparent hover:bg-slate-100'}`}
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
        <div className="flex-1 flex flex-col bg-white min-h-0 border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 gap-3">
            <div className="text-sm text-slate-600">
              {selectedVersion ? 'Toggle highlights to review edits for this saved version' : 'Toggle highlights to review edits since this version began'}
            </div>
            <button
              onClick={() => setShowHighlights(!showHighlights)}
              disabled={!hasComparison}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                showHighlights ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              } ${!hasComparison ? 'opacity-60 cursor-not-allowed' : ''}`}
              title={
                !hasComparison
                  ? 'No prior version available for comparison yet.'
                  : hasAttributionData
                    ? 'Show tracked edits'
                    : 'Show a text diff (no attribution data saved for this version).'
              }
            >
              {showHighlights ? <EyeOff size={14} /> : <Eye size={14} />}
              {showHighlights ? 'Hide Edits' : 'Show Edits'}
            </button>
          </div>

          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-h-0">
              {hasAttributionData && trackedBaseContent !== undefined ? (
                <ProseMirrorEditor
                  key={selectedVersion ? `version:${selectedVersion.id}` : `current:${section.currentVersionId || section.id}`}
                  content={displayContent}
                  bibliographyOrder={bibliographyOrder}
                  references={references}
                  onChange={() => {}}
                  placeholder=""
                  renderCitations
                  readOnly
                  trackChanges={{
                    baseContent: trackedBaseContent ?? '',
                    events: trackedEvents,
                    actor: HISTORY_ACTOR,
                    showHighlights,
                    onEventsChange: () => {},
                  }}
                />
              ) : showHighlights && hasComparison ? (
                <AttributedDiffViewer
                  base={trackedBaseContent ?? ''}
                  target={displayContent}
                  title="Version Diff"
                  subtitle={hasChanges ? 'Compared to prior version' : 'No changes since prior version'}
                />
              ) : (
                <ProseMirrorEditor
                  key={selectedVersion ? `version:${selectedVersion.id}` : `current:${section.currentVersionId || section.id}`}
                  content={displayContent}
                  bibliographyOrder={bibliographyOrder}
                  references={references}
                  onChange={() => {}}
                  placeholder=""
                  renderCitations
                  readOnly
                />
              )}
            </div>

            {showHighlights && hasAttributionData && (
              <div className="hidden lg:flex">
                <ChangePanel events={trackedEvents} />
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
