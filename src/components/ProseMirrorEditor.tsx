"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorState, Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { schema } from 'prosemirror-schema-basic';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
import { baseKeymap } from 'prosemirror-commands';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { gapCursor } from 'prosemirror-gapcursor';
import { computeDiff } from '@/utils/diffUtils';
import { Check, MessageCircleMore, Sparkles, Wand2 } from 'lucide-react';
import { Node as ProseMirrorNode } from 'prosemirror-model';

interface EditorComment {
  id: string;
  from: number;
  to: number;
  text: string;
  resolved: boolean;
  author: 'user' | 'ai';
  createdAt: number;
}

const diffPluginKey = new PluginKey<DecorationSet>('pm-diff-highlights');
const commentPluginKey = new PluginKey<DecorationSet>('pm-comment-highlights');

const createDecorationPlugin = (key: PluginKey<DecorationSet>) => new Plugin<DecorationSet>({
  key,
  state: {
    init: () => DecorationSet.empty,
    apply(tr, set) {
      const meta = tr.getMeta(key);
      if (meta?.decorations) {
        return meta.decorations;
      }
      if (tr.docChanged) {
        return set.map(tr.mapping, tr.doc);
      }
      return set;
    },
  },
  props: {
    decorations: state => key.getState(state),
  },
});

const diffDecorationPlugin = createDecorationPlugin(diffPluginKey);
const commentDecorationPlugin = createDecorationPlugin(commentPluginKey);

const toDoc = (text: string) => schema.node('doc', null, [schema.node('paragraph', null, schema.text(text))]);

const buildUserDiffDecorations = (doc: ProseMirrorNode, baseline: string) => {
  const docText: string = doc.textContent;
  const parts = computeDiff(baseline, docText);
  const decorations: Decoration[] = [];
  let pos = 1; // Start inside the first paragraph

  for (const part of parts) {
    if (part.type === 'equal') {
      pos += part.value.length;
    } else if (part.type === 'insert') {
      const from = pos;
      const to = pos + part.value.length;
      decorations.push(Decoration.inline(from, to, { class: 'pm-diff-user' }));
      pos = to;
    } else {
      // delete
    }
  }

  return decorations;
};

const buildLlmDiffDecorations = (doc: ProseMirrorNode, baseline: string, llmDraft: string) => {
  const docText: string = doc.textContent;
  const parts = computeDiff(baseline, llmDraft);
  const decorations: Decoration[] = [];
  let searchFrom = 0;

  for (const part of parts) {
    if (part.type !== 'insert') continue;
    const idx = docText.indexOf(part.value, searchFrom);
    if (idx === -1) continue;
    const from = 1 + idx;
    const to = from + part.value.length;
    decorations.push(Decoration.inline(from, to, { class: 'pm-diff-llm' }));
    searchFrom = to - 1;
  }

  return decorations;
};

const buildCommentDecorations = (doc: ProseMirrorNode, comments: EditorComment[], activeId: string | null) => {
  return DecorationSet.create(
    doc,
    comments.map(comment => {
      const classes = [
        'pm-comment-marker',
        comment.resolved ? 'pm-comment-resolved' : 'pm-comment-open',
        activeId === comment.id ? 'pm-comment-active' : '',
      ].filter(Boolean).join(' ');
      return Decoration.inline(comment.from, comment.to, { class: classes, 'data-comment-id': comment.id });
    }),
  );
};

const randomId = () => Math.random().toString(36).slice(2, 10);

interface ProseMirrorEditorProps {
  baselineText: string;
  llmDraft: string;
  initialContent?: string;
}

