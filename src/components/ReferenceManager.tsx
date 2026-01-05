import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Copy, Download, Library, ListOrdered, Search, Sparkles, Trash2 } from 'lucide-react';
import { Button } from './Button';
import ReferenceAssistantPanel from './ReferenceAssistantPanel';
import { summarizeReference } from '@/services/geminiService';
import { importReferenceMetadata } from '@/services/referenceService';
import { generateId } from '@/services/storageService';
import { Project, Reference } from '@/types';
import { getBibliographyOrder } from '@/utils/citationUtils';

interface ReferenceManagerProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

export const ReferenceManager: React.FC<ReferenceManagerProps> = ({ project, onUpdateProject }) => {
  const [activeTab, setActiveTab] = useState<'library' | 'bibliography' | 'assistant'>('library');
  const [isAdding, setIsAdding] = useState(false);
  const [newRef, setNewRef] = useState<Partial<Reference>>({});
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);
  const [importInput, setImportInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedRefs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Compute the bibliography based on citation order in sections
  const bibliography = useMemo(() => {
     const order = getBibliographyOrder(project.sections);
     const usedRefs = order.map(id => project.references.find(r => r.id === id)).filter(Boolean) as Reference[];
     return usedRefs;
  }, [project.sections, project.references]);

  // Helper to shorten author list for display
  const formatAuthorsDisplay = (authors?: string) => {
    if (!authors) return "Unknown Authors";
    const parts = authors.split(',');
    if (parts.length > 1) {
      return `${parts[0].trim()} et al.`;
    }
    return authors;
  };

  const saveNewReference = (refData: Partial<Reference>) => {
    const ref: Reference = {
        id: generateId(),
        title: refData.title || 'Untitled',
        authors: refData.authors || 'Unknown',
        year: refData.year || new Date().getFullYear().toString(),
        publication: refData.publication || '',
        doi: refData.doi || '',
        summary: refData.summary || '',
        abstract: refData.abstract || '',
        notes: refData.notes || '',
        articleType: refData.articleType || ''
    };
    onUpdateProject({
        ...project,
        references: [...project.references, ref]
    });
  };

  const handleManualAdd = () => {
    if (!newRef.title || !newRef.authors) return;
    saveNewReference(newRef);
    setNewRef({});
    setIsAdding(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Remove this reference? It will be removed from your library. If cited in text, it will break citation numbers.")) {
        onUpdateProject({
        ...project,
        references: project.references.filter(r => r.id !== id)
        });
    }
  };

  const handleImport = async () => {
    if (!importInput.trim()) return;
    setIsImporting(true);
    try {
      const refData = await importReferenceMetadata(importInput);

      if (refData) {
          setNewRef(refData);
          setIsAdding(true);
          setImportInput('');
          setActiveTab('library'); // Ensure we are on library view to edit/save
      } else {
          alert("Reference not found. Please check the PMID or DOI.");
      }
    } catch (e) {
      console.error(e);
      alert("Error importing reference.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSummarize = async (id: string, text: string) => {
    setLoadingSummary(id);
    try {
      const summary = await summarizeReference(text);
      const updatedRefs = project.references.map(r => 
        r.id === id ? { ...r, summary } : r
      );
      onUpdateProject({ ...project, references: updatedRefs });
    } catch (e) {
      alert("Failed to summarize");
    } finally {
      setLoadingSummary(null);
    }
  };

  const ReferenceList = ({ refs, isBibliography }: { refs: Reference[], isBibliography?: boolean }) => (
    <div className="space-y-3">
        {refs.map((ref, index) => {
          const isExpanded = expandedRefs[ref.id];
          return (
            <div key={ref.id} className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div 
                className="p-4 flex items-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpand(ref.id)}
              >
                 <div className="mr-3 text-slate-400">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                 </div>
                 {isBibliography ? (
                     <div className="font-serif font-bold text-slate-700 mr-3 w-6 text-right shrink-0">{index + 1}.</div>
                 ) : (
                    <div className="flex items-center justify-center bg-blue-100 text-blue-700 font-bold text-xs h-6 w-6 rounded mr-3 shrink-0">L</div>
                 )}
                 
                 <div className="flex-1 min-w-0 mr-4">
                    <h4 className="font-medium text-slate-800 truncate">{ref.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        {ref.articleType && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
                                {ref.articleType}
                            </span>
                        )}
                        <span className="text-xs text-slate-500">{formatAuthorsDisplay(ref.authors)}</span>
                        {ref.publication && (
                            <>
                                <span className="text-xs text-slate-300">•</span>
                                <span className="text-xs text-slate-500 italic truncate max-w-[200px]">{ref.publication}</span>
                            </>
                        )}
                    </div>
                 </div>
                 <div className="text-xs text-slate-500 shrink-0">
                    {ref.year}
                 </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                   <div className="pt-3 space-y-3">
                      <div className="text-sm text-slate-700 grid grid-cols-[80px_1fr] gap-2">
                         <span className="font-semibold text-slate-500">Authors:</span> 
                         <span>{ref.authors}</span>
                      </div>
                      <div className="text-sm text-slate-700 grid grid-cols-[80px_1fr] gap-2">
                         <span className="font-semibold text-slate-500">Journal:</span> 
                         <span className="italic">{ref.publication || 'N/A'}</span>
                      </div>
                      {ref.doi && (
                         <div className="text-sm text-slate-700 grid grid-cols-[80px_1fr] gap-2">
                             <span className="font-semibold text-slate-500">DOI:</span>
                             <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{ref.doi}</a>
                         </div>
                      )}
                      {ref.abstract && (
                        <div className="mt-2 bg-white p-3 rounded border border-slate-200">
                           <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Abstract</div>
                           <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ref.abstract}</p>
                        </div>
                      )}
                      <div className="pt-2">
                        {ref.summary ? (
                            <div className="bg-yellow-50 p-3 rounded text-sm text-slate-700 border border-yellow-100">
                              <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-yellow-800 text-xs uppercase tracking-wider flex items-center"><Sparkles size={10} className="mr-1" /> AI Summary</span>
                              </div>
                              {ref.summary}
                            </div>
                        ) : (
                            <Button variant="ghost" size="sm" className="text-blue-600 -ml-2" onClick={(e) => {
                                e.stopPropagation();
                                handleSummarize(ref.id, `Title: ${ref.title}. Abstract: ${ref.abstract || ''}`);
                            }} isLoading={loadingSummary === ref.id}>
                                <Sparkles size={14} className="mr-1" /> Generate AI Summary
                            </Button>
                        )}
                      </div>
                      {!isBibliography && (
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                            <Button variant="ghost" size="sm" onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(`[[ref:${ref.id}]]`);
                            }}>
                                <Copy size={14} className="mr-1" /> Copy ID
                            </Button>
                            <button onClick={(e) => handleDelete(e, ref.id)} className="text-red-500 hover:text-red-700 text-sm flex items-center px-2 py-1 rounded hover:bg-red-50">
                                <Trash2 size={14} className="mr-1" /> Remove
                            </button>
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          );
        })}
        {refs.length === 0 && (
            <div className="text-center py-10 text-slate-400">
                {isBibliography ? "No citations found in manuscript text." : "No references in library."}
            </div>
        )}
    </div>
  );

  const contentClassName = activeTab === 'assistant'
    ? 'flex-1 min-h-0 overflow-hidden px-6 pb-6'
    : 'flex-1 min-h-0 overflow-y-auto px-6 pb-6';

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-50">
      <div className="p-6 pb-0">
         <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
            <BookOpen size={20} className="mr-2" />
            Reference Manager
            </h3>
         </div>

         <div className="flex space-x-1 bg-white p-1 rounded-lg border border-slate-200 mb-4">
             <button 
                onClick={() => setActiveTab('library')}
                className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'library' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <Library size={16} className="mr-2" /> Library ({project.references.length})
             </button>
             <button
                onClick={() => setActiveTab('assistant')}
                className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'assistant' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <Sparkles size={16} className="mr-2" /> Assistant
             </button>
             <button 
                onClick={() => setActiveTab('bibliography')}
                className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'bibliography' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <ListOrdered size={16} className="mr-2" /> Bibliography ({bibliography.length})
             </button>
         </div>
      </div>

      <div className={contentClassName}>
        {activeTab === 'library' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-4 rounded-lg space-y-4 shadow-sm">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-400" />
                        </div>
                        <input 
                        type="text"
                        placeholder="Enter PMID (e.g. 321...) or DOI (e.g. 10.1038/...)"
                        className="pl-9 w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={importInput}
                        onChange={e => setImportInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleImport()}
                        />
                    </div>
                    <Button onClick={handleImport} disabled={!importInput.trim() || isImporting} isLoading={isImporting}>
                         <Download size={16} className="mr-2" /> Import
                    </Button>
                    <Button variant="secondary" onClick={() => setIsAdding(!isAdding)}>
                        {isAdding ? 'Cancel' : 'Manual'}
                    </Button>
                </div>

                {isAdding && (
                <div className="bg-slate-50 border border-blue-100 p-4 rounded animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-3">
                    <input placeholder="Title" className="w-full p-2 border rounded text-sm" value={newRef.title || ''} onChange={e => setNewRef({...newRef, title: e.target.value})} />
                    <div className="flex gap-2">
                        <input placeholder="Authors" className="flex-1 p-2 border rounded text-sm" value={newRef.authors || ''} onChange={e => setNewRef({...newRef, authors: e.target.value})} />
                        <input placeholder="Year" className="w-24 p-2 border rounded text-sm" value={newRef.year || ''} onChange={e => setNewRef({...newRef, year: e.target.value})} />
                    </div>
                    <input placeholder="Publication / Journal" className="w-full p-2 border rounded text-sm" value={newRef.publication || ''} onChange={e => setNewRef({...newRef, publication: e.target.value})} />
                    <input placeholder="DOI (Optional)" className="w-full p-2 border rounded text-sm" value={newRef.doi || ''} onChange={e => setNewRef({...newRef, doi: e.target.value})} />
                    <input placeholder="Article Type (e.g. Review, Clinical Trial)" className="w-full p-2 border rounded text-sm" value={newRef.articleType || ''} onChange={e => setNewRef({...newRef, articleType: e.target.value})} />
                    <textarea placeholder="Abstract (Optional)" className="w-full p-2 border rounded text-sm h-24" value={newRef.abstract || ''} onChange={e => setNewRef({...newRef, abstract: e.target.value})} />
                    <div className="flex justify-end">
                        <Button onClick={handleManualAdd} disabled={!newRef.title || !newRef.authors}>Save Reference</Button>
                    </div>
                    </div>
                </div>
                )}
            </div>
            <ReferenceList refs={project.references} />
          </div>
        )}

        {activeTab === 'assistant' && (
          <ReferenceAssistantPanel project={project} onUpdateProject={onUpdateProject} />
        )}

        {activeTab === 'bibliography' && (
             <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-md text-sm text-blue-800 mb-4">
                    This list is automatically generated based on the citations found in your manuscript sections. 
                    The order matches the order of appearance.
                </div>
                <ReferenceList refs={bibliography} isBibliography />
             </div>
        )}
      </div>
    </div>
  );
};
