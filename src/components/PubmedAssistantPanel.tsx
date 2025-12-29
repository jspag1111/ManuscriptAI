'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MessageSquare, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { generateId } from '@/services/storageService';
import type { Project, PubmedArticle, PubmedChatMessage, PubmedChatSession, Reference } from '@/types';

interface PubmedAssistantPanelProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const MAX_MESSAGES_FOR_AGENT = 14;

const buildChatTitle = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) return 'PubMed chat';
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
};

const coerceArticles = (articles?: PubmedArticle[]) => (Array.isArray(articles) ? articles : []);
const coerceChats = (chats?: PubmedChatSession[]) => (Array.isArray(chats) ? chats : []);

const formatAuthorPreview = (authors?: string) => {
  if (!authors) return 'Unknown authors';
  const parts = authors.split(',');
  if (parts.length > 1) return `${parts[0].trim()} et al.`;
  return authors;
};

const isArticleInLibrary = (refs: Reference[], article: PubmedArticle) => {
  if (article.doi && refs.some((ref) => ref.doi && ref.doi === article.doi)) return true;
  if (article.pmid && refs.some((ref) => ref.notes?.includes(`PMID: ${article.pmid}`))) return true;
  return false;
};

const mergeArticles = (existing: PubmedArticle[], added: PubmedArticle[]) => {
  const map = new Map<string, PubmedArticle>();
  for (const article of existing) {
    const key = article.pmid || article.id;
    if (!key) continue;
    map.set(key, article);
  }
  for (const article of added) {
    const key = article.pmid || article.id || generateId();
    const prev = map.get(key);
    map.set(key, {
      ...prev,
      ...article,
      id: prev?.id || article.id || key,
      addedAt: prev?.addedAt || article.addedAt || Date.now(),
    });
  }
  return Array.from(map.values()).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
};

