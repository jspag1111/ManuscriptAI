
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, Reference, PaperSearchResult } from '../types';
import { summarizeReference, findRelevantPapers } from '../services/geminiService';
import { importReferenceMetadata } from '../services/referenceService';
import { generateId } from '../services/storageService';
import { getBibliographyOrder } from '../utils/citationUtils';
import { Button } from './Button';
import { BookOpen, Plus, Trash2, Sparkles, Copy, Download, Search, ChevronDown, ChevronRight, ListOrdered, Library, Globe, ExternalLink, Tag } from 'lucide-react';

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
     // Filter references that are used, and map them to the full object
     // We maintain the order found in text
     const usedRefs = order.map(id => project.references.find(r => r.id === id)).filter(Boolean) as Reference[];
     return usedRefs;
  }, [project.sections, project.references]);

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

  const handleSearch = async () => {
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      setSearchResults([]);
      setSearchLogs(["Initializing agent..."]);

      try {
          // Step 1: Gemini Search for PMIDs
          setSearchLogs(prev => [...prev, "Querying Gemini for relevant PubMed PMIDs..."]);
          const initialResults = await findRelevantPapers(searchQuery);

          if (initialResults.length === 0) {
              setSearchLogs(prev => [...prev, "No relevant PubMed articles found."]);
              setIsSearching(false);
              return;
          }

          setSearchLogs(prev => [...prev, `Identified ${initialResults.length} potential articles. Retrieving full metadata from NCBI...`]);
          
          // Initial set to show placeholders
          setSearchResults(initialResults.map(r => ({ ...r, url: `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` })));

          // Step 2: Fetch Metadata sequentially to show progress
          for (let i = 0; i < initialResults.length; i++) {
              // Add delay to respect API rate limits and prevent network congestion
              if (i > 0) await new Promise(resolve => setTimeout(resolve, 600));

              const item = initialResults[i];
              if (item.pmid) {
                    setSearchLogs(prev => [...prev, `Fetching metadata for PMID: ${item.pmid}...`]);
                    try {
                        const metadata = await importReferenceMetadata(item.pmid);
                        if (metadata) {
                            // Update the specific result in the state with real metadata
                            setSearchResults(prev => prev.map((res, idx) => {
                                if (idx === i) {
                                    return {
                                        ...res,
                                        title: metadata.title || res.title, // Use API title, fallback to AI title
                                        authors: metadata.authors,
                                        year: metadata.year,
                                        doi: metadata.doi,
                                        abstract: metadata.abstract,
                                        publication: metadata.publication,
                                        articleType: metadata.articleType,
                                        // Keep relevance from AI
                                    };
                                }
                                return res;
                            }));
                        } else {
                            setSearchLogs(prev => [...prev, `Metadata unavailable for PMID ${item.pmid}`]);
                        }
                    } catch (e) {
                        setSearchLogs(prev => [...prev, `Failed to fetch metadata for PMID ${item.pmid}`]);
                    }
              }
          }
          setSearchLogs(prev => [...prev, "Search and retrieval complete."]);

      } catch (e) {
          console.error(e);
          setSearchLogs(prev => [...prev, "Search failed due to an error."]);
          alert("Search failed. Please try again.");
      } finally {
          setIsSearching(false);
      }
  };

  const handleAddSearchResult = async (result: PaperSearchResult, index: number) => {
      setAddingSearchResult(index);
      try {
          // We likely already have the metadata from the search process, but let's be safe
          const refData: Partial<Reference> = {
              title: result.title,
              authors: result.authors || '',
              year: result.year || '',
              doi: result.doi || '',
              abstract: result.abstract || '',
              summary: result.relevance, // Use relevance as the initial summary
              notes: result.url ? `Source URL: ${result.url}\nPMID: ${result.pmid}` : '',
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
                    {ref.articleType && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
                                {ref.articleType}
                            </span>
                        </div>
                    )}
                 </div>
                 <div className="text-xs text-slate-500 shrink-0">
                    {ref.year}
                 </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                   <div className="pt-3 space-y-3">
                      <div className="text-sm text-slate-700">
                         <span className="font-semibold">Authors:</span> {ref.authors}
                      </div>
                      <div className="text-sm text-slate-700">
                         <span className="font-semibold">Journal:</span> {ref.publication}
                      </div>
                      {ref.doi && (
                         <div className="text-sm">
                             <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">DOI: {ref.doi}</a>
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
                        Search specifically for articles indexed in PubMed. Gemini will identify PMIDs, and we will fetch the official metadata.
                     </p>
                     <div className="flex flex-col gap-3">
                        <textarea
                            className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm h-24"
                            placeholder="e.g. Recent clinical trials for CAR-T therapy in solid tumors..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.ctrlKey && e.key === 'Enter' && handleSearch()}
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
                            <Button onClick={handleSearch} isLoading={isSearching} disabled={!searchQuery.trim()}>
                                <Search size={16} className="mr-2" /> Search PubMed
                            </Button>
                        </div>
                     </div>
                 </div>

                 {searchResults.length > 0 && (
                     <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                            <span>Search Results</span>
                            <span className="text-xs font-normal normal-case bg-slate-100 px-2 py-1 rounded">
                                {searchResults.length} articles found
                            </span>
                        </h4>
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
                                    {result.articleType && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wide">
                                            <Tag size={10} className="mr-1" />
                                            {result.articleType}
                                        </span>
                                    )}
                                    {result.authors ? (
                                        <span>{result.authors}</span>
                                    ) : (
                                        <span className="text-slate-400 italic">Fetching authors...</span>
                                    )}
                                    {result.year && <span>({result.year})</span>}
                                </div>
                                
                                <div className="bg-purple-50 p-3 rounded-md border border-purple-100 mb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Sparkles size={14} className="text-purple-600" />
                                        <span className="text-xs font-bold text-purple-700 uppercase">Relevance</span>
                                    </div>
                                    <p className="text-sm text-slate-800 leading-relaxed">
                                        {result.relevance}
                                    </p>
                                </div>

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
                                    
                                    {project.references.some(r => result.pmid && r.notes?.includes(result.pmid)) ? (
                                        <span className="text-green-600 text-sm font-medium flex items-center px-4 py-2">
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
