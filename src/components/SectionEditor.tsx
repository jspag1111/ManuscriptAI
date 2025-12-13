import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Eye, EyeOff, FileText, History, Quote, Save, Search, Sparkles, ToggleLeft, ToggleRight, Wand2, X } from 'lucide-react';
import { AttributedDiffViewer } from './AttributedDiffViewer';
import { Button } from './Button';
import { DiffViewer } from './DiffViewer';
import { RichEditor, RichEditorHandle } from './RichEditor';
import { generateSectionDraft, refineTextSelection } from '@/services/geminiService';
import { generateId } from '@/services/storageService';
import { Project, Section, SectionVersion } from '@/types';
import { getBibliographyOrder } from '@/utils/citationUtils';
import { calculateTextStats } from '@/utils/textStats';

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
  const [selectionData, setSelectionData] = useState<{ range: any, text: string } | null>(null);

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
  const [showWorkingDiff, setShowWorkingDiff] = useState(false);
  const [showGenerator, setShowGenerator] = useState(() => (section.content ?? '').trim().length === 0);

  const editorRef = useRef<RichEditorHandle>(null);

  // Computed bibliography order for formatting citations [1-3]
  // Memoized to prevent RichEditor re-renders that lose selection
  const bibliographyOrder = useMemo(() => getBibliographyOrder(project.sections), [project.sections]);
  const contentStats = useMemo(() => calculateTextStats(content), [content]);
  const workingBase = section.currentVersionBase !== undefined ? section.currentVersionBase : section.content;
  const versionStartedAt = section.currentVersionStartedAt || section.lastModified;
  const workingDiffSubtitle = versionStartedAt ? `Since ${new Date(versionStartedAt).toLocaleString()}` : undefined;

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
  }, [section.id, section.content, section.userNotes, isReviewing]);

  useEffect(() => {
    if (section.currentVersionBase === undefined || !section.currentVersionId || !section.currentVersionStartedAt) {
      onUpdateSection({
        ...section,
        currentVersionId: section.currentVersionId || generateId(),
        currentVersionBase: section.currentVersionBase !== undefined ? section.currentVersionBase : section.content,
        currentVersionStartedAt: section.currentVersionStartedAt || Date.now(),
        lastLlmContent: section.lastLlmContent ?? null
      });
    }
  }, [section, onUpdateSection]);

  // Reset review state when switching sections
  useEffect(() => {
    setIsReviewing(false);
    setPendingContent(null);
    setReviewSource(null);
    setShowWorkingDiff(false);
    setShowGenerator((section.content ?? '').trim().length === 0);
    // Intentionally only reset when switching sections
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  useEffect(() => {
    if (showWorkingDiff) {
      setPopupPosition(null);
      setShowRefineInput(false);
      editorRef.current?.clearLock();
    }
  }, [showWorkingDiff]);

  const handleSave = useCallback(() => {
    const ensureVersionBase = section.currentVersionBase !== undefined ? section.currentVersionBase : content;
    const ensureVersionId = section.currentVersionId || section.id || generateId();
    const ensureStartedAt = section.currentVersionStartedAt || section.lastModified || Date.now();
    onUpdateSection({
      ...section,
      content,
      userNotes: notes,
      lastModified: Date.now(),
      currentVersionBase: ensureVersionBase,
      currentVersionId: ensureVersionId,
      currentVersionStartedAt: ensureStartedAt,
      lastLlmContent: section.lastLlmContent ?? null
    });
  }, [content, notes, onUpdateSection, section]);

  // Auto-save effect 
  useEffect(() => {
    if (isReviewing) return;
    const timer = setTimeout(() => {
      if (content !== section.content || notes !== section.userNotes) {
        handleSave();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [content, notes, isReviewing, section.content, section.userNotes, handleSave]);

  const handleDraft = async () => {
    setShowWorkingDiff(false);
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
        commitMessage: `Auto-save before AI ${reviewSource}`,
        source: section.lastLlmContent && section.lastLlmContent === content ? 'LLM' : 'USER'
      });
    }

    const newContent = pendingContent;

    setContent(newContent);
    onUpdateSection({
      ...section,
      content: newContent,
      versions: newVersions,
      lastModified: Date.now(),
      currentVersionBase: section.currentVersionBase !== undefined ? section.currentVersionBase : content,
      currentVersionId: section.currentVersionId || section.id || generateId(),
      currentVersionStartedAt: section.currentVersionStartedAt || Date.now(),
      lastLlmContent: newContent
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

  const handleStartNewVersion = () => {
    const hasSnapshotContent = content.trim().length > 0 || notes.trim().length > 0;
    const snapshotVersion: SectionVersion = {
      id: generateId(),
      timestamp: Date.now(),
      content,
      notes,
      commitMessage: 'Saved before starting new version',
      source: section.lastLlmContent && section.lastLlmContent === content ? 'LLM' : 'USER'
    };

    const updatedVersions: SectionVersion[] = hasSnapshotContent ? [snapshotVersion, ...section.versions] : [...section.versions];

    const nextSection: Section = {
      ...section,
      content,
      userNotes: notes,
      versions: updatedVersions,
      currentVersionBase: content,
      currentVersionStartedAt: Date.now(),
      currentVersionId: generateId(),
      lastLlmContent: null,
      lastModified: Date.now()
    };

    setShowWorkingDiff(false);
    setIsReviewing(false);
    setPendingContent(null);
    setReviewSource(null);
    onUpdateSection(nextSection);
  };

  const filteredReferences = project.references.filter(r =>
    r.title.toLowerCase().includes(citationSearch.toLowerCase()) ||
    r.authors.toLowerCase().includes(citationSearch.toLowerCase())
  );

  return (
    <div className="relative flex flex-col gap-4 lg:flex-row h-full">
      {/* Left Pane: Controls & Notes */}
      <div className="w-full lg:w-[360px] flex-shrink-0 space-y-4">


        <div className="bg-white/90 border border-slate-200 rounded-2xl shadow-sm p-4 space-y-4">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h2 className="text-xl font-semibold text-slate-900 truncate" title={section.title}>{section.title}</h2>
            <p className="text-xs text-slate-500 mt-1">Last saved: {new Date(section.lastModified).toLocaleTimeString()}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">Section Goals & Notes</label>
            <textarea
              className="w-full min-h-[160px] p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-inner resize-none"
              placeholder="What should this section cover? List your methods, key points, or arguments here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isReviewing}
            />
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 shadow-sm">
            <button
              type="button"
              onClick={() => setShowGenerator(!showGenerator)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white text-blue-600 border border-blue-100 flex items-center justify-center shadow">
                  <Wand2 size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Gemini Drafter</p>
                  <p className="text-xs text-blue-800/80">Summon AI only when you need it</p>
                </div>
              </div>
              <ChevronDown size={18} className={`text-blue-700 transition-transform ${showGenerator ? 'rotate-180' : ''}`} />
            </button>

            {showGenerator && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-blue-100">
                  <label
                    className="text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                    onClick={() => onUpdateSection({ ...section, useReferences: !section.useReferences })}
                  >
                    <BookOpen size={14} className={section.useReferences !== false ? 'text-blue-500' : 'text-slate-400'} />
                    Use References
                  </label>
                  <button
                    onClick={() => onUpdateSection({ ...section, useReferences: !section.useReferences })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${section.useReferences !== false ? 'bg-blue-600' : 'bg-slate-300'}`}
                    disabled={isReviewing}
                    title="Toggle whether AI should cite references"
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${section.useReferences !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <Button onClick={handleDraft} isLoading={isDrafting} disabled={isReviewing} className="w-full shadow">
                  {content.length > 0 ? 'Regenerate / Iterate Draft' : 'Generate First Draft'}
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">Actions</h4>
            <Button variant="secondary" size="sm" onClick={onViewHistory} disabled={isReviewing} className="w-full justify-start">
              <History size={16} className="mr-2" />
              View Version History ({section.versions.length})
            </Button>
            <Button variant="secondary" size="sm" onClick={handleStartNewVersion} disabled={isReviewing} className="w-full justify-start">
              <FileText size={16} className="mr-2" />
              Start New Version
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={isReviewing} className="w-full justify-start">
              <Save size={16} className="mr-2" />
              Force Save
            </Button>
          </div>
        </div>
      </div>

      {/* Right Pane: Editor or Diff Viewer */}
      <div className="flex-1 min-h-[60vh] flex flex-col relative bg-white/90 border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isReviewing && pendingContent !== null ? (
          <DiffViewer
            original={content}
            modified={pendingContent}
            onAccept={handleAcceptChange}
            onReject={handleRejectChange}
          />
        ) : showWorkingDiff ? (
          <AttributedDiffViewer
            base={workingBase}
            target={content}
            title="Working Draft Diff"
            subtitle={workingDiffSubtitle}
            onClose={() => setShowWorkingDiff(false)}
            closeLabel="Hide Diff"
          />
        ) : (
          <>
            {/* Toolbar */}
            <div className="h-12 border-b border-slate-200 flex items-center px-4 gap-3 bg-slate-50">
              <div className="flex items-center gap-2 flex-1 overflow-hidden">
                <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-full px-2 py-1 truncate">
                  {section.title}
                </span>
                <div className="h-4 w-px bg-slate-300"></div>
                <button
                  onClick={() => setShowCitations(!showCitations)}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors ${showCitations ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                  title={showCitations ? 'Switch to raw editing' : 'View formatted citations'}
                >
                  {showCitations ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  Format Citations
                </button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setShowCitationModal(true);
                    setCitationSearch('');
                  }}
                  title="Insert Citation"
                  className="flex items-center gap-1 text-slate-600 h-8"
                >
                  <Quote size={14} />
                  <span className="text-xs">Insert Citation</span>
                </Button>
              </div>

              <button
                onClick={() => setShowWorkingDiff(!showWorkingDiff)}
                disabled={isReviewing}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors border ${showWorkingDiff ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                title="Toggle working draft diff"
              >
                {showWorkingDiff ? <EyeOff size={18} /> : <Eye size={18} />}
                {showWorkingDiff ? 'Hide Diff' : 'Show Diff'}
              </button>
            </div>

            {/* Rich Editor Component */}
            <div className="flex-1 overflow-hidden relative">
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
            <div className="h-12 border-t border-slate-200 flex items-center px-4 text-[11px] text-slate-500 bg-slate-50 justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <span><span className="font-semibold text-slate-700">{contentStats.words}</span> words</span>
                <span><span className="font-semibold text-slate-700">{contentStats.charsWithSpaces}</span> chars (with spaces)</span>
                <span><span className="font-semibold text-slate-700">{contentStats.charsWithoutSpaces}</span> chars (no spaces)</span>
              </div>
              <span className="text-slate-600 font-medium">Saved</span>
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
