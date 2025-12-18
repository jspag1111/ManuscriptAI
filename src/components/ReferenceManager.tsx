import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Copy, Download, ExternalLink, Globe, Library, ListOrdered, Plus, Search, Sparkles, Tag, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { summarizeReference } from '@/services/geminiService';
import { fetchBatchReferenceMetadata, importReferenceMetadata } from '@/services/referenceService';
import { generateId } from '@/services/storageService';
import { PaperSearchResult, Project, Reference } from '@/types';
import { getBibliographyOrder } from '@/utils/citationUtils';
import type { DiscoverClarifyingQuestion, DiscoverKeptItem, DiscoverMode, DiscoverQueryAttempt } from '@/lib/discover/types';

interface ReferenceManagerProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

export const ReferenceManager: React.FC<ReferenceManagerProps> = ({ project, onUpdateProject }) => {
  const [activeTab, setActiveTab] = useState<'library' | 'bibliography' | 'search'>('library');
  const [isAdding, setIsAdding] = useState(false);
  const [newRef, setNewRef] = useState<Partial<Reference>>({});
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);
  const [importInput, setImportInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PaperSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLogs, setSearchLogs] = useState<string[]>([]);
  const [addingSearchResult, setAddingSearchResult] = useState<number | null>(null);

  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>('highly_relevant');
  const [discoverExclusions, setDiscoverExclusions] = useState({
    englishOnly: true,
    excludeAnimalOnly: true,
    excludeCaseReports: true,
    excludePediatrics: false,
  });
  const [discoverConstraints, setDiscoverConstraints] = useState({
    yearFrom: undefined as number | undefined,
    yearTo: undefined as number | undefined,
    mustInclude: '',
    mustExclude: '',
  });

  const [discoverRunId, setDiscoverRunId] = useState<string | null>(null);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<DiscoverClarifyingQuestion[]>([]);
  const [clarifyingAnswers, setClarifyingAnswers] = useState<Record<string, string>>({});
  const [discoverPlan, setDiscoverPlan] = useState<string[]>([]);
  const [discoverAssumptions, setDiscoverAssumptions] = useState<string[]>([]);
  const [discoverRubric, setDiscoverRubric] = useState<string>('');
  const [discoverAttempts, setDiscoverAttempts] = useState<DiscoverQueryAttempt[]>([]);
  const [discoverKept, setDiscoverKept] = useState<DiscoverKeptItem[]>([]);
  const [feedbackByPmid, setFeedbackByPmid] = useState<Record<string, 'up' | 'down'>>({});
  
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});
  const logsEndRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedRefs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchLogs]);

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

  const resetDiscoverState = () => {
    setDiscoverRunId(null);
    setClarifyingQuestions([]);
    setClarifyingAnswers({});
    setDiscoverPlan([]);
    setDiscoverAssumptions([]);
    setDiscoverRubric('');
    setDiscoverAttempts([]);
    setDiscoverKept([]);
    setFeedbackByPmid({});
    setSearchResults([]);
    setSearchLogs([]);
  };

  const fetchDiscoverAgent = async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/discover/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error || response.statusText || 'Discover agent request failed';
      throw new Error(`Discover agent (${response.status}): ${message}`);
    }
    return data;
  };

  const mergeKeptIntoResults = async (kept: DiscoverKeptItem[]) => {
    const existing = new Map<string, PaperSearchResult>();
    for (const r of searchResults) {
      if (r.pmid) existing.set(r.pmid, r);
    }

    const missingPmids = kept
      .map((k) => k.pmid)
      .filter((pmid) => pmid && !existing.has(pmid));

    let fetched: PaperSearchResult[] = [];
    if (missingPmids.length > 0) {
      try {
        fetched = await fetchBatchReferenceMetadata(missingPmids);
      } catch (e) {
        console.error('Failed fetching PubMed metadata', e);
      }
      for (const item of fetched) {
        if (item.pmid) existing.set(item.pmid, item);
      }
    }

    const ordered = kept.map((k) => {
      const base = existing.get(k.pmid) || { pmid: k.pmid, title: k.title, url: `https://pubmed.ncbi.nlm.nih.gov/${k.pmid}/` };
      return { ...base, title: base.title || k.title, relevance: k.reason };
    });

    setSearchResults(ordered);
  };

  const runDiscoverSearch = async ({
    runId,
    answers,
    additionalTarget,
  }: {
    runId: string;
    answers?: Record<string, string>;
    additionalTarget?: number;
  }) => {
    setIsSearching(true);
    setSearchLogs((prev) => (prev.length ? [...prev, 'Running search agent...'] : ['Running search agent...']));
    try {
      const data = await fetchDiscoverAgent({
        action: 'search',
        runId,
        clarifyingAnswers: answers,
        feedback: {
          thumbsUpPmids: Object.entries(feedbackByPmid).filter(([, v]) => v === 'up').map(([k]) => k),
          thumbsDownPmids: Object.entries(feedbackByPmid).filter(([, v]) => v === 'down').map(([k]) => k),
        },
        additionalTarget,
      });

      setDiscoverRubric(data.rubric || '');
      setDiscoverAttempts((data.attempts || []) as DiscoverQueryAttempt[]);
      setSearchLogs((data.logs || []) as string[]);
      setDiscoverKept((data.kept || []) as DiscoverKeptItem[]);
      await mergeKeptIntoResults((data.kept || []) as DiscoverKeptItem[]);
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'Search agent encountered an error.';
      setSearchLogs((prev) => [...prev, message]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDiscoverStart = async () => {
    if (!searchQuery.trim()) return;
    resetDiscoverState();
    setIsSearching(true);
    setSearchLogs(['Starting PubMed search agent...']);
    try {
      const data = await fetchDiscoverAgent({
        action: 'start',
        request: searchQuery,
        mode: discoverMode,
        exclusions: discoverExclusions,
        constraints: discoverConstraints,
      });

      setDiscoverRunId(data.runId);
      setClarifyingQuestions((data.clarifyingQuestions || []) as DiscoverClarifyingQuestion[]);
      setDiscoverPlan((data.plan || []) as string[]);
      setDiscoverAssumptions((data.assumptions || []) as string[]);
      setSearchLogs((data.logs || []) as string[]);

      if (!data.clarifyingQuestions || data.clarifyingQuestions.length === 0) {
        await runDiscoverSearch({ runId: data.runId });
      } else {
        setIsSearching(false);
      }
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'Search agent encountered an error.';
      setSearchLogs((prev) => [...prev, message]);
      setIsSearching(false);
    }
  };

  const handleDiscoverContinue = async () => {
    if (!discoverRunId) return;
    await runDiscoverSearch({ runId: discoverRunId, answers: clarifyingAnswers });
  };

  const handleDiscoverMore = async () => {
    if (!discoverRunId) return;
    const additionalTarget = discoverMode === 'highly_relevant' ? 10 : 25;
    await runDiscoverSearch({ runId: discoverRunId, additionalTarget });
  };

  const handleDiscoverRefine = async () => {
    if (!discoverRunId) return;
    const hasFeedback = Object.keys(feedbackByPmid).length > 0;
    if (!hasFeedback) return;
    const additionalTarget = discoverMode === 'highly_relevant' ? 10 : 20;
    await runDiscoverSearch({ runId: discoverRunId, additionalTarget });
  };

  const toggleFeedback = (pmid: string, value: 'up' | 'down') => {
    setFeedbackByPmid((prev) => {
      const next = { ...prev };
      if (next[pmid] === value) {
        delete next[pmid];
        return next;
      }
      next[pmid] = value;
      return next;
    });
  };

  const handleAddSearchResult = async (result: PaperSearchResult, index: number) => {
      setAddingSearchResult(index);
      try {
          const refData: Partial<Reference> = {
              title: result.title,
              authors: result.authors || '',
              year: result.year || '',
              doi: result.doi || '',
              abstract: result.abstract || '',
              publication: result.publication || '',
              notes: result.pmid ? `Source URL: https://pubmed.ncbi.nlm.nih.gov/${result.pmid}/\nPMID: ${result.pmid}` : '',
              articleType: result.articleType || ''
          };

          saveNewReference(refData);
          
      } catch (e) {
          console.error(e);
          alert("Failed to add reference.");
      } finally {
          setAddingSearchResult(null);
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

  return (
    <div className="h-full flex flex-col bg-slate-50">
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
                onClick={() => setActiveTab('search')}
                className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'search' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <Globe size={16} className="mr-2" /> Discover
             </button>
             <button 
                onClick={() => setActiveTab('bibliography')}
                className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'bibliography' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <ListOrdered size={16} className="mr-2" /> Bibliography ({bibliography.length})
             </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
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
        
        {activeTab === 'search' && (
             <div className="space-y-6">
                 <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
                     <h4 className="font-semibold text-slate-800 mb-2">Find Relevant Articles</h4>
                     <p className="text-sm text-slate-500 mb-4">
                        Describe what you need, answer any quick clarifying questions, then the agent runs multiple PubMed queries and curates a relevance-filtered list.
                     </p>
                     <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={discoverMode === 'highly_relevant' ? 'primary' : 'secondary'}
                                onClick={() => setDiscoverMode('highly_relevant')}
                                disabled={isSearching}
                            >
                                Highly Relevant
                            </Button>
                            <Button
                                size="sm"
                                variant={discoverMode === 'comprehensive' ? 'primary' : 'secondary'}
                                onClick={() => setDiscoverMode('comprehensive')}
                                disabled={isSearching}
                            >
                                Comprehensive
                            </Button>
                        </div>
                        <Button size="sm" variant="secondary" onClick={resetDiscoverState} disabled={isSearching}>
                            Reset
                        </Button>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-sm text-slate-700">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={discoverExclusions.englishOnly}
                                onChange={(e) => setDiscoverExclusions((prev) => ({ ...prev, englishOnly: e.target.checked }))}
                                disabled={isSearching}
                            />
                            English only
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={discoverExclusions.excludeAnimalOnly}
                                onChange={(e) => setDiscoverExclusions((prev) => ({ ...prev, excludeAnimalOnly: e.target.checked }))}
                                disabled={isSearching}
                            />
                            Exclude animal-only studies
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={discoverExclusions.excludeCaseReports}
                                onChange={(e) => setDiscoverExclusions((prev) => ({ ...prev, excludeCaseReports: e.target.checked }))}
                                disabled={isSearching}
                            />
                            Exclude case reports
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={discoverExclusions.excludePediatrics}
                                onChange={(e) => setDiscoverExclusions((prev) => ({ ...prev, excludePediatrics: e.target.checked }))}
                                disabled={isSearching}
                            />
                            Exclude pediatrics
                        </label>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        <input
                            type="text"
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            placeholder="Must include (optional) — keywords or PubMed syntax"
                            value={discoverConstraints.mustInclude}
                            onChange={(e) => setDiscoverConstraints((prev) => ({ ...prev, mustInclude: e.target.value }))}
                            disabled={isSearching}
                        />
                        <input
                            type="text"
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            placeholder="Must exclude (optional) — keywords or PubMed syntax"
                            value={discoverConstraints.mustExclude}
                            onChange={(e) => setDiscoverConstraints((prev) => ({ ...prev, mustExclude: e.target.value }))}
                            disabled={isSearching}
                        />
                        <input
                            type="number"
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            placeholder="Year from (optional)"
                            value={discoverConstraints.yearFrom ?? ''}
                            onChange={(e) =>
                                setDiscoverConstraints((prev) => ({ ...prev, yearFrom: e.target.value ? Number(e.target.value) : undefined }))
                            }
                            disabled={isSearching}
                        />
                        <input
                            type="number"
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            placeholder="Year to (optional)"
                            value={discoverConstraints.yearTo ?? ''}
                            onChange={(e) =>
                                setDiscoverConstraints((prev) => ({ ...prev, yearTo: e.target.value ? Number(e.target.value) : undefined }))
                            }
                            disabled={isSearching}
                        />
                     </div>

                     <div className="flex flex-col gap-3">
                        <textarea
                            className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm h-24"
                            placeholder="e.g. Recent clinical trials for CAR-T therapy in solid tumors..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.ctrlKey && e.key === 'Enter' && handleDiscoverStart()}
                        />
                        
                        {/* Search Logs / Terminal */}
                        {(searchLogs.length > 0 || isSearching) && (
                            <div className="bg-slate-900 rounded-md p-3 font-mono text-xs max-h-32 overflow-y-auto custom-scrollbar border border-slate-700 shadow-inner">
                                {searchLogs.map((log, i) => (
                                    <div key={i} className="mb-1">
                                        <span className="text-green-500 mr-2">➜</span>
                                        <span className="text-slate-300">{log}</span>
                                    </div>
                                ))}
                                {isSearching && (
                                    <div className="animate-pulse text-green-400">_</div>
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button onClick={handleDiscoverStart} isLoading={isSearching} disabled={!searchQuery.trim()}>
                                <Sparkles size={16} className="mr-2" /> Start Agent
                            </Button>
                        </div>
                     </div>

                     {(discoverPlan.length > 0 || discoverAssumptions.length > 0 || discoverRubric) && (
                        <div className="mt-4">
                            <details className="text-sm text-slate-600">
                                <summary className="cursor-pointer select-none font-medium hover:text-blue-600">Agent details</summary>
                                <div className="mt-3 space-y-3">
                                    {discoverPlan.length > 0 && (
                                        <div>
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Plan</div>
                                            <ul className="list-disc pl-5 space-y-1">
                                                {discoverPlan.map((item, idx) => (
                                                    <li key={idx}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {discoverAssumptions.length > 0 && (
                                        <div>
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Assumptions</div>
                                            <ul className="list-disc pl-5 space-y-1">
                                                {discoverAssumptions.map((item, idx) => (
                                                    <li key={idx}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {discoverRubric && (
                                        <div>
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rubric</div>
                                            <div className="whitespace-pre-wrap text-slate-700 bg-slate-50 border border-slate-200 rounded p-2">
                                                {discoverRubric}
                                            </div>
                                        </div>
                                    )}
                                    {discoverAttempts.length > 0 && (
                                        <div>
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Queries Tried</div>
                                            <div className="space-y-2">
                                                {discoverAttempts.map((a) => (
                                                    <div key={a.id} className="bg-slate-50 border border-slate-200 rounded p-2">
                                                        <div className="font-mono text-xs text-slate-700 break-words">{a.query}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {a.pmidsFound} found • {a.titlesReviewed} screened • {a.kept} kept
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </details>
                        </div>
                     )}

                     {discoverRunId && clarifyingQuestions.length > 0 && discoverKept.length === 0 && (
                        <div className="mt-6 border-t border-slate-200 pt-4 space-y-4">
                            <div className="text-sm font-semibold text-slate-800">Clarifying questions</div>
                            <div className="space-y-3">
                                {clarifyingQuestions.map((q) => (
                                    <div key={q.id}>
                                        <div className="text-sm text-slate-700 mb-1">{q.question}</div>
                                        <input
                                            type="text"
                                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                                            placeholder="Your answer (optional)"
                                            value={clarifyingAnswers[q.id] || ''}
                                            onChange={(e) => setClarifyingAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                            disabled={isSearching}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="secondary" onClick={() => runDiscoverSearch({ runId: discoverRunId })} disabled={isSearching}>
                                    Skip
                                </Button>
                                <Button onClick={handleDiscoverContinue} isLoading={isSearching}>
                                    <Search size={16} className="mr-2" /> Run Search
                                </Button>
                            </div>
                        </div>
                     )}
                 </div>

                 {searchResults.length > 0 && (
                     <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                            <span>Curated Results</span>
                            <span className="text-xs font-normal normal-case bg-slate-100 px-2 py-1 rounded">
                                {searchResults.length} articles found
                            </span>
                        </h4>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={handleDiscoverMore} disabled={!discoverRunId || isSearching}>
                                More like these
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleDiscoverRefine}
                                disabled={!discoverRunId || isSearching || Object.keys(feedbackByPmid).length === 0}
                            >
                                Refine with feedback
                            </Button>
                        </div>
                        {searchResults.map((result, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-blue-300 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <h5 className="font-bold text-slate-800 text-lg leading-tight flex-1 mr-4">
                                        {result.title}
                                    </h5>
                                    {result.url && (
                                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 p-1 flex-shrink-0">
                                            <ExternalLink size={16} />
                                        </a>
                                    )}
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600 mb-3">
                                    {result.relevance && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide">
                                            <Sparkles size={10} className="mr-1" />
                                            {result.relevance}
                                        </span>
                                    )}
                                    {result.articleType && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wide">
                                            <Tag size={10} className="mr-1" />
                                            {result.articleType}
                                        </span>
                                    )}
                                    {result.authors ? (
                                        <span>{formatAuthorsDisplay(result.authors)}</span>
                                    ) : (
                                        <span className="text-slate-400 italic">Fetching authors...</span>
                                    )}
                                    {result.year && <span>({result.year})</span>}
                                </div>
                                
                                {result.publication && (
                                    <div className="text-xs text-slate-500 mb-3 italic">
                                        {result.publication}
                                    </div>
                                )}

                                {result.abstract && (
                                    <div className="mb-4">
                                        <details className="text-sm text-slate-500">
                                            <summary className="cursor-pointer hover:text-blue-600 font-medium select-none">Show Abstract</summary>
                                            <p className="mt-2 p-3 bg-slate-50 rounded border border-slate-100 leading-relaxed text-slate-700">
                                                {result.abstract}
                                            </p>
                                        </details>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                                    <div className="flex gap-2">
                                        {result.pmid && (
                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded font-mono border border-slate-200">
                                                PMID: {result.pmid}
                                            </span>
                                        )}
                                        {result.doi && (
                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded font-mono border border-slate-200 hidden sm:inline-block">
                                                DOI: {result.doi}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {result.pmid && (
                                            <>
                                                <button
                                                    type="button"
                                                    className={`p-2 rounded border text-sm ${feedbackByPmid[result.pmid] === 'up' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                    onClick={() => toggleFeedback(result.pmid!, 'up')}
                                                    disabled={isSearching}
                                                    title="Thumbs up (more like this)"
                                                >
                                                    <ThumbsUp size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`p-2 rounded border text-sm ${feedbackByPmid[result.pmid] === 'down' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                    onClick={() => toggleFeedback(result.pmid!, 'down')}
                                                    disabled={isSearching}
                                                    title="Thumbs down (avoid this)"
                                                >
                                                    <ThumbsDown size={16} />
                                                </button>
                                            </>
                                        )}

                                        {project.references.some(r => result.pmid && r.notes?.includes(result.pmid)) ? (
                                            <span className="text-green-600 text-sm font-medium flex items-center px-2">
                                                Added
                                            </span>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={() => handleAddSearchResult(result, idx)}
                                                isLoading={addingSearchResult === idx}
                                                disabled={addingSearchResult !== null}
                                            >
                                                <Plus size={16} className="mr-1" /> Add to Library
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                     </div>
                 )}
                 
                 {!isSearching && searchResults.length === 0 && searchQuery && searchLogs.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                        Enter a query to find papers.
                    </div>
                 )}
             </div>
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
