import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bot, ChevronDown, Eye, EyeOff, FileText, History, MessageSquareText, PanelLeft, Quote, Save, Search, ToggleLeft, ToggleRight, Wand2, X } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { AiReviewOverlay } from './AiReviewOverlay';
import { ChangePanel } from './ChangePanel';
import { CommentPanel, type CommentPanelFilter } from './CommentPanel';
import { Button } from './Button';
import { ProseMirrorEditor, ProseMirrorEditorHandle } from './ProseMirrorEditor';
import { generateSectionDraft, refineTextSelection } from '@/services/geminiService';
import { generateId } from '@/services/storageService';
import { buildReplaceAllAiReview, buildReplaceSelectionAiReview } from '@/lib/prosemirror/aiReview';
import { ChangeActor, Project, Section, SectionChangeEvent, SectionCommentAuthor, SectionCommentMessage, SectionCommentThread, SectionVersion } from '@/types';
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
  const [isAddressingComment, setIsAddressingComment] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');

  // Selection state for AI refine
  const [selectionData, setSelectionData] = useState<{ range: { start: number; end: number } | null; text: string } | null>(null);

  const [showCitationModal, setShowCitationModal] = useState(false);
  const [citationSearch, setCitationSearch] = useState('');

  type AiReviewState =
    | { kind: 'Draft'; baseContent: string; actor: ChangeActor; event: SectionChangeEvent; previewContent: string }
    | { kind: 'Refinement'; baseContent: string; actor: ChangeActor; event: SectionChangeEvent; previewContent: string; replacementText: string }
    | { kind: 'CommentAddress'; commentId: string; baseContent: string; actor: ChangeActor; event: SectionChangeEvent; previewContent: string; replacementText: string };
  const [aiReview, setAiReview] = useState<AiReviewState | null>(null);
  const isReviewing = aiReview !== null;

  // Popup state for in-text actions
  const [popupPosition, setPopupPosition] = useState<{ x: number, y: number } | null>(null);
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');

  // Display toggle for citations
  const [showCitations, setShowCitations] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showGenerator, setShowGenerator] = useState(() => (section.content ?? '').trim().length === 0);
  const [showDetails, setShowDetails] = useState(true);
  const [focusedChangeEventId, setFocusedChangeEventId] = useState<string | null>(null);

  const editorRef = useRef<ProseMirrorEditorHandle>(null);
  const { user } = useUser();
  const [changeEvents, setChangeEvents] = useState(section.changeEvents ?? []);
  const [commentThreads, setCommentThreads] = useState<SectionCommentThread[]>(section.commentThreads ?? []);
  const commentThreadsRef = useRef<SectionCommentThread[]>(section.commentThreads ?? []);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [commentFilter, setCommentFilter] = useState<CommentPanelFilter>('OPEN');
  const [selectedCommentThreadId, setSelectedCommentThreadId] = useState<string | null>(null);

  const setCommentThreadsSynced = useCallback((nextThreads: SectionCommentThread[]) => {
    commentThreadsRef.current = nextThreads;
    setCommentThreads(nextThreads);
  }, []);

  // Computed bibliography order for formatting citations [1-3]
  // Memoized to avoid churn in the editor nodeViews
  const bibliographyOrder = useMemo(() => getBibliographyOrder(project.sections), [project.sections]);
  const contentStats = useMemo(() => calculateTextStats(content), [content]);
  const workingBase = section.currentVersionBase !== undefined ? section.currentVersionBase : section.content;

  const currentCommentAuthor = useMemo<SectionCommentAuthor>(
    () => ({
      userId: user?.id || 'unknown',
      name: user?.fullName || user?.primaryEmailAddress?.emailAddress || null,
    }),
    [user?.id, user?.fullName, user?.primaryEmailAddress?.emailAddress]
  );

  const openCommentCount = useMemo(
    () => (commentThreads ?? []).filter((t) => t.status !== 'RESOLVED').length,
    [commentThreads]
  );

  const selectedCommentThread = useMemo(
    () => (selectedCommentThreadId ? (commentThreads ?? []).find((t) => t.id === selectedCommentThreadId) ?? null : null),
    [commentThreads, selectedCommentThreadId]
  );

  const activeCommentId = selectedCommentThread && selectedCommentThread.status !== 'RESOLVED' ? selectedCommentThread.id : null;

  // Sync internal state if section changes prop
  useEffect(() => {
    if (!isReviewing) {
      setContent(section.content);
      setNotes(section.userNotes);
      setChangeEvents(section.changeEvents ?? []);
      setSelectionData(null);
      setPopupPosition(null);
      setShowRefineInput(false);
      setShowCommentInput(false);
      setCommentDraft('');
      editorRef.current?.clearLock();
    }
  }, [isReviewing, section.changeEvents, section.content, section.id, section.userNotes]);

  useEffect(() => {
    if (isReviewing) return;
    setCommentThreadsSynced(section.commentThreads ?? []);
  }, [isReviewing, section.commentThreads, section.id, setCommentThreadsSynced]);

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
    setAiReview(null);
    setShowHighlights(false);
    setSelectedCommentThreadId(null);
    setShowGenerator((section.content ?? '').trim().length === 0);
    // Intentionally only reset when switching sections
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  useEffect(() => {
    if (!showHighlights) return;
    // When highlights are on, keep the UI focused on reviewability.
    setPopupPosition(null);
    setShowRefineInput(false);
    setShowCommentInput(false);
    setCommentDraft('');
    editorRef.current?.clearLock();
  }, [showHighlights]);

  useEffect(() => {
    if (showHighlights) return;
    setFocusedChangeEventId(null);
    editorRef.current?.focusChangeEvent(null);
  }, [showHighlights]);

  const handleSelectChangeEvent = useCallback((event: SectionChangeEvent) => {
    const selection = event.selection ?? null;
    setFocusedChangeEventId((current) => {
      const next = current === event.id ? null : event.id;
      editorRef.current?.focusChangeEvent(next, next ? selection : null);
      return next;
    });
  }, []);

  const handleSave = useCallback((overrides?: { commentThreads?: SectionCommentThread[]; changeEvents?: SectionChangeEvent[] }) => {
    const ensureVersionBase = section.currentVersionBase !== undefined ? section.currentVersionBase : content;
    const ensureVersionId = section.currentVersionId || section.id || generateId();
    const ensureStartedAt = section.currentVersionStartedAt || section.lastModified || Date.now();
    const nextChangeEvents = overrides?.changeEvents ?? changeEvents;
    const nextCommentThreads = overrides?.commentThreads ?? commentThreads;
    onUpdateSection({
      ...section,
      content,
      userNotes: notes,
      changeEvents: nextChangeEvents,
      commentThreads: nextCommentThreads,
      lastModified: Date.now(),
      currentVersionBase: ensureVersionBase,
      currentVersionId: ensureVersionId,
      currentVersionStartedAt: ensureStartedAt,
      lastLlmContent: section.lastLlmContent ?? null
    });
  }, [changeEvents, commentThreads, content, notes, onUpdateSection, section]);

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
    setIsDrafting(true);
    handleSave();
    try {
      const draftInstruction = 'Draft or improve the section based on the notes.';
      const { text, model } = await generateSectionDraft(
        project,
        { ...section, userNotes: notes, content },
        draftInstruction
      );
      const actor: ChangeActor = { type: 'LLM', model };
      const { previewContent, event } = buildReplaceAllAiReview({
        baseContent: content,
        nextContent: text,
        actor,
        request: `Gemini Drafter\nInstruction: ${draftInstruction}\n\nNotes:\n${notes ?? ''}`.trim(),
      });
      setAiReview({ kind: 'Draft', baseContent: content, actor, event, previewContent });
    } catch (e) {
      alert("Failed to draft content.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleAcceptChange = () => {
    if (!aiReview) return;

    const cloneCommentThreads = (threads: SectionCommentThread[]) =>
      (threads ?? []).map((thread) => ({
        ...thread,
        createdBy: { ...thread.createdBy },
        resolvedBy: thread.resolvedBy ? { ...thread.resolvedBy } : null,
        anchor: thread.anchor ? { ...thread.anchor } : null,
        messages: (thread.messages ?? []).map((msg) => ({
          ...msg,
          author: { ...msg.author },
        })),
        aiEdits: (thread.aiEdits ?? []).map((edit) => ({ ...edit })),
      }));

    const snapshotCommentThreads = cloneCommentThreads(commentThreadsRef.current ?? []);

    const newVersions = [...section.versions];
    if (content.trim()) {
      newVersions.unshift({
        id: generateId(),
        timestamp: Date.now(),
        content: content,
        notes: notes,
        commitMessage: `Auto-save before AI ${aiReview.kind}`,
        source: section.lastLlmContent && section.lastLlmContent === content ? 'LLM' : 'USER',
        baseContent: section.currentVersionBase !== undefined ? section.currentVersionBase : content,
        changeEvents: Array.isArray(changeEvents) ? [...changeEvents] : [],
        commentThreads: snapshotCommentThreads,
        versionStartedAt: section.currentVersionStartedAt || section.lastModified || Date.now(),
      });
    }

    const nextContent = aiReview.previewContent;
    const nextChangeEvents = changeEvents.some((evt) => evt.id === aiReview.event.id)
      ? changeEvents
      : [aiReview.event, ...changeEvents];
    if (aiReview.kind === 'Draft') {
      editorRef.current?.applyContentReplacement(nextContent, aiReview.actor, aiReview.event);
    } else {
      editorRef.current?.applyLockedSelectionReplacement(aiReview.replacementText, aiReview.actor, aiReview.event);
    }

    let nextCommentThreads = commentThreadsRef.current ?? [];
    if (aiReview.kind === 'CommentAddress') {
      const now = Date.now();
      nextCommentThreads = nextCommentThreads.map((thread) => {
        if (thread.id !== aiReview.commentId) return thread;
        const aiEdits = [
          ...(thread.aiEdits ?? []),
          {
            id: generateId(),
            createdAt: now,
            model: aiReview.actor.type === 'LLM' ? aiReview.actor.model : 'unknown',
            changeEventId: aiReview.event.id,
          },
        ];
        return {
          ...thread,
          updatedAt: now,
          aiEdits,
        };
      });
      setCommentThreadsSynced(nextCommentThreads);
    }

    onUpdateSection({
      ...section,
      content: nextContent,
      versions: newVersions,
      lastModified: Date.now(),
      currentVersionBase: section.currentVersionBase !== undefined ? section.currentVersionBase : content,
      currentVersionId: section.currentVersionId || section.id || generateId(),
      currentVersionStartedAt: section.currentVersionStartedAt || Date.now(),
      lastLlmContent: nextContent,
      changeEvents: nextChangeEvents,
      commentThreads: nextCommentThreads,
    });

    setAiReview(null);
    setRefinePrompt('');
    setSelectionData(null);
    setPopupPosition(null);
    setShowRefineInput(false);
    setShowCommentInput(false);
    setCommentDraft('');
  };

  const handleRejectChange = () => {
    setAiReview(null);
    setShowCommentInput(false);
    setCommentDraft('');
    editorRef.current?.clearLock();
  };

  const handleSelect = (range: { start: number; end: number } | null, text: string) => {
    // If showing input, ignore selection updates (input field is focused)
    if (showRefineInput || showCommentInput) return;

    if (text) {
      setSelectionData({ range, text });
    } else {
      setSelectionData(null);
      setPopupPosition(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // If editing input, don't re-trigger or move popup
    if (showRefineInput || showCommentInput) return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      // Only show if inside editor
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPopupPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    } else {
      setPopupPosition(null);
      setShowRefineInput(false);
      setShowCommentInput(false);
      setCommentDraft('');
    }
  };

  const insertCitation = (id: string) => {
    editorRef.current?.insertCitation([id]);
  };

  const handleStartRefine = () => {
    // Lock visual selection so it persists when focus moves to the input field
    const lockedText = editorRef.current?.lockSelection();

    // If lock was successful, show input. 
    // If lockedText is null, it means selection was lost, so we shouldn't show input.
    if (lockedText !== null) {
      setShowRefineInput(true);
      setShowCommentInput(false);
      setCommentDraft('');
    }
  };

  const handleCancelRefine = () => {
    setShowRefineInput(false);
    setPopupPosition(null);
    setSelectionData(null);
    setRefinePrompt('');
    editorRef.current?.clearLock();
  };

  const handleStartComment = () => {
    const lockedText = editorRef.current?.lockSelection();
    if (lockedText !== null) {
      setShowCommentInput(true);
      setShowRefineInput(false);
      setRefinePrompt('');
    }
  };

  const handleCancelComment = () => {
    setShowCommentInput(false);
    setCommentDraft('');
    setPopupPosition(null);
    setSelectionData(null);
    editorRef.current?.clearLock();
  };

  const handleAddComment = () => {
    const draft = commentDraft.trim();
    const range = selectionData?.range;
    if (!draft || !range) return;

    const now = Date.now();
    const anchorText = selectionData?.text ?? '';
    const excerpt = anchorText.replace(/\s+/g, ' ').trim().slice(0, 160);
    const message: SectionCommentMessage = {
      id: generateId(),
      createdAt: now,
      author: currentCommentAuthor,
      content: draft,
    };
    const thread: SectionCommentThread = {
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      createdBy: currentCommentAuthor,
      anchor: {
        from: range.start,
        to: range.end,
        text: anchorText,
        orphaned: false,
      },
      excerpt,
      messages: [message],
      status: 'OPEN',
      resolvedAt: null,
      resolvedBy: null,
      aiEdits: [],
    };

    const nextThreads = [thread, ...(commentThreads ?? [])];
    setCommentThreadsSynced(nextThreads);
    setSelectedCommentThreadId(thread.id);
    setShowCommentsPanel(true);
    handleSave({ commentThreads: nextThreads });

    setShowCommentInput(false);
    setCommentDraft('');
    setPopupPosition(null);
    setSelectionData(null);
    editorRef.current?.scrollToRange({ from: range.start, to: range.end });
  };

  const handleRefine = async () => {
    if (!selectionData || !refinePrompt) return;
    setIsRefining(true);
    try {
      const { text, model } = await refineTextSelection(selectionData.text, refinePrompt, content);
      const range = selectionData.range;
      if (!range) {
        throw new Error('Selection range missing for refinement.');
      }

      const actor: ChangeActor = { type: 'LLM', model };
      const { previewContent, event } = buildReplaceSelectionAiReview({
        baseContent: content,
        from: range.start,
        to: range.end,
        replacementText: text,
        actor,
        request: refinePrompt,
      });

      setAiReview({
        kind: 'Refinement',
        baseContent: content,
        actor,
        event,
        previewContent,
        replacementText: text,
      });

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
      source: section.lastLlmContent && section.lastLlmContent === content ? 'LLM' : 'USER',
      baseContent: section.currentVersionBase !== undefined ? section.currentVersionBase : content,
      changeEvents: Array.isArray(changeEvents) ? [...changeEvents] : [],
      commentThreads: (commentThreadsRef.current ?? []).map((thread) => ({
        ...thread,
        createdBy: { ...thread.createdBy },
        resolvedBy: thread.resolvedBy ? { ...thread.resolvedBy } : null,
        anchor: thread.anchor ? { ...thread.anchor } : null,
        messages: (thread.messages ?? []).map((msg) => ({ ...msg, author: { ...msg.author } })),
        aiEdits: (thread.aiEdits ?? []).map((edit) => ({ ...edit })),
      })),
      versionStartedAt: section.currentVersionStartedAt || section.lastModified || Date.now(),
    };

    const updatedVersions: SectionVersion[] = hasSnapshotContent ? [snapshotVersion, ...section.versions] : [...section.versions];

    const nextSection: Section = {
      ...section,
      content,
      userNotes: notes,
      commentThreads: commentThreadsRef.current ?? [],
      versions: updatedVersions,
      currentVersionBase: content,
      currentVersionStartedAt: Date.now(),
      currentVersionId: generateId(),
      lastLlmContent: null,
      changeEvents: [],
      lastModified: Date.now()
    };

    setChangeEvents([]);
    setShowHighlights(false);
    setAiReview(null);
    onUpdateSection(nextSection);
  };

  const handleSelectCommentThread = useCallback(
    (threadId: string | null) => {
      setPopupPosition(null);
      setShowRefineInput(false);
      setShowCommentInput(false);
      setRefinePrompt('');
      setCommentDraft('');
      setSelectedCommentThreadId(threadId);
      if (!threadId) {
        return;
      }
      const thread = (commentThreads ?? []).find((t) => t.id === threadId) ?? null;
      const anchor = thread?.anchor;
      if (!anchor || anchor.orphaned) return;
      editorRef.current?.scrollToRange({ from: anchor.from, to: anchor.to });
    },
    [commentThreads]
  );

  const handleReplyToComment = useCallback(
    (threadId: string, text: string) => {
      const now = Date.now();
      const reply: SectionCommentMessage = {
        id: generateId(),
        createdAt: now,
        author: currentCommentAuthor,
        content: text,
      };
      const nextThreads = (commentThreads ?? []).map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              updatedAt: now,
              messages: [...(thread.messages ?? []), reply],
            }
          : thread
      );
      setCommentThreadsSynced(nextThreads);
      handleSave({ commentThreads: nextThreads });
    },
    [commentThreads, currentCommentAuthor, handleSave, setCommentThreadsSynced]
  );

  const handleResolveComment = useCallback(
    (threadId: string) => {
      const now = Date.now();
      const nextThreads = (commentThreads ?? []).map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              status: 'RESOLVED' as const,
              updatedAt: now,
              resolvedAt: now,
              resolvedBy: currentCommentAuthor,
            }
          : thread
      );
      setCommentThreadsSynced(nextThreads);
      handleSave({ commentThreads: nextThreads });
    },
    [commentThreads, currentCommentAuthor, handleSave, setCommentThreadsSynced]
  );

  const handleReopenComment = useCallback(
    (threadId: string) => {
      const now = Date.now();
      const nextThreads = (commentThreads ?? []).map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              status: 'OPEN' as const,
              updatedAt: now,
              resolvedAt: null,
              resolvedBy: null,
            }
          : thread
      );
      setCommentThreadsSynced(nextThreads);
      handleSave({ commentThreads: nextThreads });
    },
    [commentThreads, handleSave, setCommentThreadsSynced]
  );

  const handleCloseCommentsPanel = useCallback(() => {
    setShowCommentsPanel(false);
    setSelectedCommentThreadId(null);
  }, []);

  const handleAddressCommentWithAi = useCallback(
    async (threadId: string) => {
      if (isReviewing || isAddressingComment) return;
      const thread = (commentThreadsRef.current ?? []).find((t) => t.id === threadId) ?? null;
      if (!thread) return;
      if (thread.status === 'RESOLVED') return;

      const anchor = thread.anchor;
      if (!anchor || anchor.orphaned) {
        alert('This comment is no longer anchored to a valid text range. Try adding a new comment on the updated text.');
        return;
      }

      setIsAddressingComment(true);
      try {
        setPopupPosition(null);
        setShowRefineInput(false);
        setShowCommentInput(false);
        setRefinePrompt('');
        setCommentDraft('');
        setShowCommentsPanel(true);
        setSelectedCommentThreadId(threadId);

        editorRef.current?.scrollToRange({ from: anchor.from, to: anchor.to });

        const selectedText = editorRef.current?.getTextInRange({ from: anchor.from, to: anchor.to }) || anchor.text;
        if (!selectedText.trim()) {
          alert('Unable to read the selected text for this comment. Try re-selecting the text and re-adding the comment.');
          return;
        }

        const threadTranscript = (thread.messages ?? [])
          .map((msg) => {
            const name = msg.author.name?.trim() || msg.author.userId || 'User';
            return `${name}: ${msg.content}`;
          })
          .join('\n');

        const instruction = [
          'Address the following comment thread by revising ONLY the selected text.',
          'Keep the writing academic and preserve any citation markers like [[ref:ID]].',
          'If the comment requests clarification, prefer adding a brief clarifying sentence rather than rewriting everything.',
          '',
          'Comment thread:',
          threadTranscript || '(no messages)',
        ].join('\n');

        const { text, model } = await refineTextSelection(selectedText, instruction, content);
        const actor: ChangeActor = { type: 'LLM', model };

        const { previewContent, event } = buildReplaceSelectionAiReview({
          baseContent: content,
          from: anchor.from,
          to: anchor.to,
          replacementText: text,
          actor,
          commentId: threadId,
          request: `Comment AI • Thread ${threadId}\n\n${instruction}`,
        });

        setAiReview({
          kind: 'CommentAddress',
          commentId: threadId,
          baseContent: content,
          actor,
          event,
          previewContent,
          replacementText: text,
        });
      } catch (e) {
        console.error('Failed to address comment with AI', e);
        alert('Failed to address comment with AI.');
      } finally {
        setIsAddressingComment(false);
      }
    },
    [content, isAddressingComment, isReviewing]
  );

  const filteredReferences = project.references.filter(r =>
    r.title.toLowerCase().includes(citationSearch.toLowerCase()) ||
    r.authors.toLowerCase().includes(citationSearch.toLowerCase())
  );

  return (
    <div className="relative flex flex-col gap-4 lg:flex-row h-full">
      {/* Left Pane: Controls & Notes */}
      {showDetails && (
        <div className="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-4 transition-all duration-300">

          <div className="bg-white/90 border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 space-y-4 flex-1 flex flex-col">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-semibold text-slate-900 truncate" title={section.title}>{section.title}</h2>
                <p className="text-xs text-slate-500 mt-1">Last saved: {new Date(section.lastModified).toLocaleTimeString()}</p>
              </div>

              <div className="flex-1 flex flex-col min-h-[160px]">
                <label className="block text-sm font-semibold text-slate-800 mb-2">Section Goals & Notes</label>
                <textarea
                  className="w-full flex-1 p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-inner resize-none"
                  placeholder="What should this section cover? List your methods, key points, or arguments here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isReviewing}
                />
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 shadow-sm mt-auto">
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
            </div>
          </div>
        </div>
      )}

      {/* Right Pane: Editor */}
      <div className="flex-1 min-h-[60vh] flex flex-col relative bg-white/90 border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <>
          {/* Toolbar */}
          <div className="h-12 border-b border-slate-200 flex items-center px-4 gap-3 bg-slate-50 justify-between">
              <div className="flex items-center gap-2 flex-1 overflow-hidden">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className={`p-1.5 rounded transition-colors ${showDetails ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                  title={showDetails ? "Hide Sidebar" : "Show Sidebar"}
                >
                  <PanelLeft size={20} />
                </button>
                <div className="h-4 w-px bg-slate-300"></div>
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

              <div className="flex items-center gap-2">
                {/* Actions moved to toolbar */}
                <div className="flex items-center gap-1 border-r border-slate-300 pr-2 mr-1">
                  <button onClick={onViewHistory} disabled={isReviewing} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title={`View Version History (${section.versions.length})`}>
                    <History size={18} />
                  </button>
                  <button onClick={handleStartNewVersion} disabled={isReviewing} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Start New Version">
                    <FileText size={18} />
                  </button>
                  <button onClick={() => handleSave()} disabled={isReviewing} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Force Save">
                    <Save size={18} />
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (showCommentsPanel) {
                      handleCloseCommentsPanel();
                      return;
                    }
                    setPopupPosition(null);
                    setShowRefineInput(false);
                    setShowCommentInput(false);
                    setRefinePrompt('');
                    setCommentDraft('');
                    setShowCommentsPanel(true);
                  }}
                  disabled={isReviewing}
                  className={`relative p-1.5 rounded transition-colors ${
                    showCommentsPanel ? 'text-amber-800 bg-amber-50' : 'text-slate-600 hover:text-amber-800 hover:bg-amber-50'
                  }`}
                  title={showCommentsPanel ? 'Hide comments' : 'Show comments'}
                >
                  <MessageSquareText size={18} />
                  {openCommentCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] leading-4 text-center font-bold shadow">
                      {openCommentCount > 99 ? '99+' : openCommentCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setShowHighlights(!showHighlights)}
                  disabled={isReviewing}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors border ${showHighlights ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                  title="Toggle highlights for tracked edits"
                >
                  {showHighlights ? <EyeOff size={18} /> : <Eye size={18} />}
                  {showHighlights ? 'Hide Edits' : 'Show Edits'}
                </button>
              </div>
          </div>

          {/* Rich Editor Component */}
          <div className="flex-1 overflow-hidden relative flex">
            <div className={`flex-1 overflow-hidden ${isReviewing ? 'pointer-events-none opacity-40' : ''}`}>
              <ProseMirrorEditor
                key={`${section.id}:${section.currentVersionId || ''}`}
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
                comments={{
                  threads: commentThreads,
                  selectedThreadId: selectedCommentThreadId,
                  viewMode: showCommentsPanel ? 'HIGHLIGHTS' : 'BUBBLES',
                  onSelectThread: (threadId) => {
                    const thread = (commentThreadsRef.current ?? []).find((t) => t.id === threadId) ?? null;
                    if (thread && commentFilter !== 'ALL') {
                      if (commentFilter === 'OPEN' && thread.status === 'RESOLVED') setCommentFilter('ALL');
                      if (commentFilter === 'RESOLVED' && thread.status !== 'RESOLVED') setCommentFilter('ALL');
                    }
                    setShowCommentsPanel(true);
                    handleSelectCommentThread(threadId);
                  },
                  onThreadsChange: setCommentThreadsSynced,
                }}
                trackChanges={{
                  baseContent: workingBase ?? '',
                  events: changeEvents,
                  actor: {
                    type: 'USER',
                    userId: user?.id || 'unknown',
                    name: user?.fullName || user?.primaryEmailAddress?.emailAddress || null,
                  },
                  showHighlights,
                  onEventsChange: setChangeEvents,
                  activeCommentId,
                }}
              />
            </div>
            {showHighlights && !isReviewing && !showCommentsPanel && (
              <div className="hidden lg:flex">
                <ChangePanel events={changeEvents} selectedEventId={focusedChangeEventId} onSelectEvent={handleSelectChangeEvent} />
              </div>
            )}
            {showCommentsPanel && !isReviewing && (
              <div className="hidden lg:flex">
                <CommentPanel
                  threads={commentThreads}
                  currentUserId={currentCommentAuthor.userId}
                  selectedThreadId={selectedCommentThreadId}
                  filter={commentFilter}
                  onChangeFilter={setCommentFilter}
                  onSelectThread={handleSelectCommentThread}
                  onReply={handleReplyToComment}
                  onResolve={handleResolveComment}
                  onReopen={handleReopenComment}
                  onClose={handleCloseCommentsPanel}
                  onAddressWithAi={handleAddressCommentWithAi}
                  aiBusy={isAddressingComment}
                />
              </div>
            )}
          </div>

          {showCommentsPanel && !isReviewing && (
            <div
              className="lg:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]"
              onClick={handleCloseCommentsPanel}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-y-0 right-0 w-full max-w-[420px] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <CommentPanel
                  threads={commentThreads}
                  currentUserId={currentCommentAuthor.userId}
                  selectedThreadId={selectedCommentThreadId}
                  filter={commentFilter}
                  onChangeFilter={setCommentFilter}
                  onSelectThread={handleSelectCommentThread}
                  onReply={handleReplyToComment}
                  onResolve={handleResolveComment}
                  onReopen={handleReopenComment}
                  onClose={handleCloseCommentsPanel}
                  onAddressWithAi={handleAddressCommentWithAi}
                  aiBusy={isAddressingComment}
                />
              </div>
            </div>
          )}

          {/* Floating AI Edit Popup */}
          {!isReviewing && popupPosition && selectionData && (
              <div
                className="fixed z-50 bg-white shadow-xl border border-slate-200 rounded-lg p-1.5 animate-in fade-in zoom-in-95 duration-200 flex items-center gap-2"
                style={{ left: popupPosition.x, top: popupPosition.y, transform: 'translate(-50%, -100%)' }}
              >
                {!showRefineInput && !showCommentInput ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleStartRefine();
                      }}
                      className="h-9 w-9 rounded-md border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-colors flex items-center justify-center"
                      title="Edit selection with AI"
                    >
                      <Bot size={16} className="text-blue-700" />
                    </button>
                    <div className="h-7 w-px bg-slate-200" />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleStartComment();
                      }}
                      className="h-9 w-9 rounded-md border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-200 transition-colors flex items-center justify-center"
                      title="Add comment"
                    >
                      <MessageSquareText size={16} className="text-amber-800" />
                    </button>
                  </div>
                ) : showRefineInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="text-sm border border-slate-300 rounded px-2 py-1.5 w-64 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Describe the edit…"
                      value={refinePrompt}
                      onChange={(e) => setRefinePrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                    />
                    <Button size="sm" onClick={handleRefine} isLoading={isRefining} disabled={!refinePrompt}>
                      Go
                    </Button>
                    <button
                      type="button"
                      onClick={handleCancelRefine}
                      className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <textarea
                      autoFocus
                      rows={2}
                      className="text-sm border border-slate-300 rounded px-2 py-2 w-72 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                      placeholder="Leave a comment…"
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                    />
                    <Button size="sm" onClick={handleAddComment} disabled={!commentDraft.trim()}>
                      Comment
                    </Button>
                    <button
                      type="button"
                      onClick={handleCancelComment}
                      className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded"
                      title="Cancel"
                    >
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

          {aiReview && (
            <AiReviewOverlay
              baseContent={aiReview.baseContent}
              previewContent={aiReview.previewContent}
              event={aiReview.event}
              bibliographyOrder={bibliographyOrder}
              references={project.references}
              title={
                aiReview.kind === 'Draft'
                  ? 'Review AI draft'
                  : aiReview.kind === 'CommentAddress'
                    ? 'Review AI edit (comment)'
                    : 'Review AI refinement'
              }
              onAccept={handleAcceptChange}
              onDiscard={handleRejectChange}
            />
          )}
        </>
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
                    insertCitation(ref.id);
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
