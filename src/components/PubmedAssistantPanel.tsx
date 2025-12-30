'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MessageSquare, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { generateId } from '@/services/storageService';
import type { Project, PubmedAgentEvent, PubmedArticle, PubmedChatMessage, PubmedChatSession, Reference } from '@/types';

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

type StreamEvent =
  | { id: string; type: 'thought'; text: string; turn: number; timestamp: number }
  | { id: string; type: 'tool_call'; name: string; args: Record<string, unknown>; turn: number; timestamp: number }
  | { id: string; type: 'tool_result'; name: string; summary: string; turn: number; timestamp: number };

type StreamState = {
  reply: string;
  events: StreamEvent[];
  isStreaming: boolean;
  isOpen: boolean;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

const applyInlineMarkdown = (value: string) => {
  let html = value;
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
};

const renderMarkdownToHtml = (value: string) => {
  if (!value) return '';
  const codeBlocks: string[] = [];
  let html = value;

  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(code);
    return `@@CODEBLOCK_${index}@@`;
  });

  html = escapeHtml(html);

  const lines = html.split(/\r?\n/);
  let output = '';
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      output += '</ul>';
      inUl = false;
    }
    if (inOl) {
      output += '</ol>';
      inOl = false;
    }
  };

  for (const line of lines) {
    if (line.includes('@@CODEBLOCK_')) {
      closeLists();
      output += line;
      continue;
    }

    const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      output += `<h4>${applyInlineMarkdown(headingMatch[1])}</h4>`;
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (unorderedMatch) {
      if (!inUl) {
        closeLists();
        output += '<ul>';
        inUl = true;
      }
      output += `<li>${applyInlineMarkdown(unorderedMatch[1])}</li>`;
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (!inOl) {
        closeLists();
        output += '<ol>';
        inOl = true;
      }
      output += `<li>${applyInlineMarkdown(orderedMatch[1])}</li>`;
      continue;
    }

    if (!line.trim()) {
      closeLists();
      output += '<br />';
      continue;
    }

    closeLists();
    output += `<p>${applyInlineMarkdown(line)}</p>`;
  }

  closeLists();

  codeBlocks.forEach((block, index) => {
    const safe = escapeHtml(block);
    output = output.replace(
      `@@CODEBLOCK_${index}@@`,
      `<pre><code>${safe}</code></pre>`
    );
  });

  return output;
};

const formatToolArgs = (args: Record<string, unknown>) => {
  try {
    const json = JSON.stringify(args);
    if (json.length > 160) return `${json.slice(0, 160)}...`;
    return json;
  } catch (error) {
    return '[unavailable]';
  }
};

const streamEventToStored = (event: StreamEvent): PubmedAgentEvent => ({
  id: event.id,
  type: event.type,
  text: event.type === 'thought' ? event.text : undefined,
  name: event.type === 'tool_call' || event.type === 'tool_result' ? event.name : undefined,
  args: event.type === 'tool_call' ? event.args : undefined,
  summary: event.type === 'tool_result' ? event.summary : undefined,
  turn: event.turn,
  createdAt: event.timestamp,
});