const PubmedAssistantPanel: React.FC<PubmedAssistantPanelProps> = ({ project, onUpdateProject }) => {
  const projectRef = useRef(project);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({});
  const [toolSummaryByChat, setToolSummaryByChat] = useState<Record<string, string[]>>({});
  const [thoughtSummaryByChat, setThoughtSummaryByChat] = useState<Record<string, string[]>>({});

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const pubmedArticles = useMemo(() => coerceArticles(project.pubmedArticles), [project.pubmedArticles]);
  const pubmedChats = useMemo(() => coerceChats(project.pubmedChats), [project.pubmedChats]);
  const activeChatId = project.pubmedActiveChatId || pubmedChats[0]?.id || null;
  const activeChat = pubmedChats.find((chat) => chat.id === activeChatId) || null;

  useEffect(() => {
    if (pubmedChats.length === 0) {
      const now = Date.now();
      const newChat: PubmedChatSession = {
        id: generateId(),
        title: 'PubMed chat',
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      onUpdateProject({
        ...projectRef.current,
        pubmedChats: [newChat],
        pubmedActiveChatId: newChat.id,
      });
    }
  }, [pubmedChats.length, onUpdateProject]);

  const updateProject = (updater: (current: Project) => Project) => {
    const current = projectRef.current;
    onUpdateProject(updater(current));
  };

  const handleNewChat = () => {
    const now = Date.now();
    const newChat: PubmedChatSession = {
      id: generateId(),
      title: 'PubMed chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    updateProject((current) => ({
      ...current,
      pubmedChats: [...coerceChats(current.pubmedChats), newChat],
      pubmedActiveChatId: newChat.id,
    }));
  };

  const handleSelectChat = (chatId: string) => {
    updateProject((current) => ({
      ...current,
      pubmedActiveChatId: chatId,
    }));
  };

  const handleRemoveArticle = (articleId: string) => {
    updateProject((current) => ({
      ...current,
      pubmedArticles: coerceArticles(current.pubmedArticles).filter((article) => (article.pmid || article.id) !== articleId),
    }));
  };

  const handleAddToLibrary = (article: PubmedArticle) => {
    updateProject((current) => {
      const refs = current.references || [];
      if (isArticleInLibrary(refs, article)) {
        return current;
      }
      const newRef: Reference = {
        id: generateId(),
        title: article.title || 'Untitled',
        authors: article.authors || 'Unknown',
        year: article.year || '',
        publication: article.journal || '',
        doi: article.doi || '',
        abstract: article.abstract || '',
        notes: article.pmid ? `Source URL: https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/\nPMID: ${article.pmid}` : '',
        articleType: '',
        summary: '',
      };
      return {
        ...current,
        references: [...refs, newRef],
      };
    });
  };

  const appendMessage = (chat: PubmedChatSession, message: PubmedChatMessage, titleOverride?: string) => {
    const updatedMessages = [...chat.messages, message];
    return {
      ...chat,
      messages: updatedMessages,
      updatedAt: Date.now(),
      title: titleOverride || chat.title,
    };
  };

  const handleSendMessage = async () => {
    if (!activeChat || !messageInput.trim() || isSending) return;

    const now = Date.now();
    const userMessage: PubmedChatMessage = {
      id: generateId(),
      role: 'user',
      content: messageInput.trim(),
      createdAt: now,
    };

    const title = activeChat.messages.length === 0 ? buildChatTitle(userMessage.content) : activeChat.title;

    const updatedChat = appendMessage(activeChat, userMessage, title);

    updateProject((current) => ({
      ...current,
      pubmedChats: coerceChats(current.pubmedChats).map((chat) => (chat.id === updatedChat.id ? updatedChat : chat)),
      pubmedActiveChatId: updatedChat.id,
    }));

    setMessageInput('');
    setIsSending(true);
    setToolSummaryByChat((prev) => ({ ...prev, [updatedChat.id]: [] }));
    setThoughtSummaryByChat((prev) => ({ ...prev, [updatedChat.id]: [] }));

    const agentMessages = [...updatedChat.messages]
      .slice(-MAX_MESSAGES_FOR_AGENT)
      .map((msg) => ({ role: msg.role, content: msg.content }));

    try {
      const response = await fetch('/api/pubmed/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: agentMessages,
          articles: coerceArticles(projectRef.current.pubmedArticles).map((article) => ({
            pmid: article.pmid,
            title: article.title,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || response.statusText || 'PubMed agent failed.');
      }

      if (!response.body) {
        throw new Error('PubMed agent response did not include a stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalPayload: {
        reply?: string;
        added?: PubmedArticle[];
        removed?: string[];
        toolSummary?: string[];
      } | null = null;
      let streamError: string | null = null;

      const appendSummary = (
        updater: React.Dispatch<React.SetStateAction<Record<string, string[]>>>,
        summary: string
      ) => {
        updater((prev) => {
          const existing = prev[updatedChat.id] || [];
          if (existing[existing.length - 1] === summary) return prev;
          return { ...prev, [updatedChat.id]: [...existing, summary] };
        });
      };

      const handleEvent = (event: {
        type?: string;
        summary?: string;
        error?: string;
        reply?: string;
        added?: unknown;
        removed?: unknown;
        toolSummary?: string[];
      }) => {
        if (event.type === 'tool' && event.summary) {
          appendSummary(setToolSummaryByChat, event.summary);
        }
        if (event.type === 'thought' && event.summary) {
          appendSummary(setThoughtSummaryByChat, event.summary);
        }
        if (event.type === 'error') {
          streamError = event.error || 'PubMed agent failed.';
        }
        if (event.type === 'final') {
          finalPayload = {
            reply: typeof event.reply === 'string' ? event.reply : undefined,
            added: Array.isArray(event.added) ? (event.added as PubmedArticle[]) : [],
            removed: Array.isArray(event.removed) ? (event.removed as string[]) : [],
            toolSummary: Array.isArray(event.toolSummary) ? (event.toolSummary as string[]) : [],
          };
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const lines = chunk.split('\n');
          const dataLines = lines.filter((line) => line.startsWith('data:')).map((line) => line.replace(/^data:\s?/, ''));
          const data = dataLines.join('');
          if (data) {
            try {
              const parsed = JSON.parse(data);
              handleEvent(parsed);
            } catch {
              // Ignore malformed chunks.
            }
          }
          boundary = buffer.indexOf('\n\n');
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }

      if (!finalPayload?.reply) {
        throw new Error('PubMed agent did not return a response.');
      }

      const assistantMessage: PubmedChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: finalPayload.reply || 'Here are the latest PubMed results.',
        createdAt: Date.now(),
      };

      const addedArticles = finalPayload.added || [];
      const removedPmids = finalPayload.removed || [];
      const toolSummary = finalPayload.toolSummary || [];

      updateProject((current) => {
        const chats = coerceChats(current.pubmedChats);
        const nextChats = chats.map((chat) => {
          if (chat.id !== updatedChat.id) return chat;
          return appendMessage(chat, assistantMessage);
        });

        const filteredArticles = coerceArticles(current.pubmedArticles).filter((article) => {
          const key = article.pmid || article.id;
          return key && !removedPmids.includes(key);
        });

        return {
          ...current,
          pubmedChats: nextChats,
          pubmedArticles: mergeArticles(filteredArticles, addedArticles),
        };
      });

      if (toolSummary.length > 0) {
        setToolSummaryByChat((prev) => {
          const existing = prev[updatedChat.id] || [];
          const merged = [...existing];
          toolSummary.forEach((item) => {
            if (!merged.includes(item)) merged.push(item);
          });
          return { ...prev, [updatedChat.id]: merged };
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PubMed agent failed.';
      const errorMessage: PubmedChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: message,
        createdAt: Date.now(),
      };

      updateProject((current) => {
        const chats = coerceChats(current.pubmedChats);
        return {
          ...current,
          pubmedChats: chats.map((chat) => (chat.id === updatedChat.id ? appendMessage(chat, errorMessage) : chat)),
        };
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] h-full min-h-0">
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <header className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Article Board</p>
              <p className="text-xs text-slate-500">Curated PubMed results stay here across chats.</p>
            </div>
            <div className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-1">
              {pubmedArticles.length} items
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {pubmedArticles.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-10">
              No articles yet. Ask the assistant to search PubMed and the results will appear here.
            </div>
          )}

          {pubmedArticles.map((article) => {
            const key = article.pmid || article.id;
            const isExpanded = expandedArticles[key];
            const inLibrary = isArticleInLibrary(project.references, article);
            return (
              <div key={key} className="border border-slate-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="text-left flex-1"
                    onClick={() => setExpandedArticles((prev) => ({ ...prev, [key]: !prev[key] }))}
                  >
                    <h4 className="text-sm font-semibold text-slate-800 leading-snug">{article.title}</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatAuthorPreview(article.authors)}
                      {article.journal ? ` • ${article.journal}` : ''}
                      {article.year ? ` • ${article.year}` : ''}
                    </p>
                  </button>
                  <div className="flex flex-col items-end gap-2">
                    {inLibrary ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        In library
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => handleAddToLibrary(article)}>
                        Add
                      </Button>
                    )}
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      onClick={() => handleRemoveArticle(key)}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    {article.pmid && (
                      <p className="flex items-center gap-2">
                        <span className="font-semibold text-slate-500">PMID</span>
                        <span>{article.pmid}</span>
                      </p>
                    )}
                    {article.doi && (
                      <p className="flex items-center gap-2">
                        <span className="font-semibold text-slate-500">DOI</span>
                        <span>{article.doi}</span>
                      </p>
                    )}
                    {article.abstract && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-600 whitespace-pre-wrap">
                        {article.abstract}
                      </div>
                    )}
                    {article.url && (
                      <a
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on PubMed <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <header className="border-b border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <MessageSquare size={16} /> PubMed Assistant
              </p>
              <p className="text-xs text-slate-500">Ask for trials, filters, and more articles. Chats stay separate.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleNewChat}>
              <Plus size={14} className="mr-1" /> New chat
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {pubmedChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => handleSelectChat(chat.id)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  chat.id === activeChatId
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {chat.title || 'PubMed chat'}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-10">
              Describe the PubMed evidence you want to collect, and the assistant will curate articles for you.
            </div>
          ) : (
            activeChat.messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white ml-auto'
                    : 'bg-slate-50 border border-slate-200 text-slate-700'
                }`}
              >
                {msg.content}
              </div>
            ))
          )}

          {thoughtSummaryByChat[activeChatId || '']?.length ? (
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700 flex items-center gap-1">
                <Sparkles size={12} /> Thought summary
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {thoughtSummaryByChat[activeChatId || ''].map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {toolSummaryByChat[activeChatId || '']?.length ? (
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700 flex items-center gap-1">
                <Sparkles size={12} /> Agent activity
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {toolSummaryByChat[activeChatId || ''].map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="border-t border-slate-200 p-4">
          <div className="flex flex-col gap-3">
            <textarea
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask for PubMed searches, expand with related trials, or remove items..."
              className="w-full min-h-[80px] resize-none border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Press Enter to send, Shift+Enter for a new line.</p>
              <Button onClick={handleSendMessage} disabled={!messageInput.trim() || isSending} isLoading={isSending}>
                Send
              </Button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default PubmedAssistantPanel;
