
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Section, Project } from '../types';
import { generateSectionDraft, refineTextSelection } from '../services/geminiService';
import { generateId } from '../services/storageService';
import { getBibliographyOrder } from '../utils/citationUtils';
import { Button } from './Button';
import { DiffViewer } from './DiffViewer';
import { RichEditor, RichEditorHandle } from './RichEditor';
import { Wand2, Save, History, RefreshCw, PenTool, Quote, X, Search, Sparkles, FileText, ToggleLeft, ToggleRight, BookOpen } from 'lucide-react';

interface SectionEditorProps {
  section: Section;
  project: Project;
  onUpdateSection: (s: Section) => void;
  onViewHistory: () => void;
}

export const SectionEditor: React.FC<SectionEditorProps> = ({ 
  section, 
  project, 
  onUpdateSection,
  onViewHistory 
}) => {
  const [content, setContent] = useState(section.content);
  const [notes, setNotes] = useState(section.userNotes);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  
  // Selection state for AI refine
  const [selectionData, setSelectionData] = useState<{range: any, text: string} | null>(null);
  
  const [showCitationModal, setShowCitationModal] = useState(false);
  const [citationSearch, setCitationSearch] = useState('');
  
  // Review Mode State
  const [isReviewing, setIsReviewing] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [reviewSource, setReviewSource] = useState<'Draft' | 'Refinement' | null>(null);

  // Popup state for in-text edits
  const [popupPosition, setPopupPosition] = useState<{ x: number, y: number } | null>(null);
  const [showRefineInput, setShowRefineInput] = useState(false);
  
  // Display toggle for citations
  const [showCitations, setShowCitations] = useState(false);
  
  const editorRef = useRef<RichEditorHandle>(null);

  // Computed bibliography order for formatting citations [1-3]
  // Memoized to prevent RichEditor re-renders that lose selection
  const bibliographyOrder = useMemo(() => getBibliographyOrder(project.sections), [project.sections]);

  // Sync internal state if section changes prop
  useEffect(() => {
    if (!isReviewing) {
        setContent(section.content);
        setNotes(section.userNotes);
        setSelectionData(null);
        setPopupPosition(null);
        setShowRefineInput(false);
        editorRef.current?.clearLock();
    }
  }, [section.id, section.content, section.userNotes]); 

  // Reset review state when switching sections
  useEffect(() => {
    setIsReviewing(false);
    setPendingContent(null);
    setReviewSource(null);
  }, [section.id]);

  // Auto-save effect 
  useEffect(() => {
    if (isReviewing) return;
    const timer = setTimeout(() => {
      if (content !== section.content || notes !== section.userNotes) {
        handleSave();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [content, notes, isReviewing]);

  const handleSave = () => {
    onUpdateSection({
      ...section,
      content,
      userNotes: notes,
      lastModified: Date.now()
    });
  };

  const handleDraft = async () => {
    setIsDrafting(true);
    handleSave();
    try {
      const draft = await generateSectionDraft(project, { ...section, userNotes: notes, content }, "Draft or improve the section based on the notes.");
      setPendingContent(draft);
      setReviewSource('Draft');
      setIsReviewing(true);
    } catch (e) {
      alert("Failed to draft content.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleAcceptChange = () => {
      if (pendingContent === null) return;
      
      const newVersions = [...section.versions];
      if (content.trim()) {
        newVersions.unshift({
          id: generateId(),
          timestamp: Date.now(),
          content: content,
          notes: notes,
          commitMessage: `Auto-save before AI ${reviewSource}`
        });
      }

      const newContent = pendingContent;
      
      setContent(newContent);
      onUpdateSection({
        ...section,
        content: newContent,
        versions: newVersions,
        lastModified: Date.now()
      });

      setIsReviewing(false);
      setPendingContent(null);
      setReviewSource(null);
  };

  const handleRejectChange = () => {
      setIsReviewing(false);
      setPendingContent(null);
      setReviewSource(null);
      editorRef.current?.clearLock();
  };

  const handleSelect = (range: any, text: string) => {
    // If showing input, ignore selection updates (input field is focused)
    if (showRefineInput) return;

    if (text) {
        setSelectionData({ range, text });
    } else {
        setSelectionData(null);
        setPopupPosition(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // If editing input, don't re-trigger or move popup
    if (showRefineInput) return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
       // Only show if inside editor
       const range = selection.getRangeAt(0);
       const rect = range.getBoundingClientRect();
       setPopupPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    } else {
       setPopupPosition(null);
       setShowRefineInput(false);
    }
  };

  const insertText = (text: string) => {
      if (editorRef.current) {
          editorRef.current.insertAtCursor(text);
      }
  };

  const handleStartRefine = () => {
      // Lock visual selection so it persists when focus moves to the input field
      const lockedText = editorRef.current?.lockSelection();
      
      // If lock was successful, show input. 
      // If lockedText is null, it means selection was lost, so we shouldn't show input.
      if (lockedText !== null) {
          setShowRefineInput(true);
      }
  };

  const handleCancelRefine = () => {
      setShowRefineInput(false);
      setPopupPosition(null);
      setSelectionData(null);
      setRefinePrompt('');
      editorRef.current?.clearLock();
  };

  const handleRefine = async () => {
    if (!selectionData || !refinePrompt) return;
    setIsRefining(true);
    try {
      const refined = await refineTextSelection(selectionData.text, refinePrompt, content);
      
      // Use RichEditor to replace the locked span and get full new content
      let newContent = content;
      if (editorRef.current) {
          newContent = editorRef.current.replaceLockedSelection(refined);
      } else {
          // Fallback
          newContent = content.replace(selectionData.text, refined);
      }

      setPendingContent(newContent);
      setReviewSource('Refinement');
      setIsReviewing(true);

      setRefinePrompt('');
      setSelectionData(null);
      setPopupPosition(null);
      setShowRefineInput(false);
    } catch (e) {
      alert("Failed to refine text.");
      handleCancelRefine();
    } finally {
      setIsRefining(false);
    }
  };

  const filteredReferences = project.references.filter(r => 
    r.title.toLowerCase().includes(citationSearch.toLowerCase()) || 
    r.authors.toLowerCase().includes(citationSearch.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200 relative">
      {/* Left Pane: Controls & Notes */}
      <div className="w-full lg:w-1/3 lg:min-w-[320px] min-w-0 flex flex-col bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold text-slate-800">{section.title}</h2>
          <p className="text-xs text-slate-500 mt-1">Last saved: {new Date(section.lastModified).toLocaleTimeString()}</p>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Section Goals & Notes
          </label>
          <textarea
            className="w-full h-36 sm:h-48 p-3 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="What should this section cover? List your methods, key points, or arguments here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isReviewing}
          />

          <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                 <h4 className="text-sm font-semibold text-blue-800 flex items-center">
                    <Wand2 size={16} className="mr-2" />
                    Gemini Drafter
                </h4>
            </div>

            <div className="flex items-center justify-between mb-4 bg-white p-2 rounded border border-blue-100">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5 cursor-pointer" onClick={() => onUpdateSection({...section, useReferences: !section.useReferences})}>
                    <BookOpen size={14} className={section.useReferences !== false ? "text-blue-500" : "text-slate-400"} /> 
                    Use References
                </label>
                <button
                    onClick={() => onUpdateSection({...section, useReferences: !section.useReferences})}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${section.useReferences !== false ? 'bg-blue-600' : 'bg-slate-300'}`}
                    disabled={isReviewing}
                    title="Toggle whether AI should cite references"
                >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${section.useReferences !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
            </div>

            <Button onClick={handleDraft} isLoading={isDrafting} disabled={isReviewing} className="w-full">
              {content.length > 0 ? 'Regenerate / Iterate Draft' : 'Generate First Draft'}
            </Button>
          </div>
          
          <div className="pt-2">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Actions</h4>
            <div className="space-y-2">
               <Button variant="secondary" size="sm" onClick={onViewHistory} disabled={isReviewing} className="w-full justify-start">
                  <History size={16} className="mr-2" />
                  View Version History ({section.versions.length})
               </Button>
               <Button variant="secondary" size="sm" onClick={handleSave} disabled={isReviewing} className="w-full justify-start">
                  <Save size={16} className="mr-2" />
                  Force Save
               </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Editor or Diff Viewer */}
      <div className="flex-1 flex flex-col relative bg-white min-h-0">
        {isReviewing && pendingContent !== null ? (
            <DiffViewer
                original={content}
                modified={pendingContent}
                onAccept={handleAcceptChange}
                onReject={handleRejectChange}
            />
        ) : (
            <>
                {/* Toolbar */}
                <div className="min-h-[3rem] border-b border-slate-200 flex items-center px-4 justify-between bg-slate-50 flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap text-left">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Manuscript Editor
                        </span>
                        <div className="h-4 w-px bg-slate-300"></div>
                        <button 
                            onClick={() => setShowCitations(!showCitations)}
                            className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors ${showCitations ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                            title={showCitations ? "Switch to raw editing" : "View formatted citations"}
                        >
                            {showCitations ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                            Format Citations
                        </button>
                    </div>
                    
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => {
                            setShowCitationModal(true);
                            setCitationSearch('');
                        }} 
                        title="Insert Citation"
                        className="flex items-center gap-1 text-slate-600"
                    >
                        <Quote size={14} />
                        <span className="text-xs">Insert Citation</span>
                    </Button>
                </div>

                {/* Rich Editor Component */}
                <div className="flex-1 overflow-hidden relative min-h-0">
                    <RichEditor
                        ref={editorRef}
                        className="h-full overflow-y-auto"
                        content={content}
                        bibliographyOrder={bibliographyOrder}
                        references={project.references}
                        onChange={setContent}
                        onSelect={handleSelect}
                        onMouseUp={handleMouseUp}
                        placeholder="Start writing..."
                        renderCitations={showCitations}
                    />
                </div>
                
                {/* Floating AI Edit Popup */}
                {popupPosition && selectionData && (
                    <div 
                        className="fixed z-50 bg-white shadow-xl border border-slate-200 rounded-lg p-1.5 animate-in fade-in zoom-in-95 duration-200 flex items-center gap-2"
                        style={{ left: popupPosition.x, top: popupPosition.y, transform: 'translate(-50%, -100%)' }}
                    >
                        {!showRefineInput ? (
                            <button 
                                onMouseDown={(e) => {
                                    // Prevent default to ensure focus doesn't leave editor immediately
                                    // allowing lockSelection to capture the current selection
                                    e.preventDefault(); 
                                    handleStartRefine();
                                }}
                                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                            >
                                <Sparkles size={16} className="text-blue-500" />
                                Edit with AI
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input 
                                    autoFocus
                                    className="text-sm border border-slate-300 rounded px-2 py-1.5 w-64 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Describe change..."
                                    value={refinePrompt}
                                    onChange={e => setRefinePrompt(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleRefine()}
                                />
                                <Button size="sm" onClick={handleRefine} isLoading={isRefining} disabled={!refinePrompt}>
                                    Go
                                </Button>
                                <button onClick={handleCancelRefine} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded">
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Stats */}
                <div className="h-8 border-t border-slate-200 flex items-center px-4 text-xs text-slate-400 bg-slate-50 justify-between">
                    <span>{content.split(/\s+/).filter(w => w.length > 0).length} words</span>
                    <span>Saved</span>
                </div>
            </>
        )}
      </div>

      {/* Citation Modal */}
      {showCitationModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[1px]" onClick={() => setShowCitationModal(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80%] flex flex-col border border-slate-200" onClick={e => e.stopPropagation()}>
                <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                        <Quote size={16} /> Insert Citation
                    </h3>
                    <button onClick={() => setShowCitationModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <div className="p-3 border-b border-slate-100">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                        <input 
                            autoFocus
                            type="text" 
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Search references..."
                            value={citationSearch}
                            onChange={e => setCitationSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="p-2 overflow-y-auto flex-1 space-y-1">
                    {filteredReferences.map((ref) => (
                        <button 
                            key={ref.id}
                            className="w-full text-left p-3 hover:bg-blue-50 rounded-md border border-transparent hover:border-blue-200 transition-all group"
                            onClick={() => {
                                // Insert text at cursor using Ref
                                insertText(` [[ref:${ref.id}]]`);
                                setShowCitationModal(false);
                            }}
                        >
                            <div>
                                <span className="font-medium text-slate-800 text-sm block">{ref.title}</span>
                                <span className="text-xs text-slate-500 block mt-0.5">
                                    {ref.authors} ({ref.year})
                                </span>
                            </div>
                        </button>
                    ))}
                    {project.references.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            No references found. Add them in the Reference Manager first.
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};