const PubmedAssistantPanel: React.FC<PubmedAssistantPanelProps> = ({ project, onUpdateProject }) => {
  const projectRef = useRef(project);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({});
  const [streamStateByChat, setStreamStateByChat] = useState<Record<string, StreamState>>({});

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const pubmedArticles = useMemo(() => coerceArticles(project.pubmedArticles), [project.pubmedArticles]);
  const pubmedChats = useMemo(() => coerceChats(project.pubmedChats), [project.pubmedChats]);
  const activeChatId = project.pubmedActiveChatId || pubmedChats[0]?.id || null;
  const activeChat = pubmedChats.find((chat) => chat.id === activeChatId) || null;
  const activeStreamState = activeChatId ? streamStateByChat[activeChatId] : undefined;

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

  const updateStreamState = (chatId: string, updater: (prev: StreamState) => StreamState) => {
    setStreamStateByChat((prev) => {
      const fallback: StreamState = {
        reply: '',
        events: [],
        isStreaming: false,
        isOpen: false,
      };
      return {
        ...prev,
        [chatId]: updater(prev[chatId] || fallback),
      };
    });
  };

  const handleToggleActivity = (open: boolean) => {
    if (!activeChatId) return;
    updateStreamState(activeChatId, (prev) => ({
      ...prev,
      isOpen: open,
    }));
  };

  const renderAgentEventsBlock = (
    events: PubmedAgentEvent[],
    options?: { open?: boolean; onToggle?: (open: boolean) => void }
  ) => (
    <details
      className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-600"
      open={options?.open}
      onToggle={options?.onToggle ? (event) => options.onToggle?.((event.target as HTMLDetailsElement).open) : undefined}
    >
      <summary className="font-semibold text-slate-700 flex items-center gap-1 cursor-pointer">
        <Sparkles size={12} /> Agent activity
      </summary>
      <div className="mt-2 space-y-2">
        {events.map((event) => {
          if (event.type === 'thought') {
            return (
              <div key={event.id} className="flex gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold uppercase tracking-wide">
                  Thought
                </span>
                <span
                  className="text-slate-600 [&_p]:leading-relaxed [&_code]:bg-slate-200/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_a]:text-blue-600 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(event.text || '') }}
                />
              </div>
            );
          }
          if (event.type === 'tool_call') {
            return (
              <div key={event.id} className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold uppercase tracking-wide">
                    Tool call
                  </span>
                  <span className="text-slate-700 font-semibold">{event.name}</span>
                </span>
                {event.args ? (
                  <code className="text-[11px] text-slate-500 break-words">{formatToolArgs(event.args)}</code>
                ) : null}
              </div>
            );
          }
          return (
            <div key={event.id} className="flex gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold uppercase tracking-wide">
                Tool result
              </span>
              <span className="text-slate-600">{event.summary || 'Tool completed.'}</span>
            </div>
          );
        })}
      </div>
    </details>
  );

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

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || response.statusText || 'PubMed agent failed.');
      }

      updateStreamState(updatedChat.id, (prev) => ({
        ...prev,
        reply: '',
        events: [],
        isStreaming: true,
        isOpen: true,
      }));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const collectedEvents: PubmedAgentEvent[] = [];
      const streamStartedAt = Date.now();
      let streamedReply = '';
      let didReceiveTerminalEvent = false;

      const handleFinal = (payload: { reply?: string; added?: PubmedArticle[]; removed?: string[] }) => {
        const reply = typeof payload.reply === 'string' ? payload.reply : 'Here are the latest PubMed results.';
        const assistantMessage: PubmedChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: reply,
          createdAt: Date.now(),
          agentEvents: collectedEvents.length > 0 ? collectedEvents : undefined,
        };
        const addedArticles = Array.isArray(payload.added) ? payload.added : [];
        const removedPmids = Array.isArray(payload.removed) ? payload.removed : [];

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

        updateStreamState(updatedChat.id, (prev) => ({
          ...prev,
          reply: '',
          isStreaming: false,
          isOpen: false,
        }));
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: any;
          try {
            event = JSON.parse(line);
          } catch (err) {
            continue;
          }
          if (!event || typeof event.type !== 'string') continue;

          if (event.type === 'token') {
            const text = typeof event.text === 'string' ? event.text : '';
            if (!text) continue;
            streamedReply += text;
          }

          if (event.type === 'thought') {
            const text = typeof event.text === 'string' ? event.text : '';
            const entry: StreamEvent = {
              id: generateId(),
              type: 'thought',
              text,
              turn: event.turn ?? 0,
              timestamp: Date.now(),
            };
            collectedEvents.push(streamEventToStored(entry));
            updateStreamState(updatedChat.id, (prev) => ({
              ...prev,
              events: [...prev.events, entry],
              isStreaming: true,
              isOpen: true,
            }));
          }

          if (event.type === 'tool_call') {
            const entry: StreamEvent = {
              id: generateId(),
              type: 'tool_call',
              name: String(event.name || ''),
              args: (event.args as Record<string, unknown>) || {},
              turn: event.turn ?? 0,
              timestamp: Date.now(),
            };
            collectedEvents.push(streamEventToStored(entry));
            updateStreamState(updatedChat.id, (prev) => ({
              ...prev,
              events: [...prev.events, entry],
              isStreaming: true,
              isOpen: true,
            }));
          }

          if (event.type === 'tool_result') {
            const entry: StreamEvent = {
              id: generateId(),
              type: 'tool_result',
              name: String(event.name || ''),
              summary: typeof event.summary === 'string' ? event.summary : 'Tool completed.',
              turn: event.turn ?? 0,
              timestamp: Date.now(),
            };
            collectedEvents.push(streamEventToStored(entry));
            updateStreamState(updatedChat.id, (prev) => ({
              ...prev,
              events: [...prev.events, entry],
              isStreaming: true,
              isOpen: true,
            }));
          }

          if (event.type === 'final') {
            didReceiveTerminalEvent = true;
            handleFinal(event);
          }

          if (event.type === 'error') {
            didReceiveTerminalEvent = true;
            const message = typeof event.message === 'string' ? event.message : 'PubMed agent failed.';
            const errorMessage: PubmedChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: message,
              createdAt: Date.now(),
              agentEvents: collectedEvents.length > 0 ? collectedEvents : undefined,
            };
            updateProject((current) => {
              const chats = coerceChats(current.pubmedChats);
              return {
                ...current,
                pubmedChats: chats.map((chat) => (chat.id === updatedChat.id ? appendMessage(chat, errorMessage) : chat)),
              };
            });
            updateStreamState(updatedChat.id, (prev) => ({
              ...prev,
              reply: '',
              isStreaming: false,
              isOpen: false,
            }));
          }
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event?.type === 'final') {
            didReceiveTerminalEvent = true;
            handleFinal(event);
          }
        } catch (err) {
          // ignore trailing buffer
        }
      }

      if (!didReceiveTerminalEvent) {
        const trimmedReply = streamedReply.trim();
        const fallbackReply = trimmedReply
          ? `${trimmedReply}\n\n_Notice: The response ended early. If this looks incomplete, please retry._`
          : 'The response ended unexpectedly. Please try again.';
        console.warn('PubMed assistant stream ended without final event.', {
          chatId: updatedChat.id,
          elapsedMs: Date.now() - streamStartedAt,
          replyLength: streamedReply.length,
          eventCount: collectedEvents.length,
        });
        handleFinal({ reply: fallbackReply });
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
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] h-full min-h-0">
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
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

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-10">
              Describe the PubMed evidence you want to collect, and the assistant will curate articles for you.
            </div>
          ) : (
            activeChat.messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] space-y-3 ${
                  msg.role === 'user' ? 'ml-auto' : ''
                }`}
              >
                {msg.role === 'assistant' && msg.agentEvents && msg.agentEvents.length > 0
                  ? renderAgentEventsBlock(msg.agentEvents)
                  : null}
                <div
                  className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-700'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div
                      className="space-y-3 text-sm leading-relaxed text-slate-700 [&_p]:leading-relaxed [&_h4]:text-sm [&_h4]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:bg-slate-200/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_a]:text-blue-600 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(msg.content) }}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}

          {activeStreamState?.isStreaming ? (
            <div className="max-w-[85%] space-y-3">
              {activeStreamState.events.length > 0
                ? renderAgentEventsBlock(activeStreamState.events.map(streamEventToStored), {
                    open: activeStreamState.isStreaming ? true : activeStreamState.isOpen,
                    onToggle: handleToggleActivity,
                  })
                : null}
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