export const ProseMirrorEditor: React.FC<ProseMirrorEditorProps> = ({ baselineText, llmDraft, initialContent }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [currentText, setCurrentText] = useState(initialContent ?? baselineText);
  const [selectionPreview, setSelectionPreview] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [versionLog, setVersionLog] = useState<string[]>([]);
  const [comments, setComments] = useState<EditorComment[]>(() => [
    {
      id: randomId(),
      from: 1,
      to: Math.min(35, baselineText.length + 1),
      text: 'Clarify the main takeaway in this opening sentence.',
      resolved: false,
      author: 'user',
      createdAt: Date.now(),
    },
  ]);

  const commentsRef = useRef<EditorComment[]>(comments);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  const rebuildDiffDecorations = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;

    const userDecorations = buildUserDiffDecorations(view.state.doc, baselineText);
    const llmDecorations = buildLlmDiffDecorations(view.state.doc, baselineText, llmDraft);
    const merged = DecorationSet.create(view.state.doc, [...userDecorations, ...llmDecorations]);

    view.dispatch(view.state.tr.setMeta(diffPluginKey, { decorations: merged }));
  }, [baselineText, llmDraft]);

  const rebuildCommentDecorations = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const set = buildCommentDecorations(view.state.doc, comments, activeCommentId);
    view.dispatch(view.state.tr.setMeta(commentPluginKey, { decorations: set }));
  }, [comments, activeCommentId]);

  useEffect(() => {
    if (!mountRef.current) return;

    const state = EditorState.create({
      schema,
      doc: toDoc(initialContent ?? baselineText),
      plugins: [
        history(),
        gapCursor(),
        keymap(baseKeymap),
        diffDecorationPlugin,
        commentDecorationPlugin,
      ],
    });

    const view = new EditorView(mountRef.current, {
      state,
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr);

        if (tr.docChanged) {
          const mapped = commentsRef.current.map(comment => ({
            ...comment,
            from: tr.mapping.map(comment.from),
            to: tr.mapping.map(comment.to),
          }));
          commentsRef.current = mapped;
          setComments(mapped);
        }

        view.updateState(newState);
        setCurrentText(newState.doc.textContent);
        const sel = newState.selection;
        setSelectionPreview(sel.empty ? '' : newState.doc.textBetween(sel.from, sel.to, ' '));
      },
    });

    viewRef.current = view;
    rebuildDiffDecorations();
    rebuildCommentDecorations();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [baselineText, initialContent, rebuildCommentDecorations, rebuildDiffDecorations]);

  useEffect(() => {
    rebuildDiffDecorations();
  }, [currentText, rebuildDiffDecorations]);

  useEffect(() => {
    rebuildCommentDecorations();
  }, [rebuildCommentDecorations]);

  const addComment = () => {
    const view = viewRef.current;
    if (!view) return;
    const sel = view.state.selection as TextSelection;
    if (sel.empty) return;
    const trimmed = commentDraft.trim();
    if (!trimmed) return;

    const comment: EditorComment = {
      id: randomId(),
      from: sel.from,
      to: sel.to,
      text: trimmed,
      resolved: false,
      author: 'user',
      createdAt: Date.now(),
    };
    setComments(prev => [...prev, comment]);
    setCommentDraft('');
    setVersionLog(prev => [`Added comment on selection`, ...prev]);
    setActiveCommentId(comment.id);
  };

  const resolveComment = (id: string) => {
    setComments(prev => prev.map(comment => comment.id === id ? { ...comment, resolved: true } : comment));
    setVersionLog(prev => [`Resolved comment ${id}`, ...prev]);
  };

  const jumpToComment = (comment: EditorComment) => {
    const view = viewRef.current;
    if (!view) return;
    const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, comment.from, comment.to));
    view.dispatch(tr);
    setActiveCommentId(comment.id);
  };

  const applyAiFix = (comment: EditorComment) => {
    const view = viewRef.current;
    if (!view) return;
    const suggestion = comment.text.trim();
    const tr = view.state.tr.insertText(suggestion, comment.from, comment.to);
    view.dispatch(tr);
    setComments(prev => prev.map(c => c.id === comment.id ? { ...c, author: 'ai' } : c));
    setVersionLog(prev => [`AI fix applied for comment ${comment.id}`, ...prev]);
  };

  const applyAiFixForAll = () => {
    const view = viewRef.current;
    if (!view) return;
    const pending = comments.filter(c => !c.resolved);
    const sorted = [...pending].sort((a, b) => b.from - a.from);
    let tr = view.state.tr;
    sorted.forEach(comment => {
      const suggestion = comment.text.trim();
      tr = tr.insertText(suggestion, comment.from, comment.to);
    });
    view.dispatch(tr);
    setComments(prev => prev.map(c => pending.find(p => p.id === c.id) ? { ...c, author: 'ai' } : c));
    setVersionLog(prev => [`AI fix applied to ${pending.length} comments`, ...prev]);
  };

  const headerBadges = useMemo(() => ([
    { label: 'User edits', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { label: 'AI suggestions', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { label: 'Comments', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  ]), []);

  return (
    <div className="grid lg:grid-cols-5 gap-6 w-full">
      <div className="lg:col-span-3 space-y-3">
        <div className="flex items-center justify-between rounded-2xl bg-white/80 border border-slate-200 shadow-sm px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Wand2 className="w-4 h-4 text-blue-600" />
            ProseMirror editor with AI-aware diffing
          </div>
          <div className="flex gap-2 flex-wrap">
            {headerBadges.map(badge => (
              <span key={badge.label} className={`px-2.5 py-1 text-xs rounded-full border ${badge.className}`}>
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 border border-slate-200 shadow-sm p-4">
          <div className="relative rounded-xl border border-slate-200 bg-white min-h-[320px]">
            <div ref={mountRef} className="pm-editor min-h-[320px]" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <MessageCircleMore className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-700">Selection</span>
              <span className="text-slate-500">{selectionPreview || 'None selected'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-slate-600">LLM draft overlay with violet highlights</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Add comment</label>
            <textarea
              value={commentDraft}
              onChange={e => setCommentDraft(e.target.value)}
              placeholder="What should change? Highlight text in the editor and describe the fix."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              rows={3}
            />
            <button
              onClick={addComment}
              className="self-start px-4 py-2 text-sm font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
              disabled={!commentDraft.trim() || !selectionPreview}
            >
              Attach to selection
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl bg-white/80 border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Discussion</p>
              <p className="text-xs text-slate-500">Click a thread to jump to the text and run AI fixes.</p>
            </div>
            <button
              onClick={applyAiFixForAll}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
            >
              <Sparkles className="w-4 h-4" /> Fix all with AI
            </button>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {comments.map(comment => (
              <div
                key={comment.id}
                className={`rounded-xl border px-3 py-2 transition cursor-pointer ${comment.resolved ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/60 border-amber-200'}`}
                onClick={() => jumpToComment(comment)}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${comment.resolved ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="font-semibold text-slate-700">{comment.resolved ? 'Resolved' : 'Open'} · {comment.author === 'ai' ? 'AI' : 'User'}</span>
                  </div>
                  <span>{new Date(comment.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-slate-800 mt-1 leading-relaxed">{comment.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  {!comment.resolved && (
                    <button
                      onClick={(e) => { e.stopPropagation(); applyAiFix(comment); }}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    >
                      <Sparkles className="w-3 h-3" /> AI fix
                    </button>
                  )}
                  {!comment.resolved && (
                    <button
                      onClick={(e) => { e.stopPropagation(); resolveComment(comment.id); }}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    >
                      <Check className="w-3 h-3" /> Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-slate-500">No comments yet. Highlight text to start a thread.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Version activity</p>
            <span className="text-xs text-slate-500">Tracked from edits, AI fixes, and resolutions</span>
          </div>
          <div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1 text-sm text-slate-700">
            {versionLog.length === 0 ? (
              <p className="text-slate-500">No activity yet. Actions will appear here.</p>
            ) : (
              versionLog.map((entry, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  <span>{entry}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

