import React, { useState } from 'react';
import { Section, SectionVersion } from '../types';
import { Button } from './Button';
import { ArrowLeft, Clock, RotateCcw } from 'lucide-react';

interface HistoryViewerProps {
  section: Section;
  onRestore: (v: SectionVersion) => void;
  onClose: () => void;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ section, onRestore, onClose }) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(section.versions[0]?.id || '');
  
  const selectedVersion = section.versions.find(v => v.id === selectedVersionId);
  const currentContent = section.content;

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-14 border-b border-slate-200 flex items-center px-4 justify-between bg-slate-50">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onClose} className="mr-2">
            <ArrowLeft size={16} />
          </Button>
          <span className="font-semibold text-slate-700">Version History: {section.title}</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar List */}
        <div className="w-1/3 min-w-[250px] border-r border-slate-200 overflow-y-auto bg-slate-50">
          <div className="p-2 space-y-2">
             <div 
                className={`p-3 rounded-md cursor-pointer border ${!selectedVersionId ? 'bg-white border-blue-500 shadow-sm' : 'border-transparent hover:bg-slate-100'}`}
                onClick={() => setSelectedVersionId('')}
             >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm text-slate-800">Current Draft</span>
                  <span className="text-xs text-slate-400">Now</span>
                </div>
                <p className="text-xs text-slate-500 truncate">Latest edits</p>
             </div>

            {section.versions.map((v) => (
              <div 
                key={v.id}
                className={`p-3 rounded-md cursor-pointer border ${selectedVersionId === v.id ? 'bg-white border-blue-500 shadow-sm' : 'border-transparent hover:bg-slate-100'}`}
                onClick={() => setSelectedVersionId(v.id)}
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
        <div className="flex-1 flex flex-col bg-white">
            <div className="flex-1 p-8 overflow-y-auto font-serif text-slate-800 leading-relaxed whitespace-pre-wrap">
              {selectedVersionId && selectedVersion ? selectedVersion.content : currentContent}
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
