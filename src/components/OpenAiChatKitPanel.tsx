'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';

import { Button } from '@/components/Button';
import PubmedArticleBoard from '@/components/PubmedArticleBoard';
import { generateId } from '@/services/storageService';
import type { Project, PubmedArticle } from '@/types';
import { coerceArticles, isArticleInLibrary, mergeArticles } from '@/utils/pubmedArticleUtils';

interface OpenAiChatKitPanelProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

type ClientToolCall = {
  name: string;
  params: Record<string, unknown>;
};

type DownloadItem = {
  id: string;
  name: string;
  url: string;
  createdAt: number;
};

const DEFAULT_TOOL_ERROR = 'Tool request failed. Check inputs and try again.';

const coerceString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const coerceStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => coerceString(item)).filter(Boolean) : [];

const normalizeArticleInput = (raw: Record<string, unknown>): PubmedArticle | null => {
  const pmid = coerceString(raw.pmid);
  const title = coerceString(raw.title);
  if (!pmid && !title) return null;

  const doi = coerceString(raw.doi);
  const url = coerceString(raw.url);
  const id = coerceString(raw.id) || pmid || generateId();

  return {
    id,
    pmid: pmid || undefined,
    title: title || 'Untitled',
    authors: coerceString(raw.authors) || undefined,
    journal: coerceString(raw.journal) || undefined,
    year: coerceString(raw.year) || undefined,
    pubdate: coerceString(raw.pubdate) || undefined,
    doi: doi || undefined,
    abstract: coerceString(raw.abstract) || undefined,
    url: url || (pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined),
    addedAt: typeof raw.addedAt === 'number' && Number.isFinite(raw.addedAt) ? raw.addedAt : Date.now(),
    rationale: coerceString(raw.rationale) || undefined,
  };
};

const buildDownload = ({
  filename,
  markdown,
  format,
}: {
  filename: string;
  markdown: string;
  format: string;
}): DownloadItem => {
  const normalizedFormat = format === 'txt' ? 'txt' : 'md';
  const contentType = normalizedFormat === 'txt' ? 'text/plain' : 'text/markdown';
  const safeName = filename.endsWith(`.${normalizedFormat}`)
    ? filename
    : `${filename}.${normalizedFormat}`;
  const blob = new Blob([markdown], { type: contentType });
  return {
    id: generateId(),
    name: safeName,
    url: URL.createObjectURL(blob),
    createdAt: Date.now(),
  };
};

const OpenAiChatKitPanel: React.FC<OpenAiChatKitPanelProps> = ({ project, onUpdateProject }) => {
  const projectRef = useRef(project);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    return () => {
      downloads.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [downloads]);

  const updateProject = useCallback((updater: (current: Project) => Project) => {
    const current = projectRef.current;
    onUpdateProject(updater(current));
  }, [onUpdateProject]);

  const handleClientTool = useCallback(async (toolCall: ClientToolCall) => {
    const name = toolCall.name;
    const args = toolCall.params || {};

    if (name === 'article_board_list') {
      const articles = coerceArticles(projectRef.current.pubmedArticles).map((article) => ({
        id: article.id,
        pmid: article.pmid,
        title: article.title,
        authors: article.authors,
        journal: article.journal,
        year: article.year,
        doi: article.doi,
        abstract: article.abstract,
        url: article.url,
      }));
      return { ok: true, count: articles.length, articles };
    }

    if (name === 'article_board_add') {
      const rawArticles = Array.isArray(args.articles) ? args.articles : [];
      const normalized = rawArticles
        .map((item) => normalizeArticleInput(item as Record<string, unknown>))
        .filter(Boolean) as PubmedArticle[];

      if (normalized.length === 0) {
        return { ok: false, error: 'No valid articles provided.' };
      }

      updateProject((current) => {
        const merged = mergeArticles(coerceArticles(current.pubmedArticles), normalized);
        return { ...current, pubmedArticles: merged };
      });

      return { ok: true, added: normalized.length };
    }

    if (name === 'article_board_remove') {
      const ids = new Set(coerceStringArray(args.ids));
      const pmids = new Set(coerceStringArray(args.pmids));
      const titleSnippets = coerceStringArray(args.title_contains).map((snippet) => snippet.toLowerCase());

      updateProject((current) => {
        const nextArticles = coerceArticles(current.pubmedArticles).filter((article) => {
          const key = article.pmid || article.id;
          if (!key) return false;
          if (ids.has(key) || (article.pmid && pmids.has(article.pmid))) return false;
          if (titleSnippets.length > 0) {
            const title = article.title.toLowerCase();
            if (titleSnippets.some((snippet) => title.includes(snippet))) return false;
          }
          return true;
        });
        return { ...current, pubmedArticles: nextArticles };
      });

      return { ok: true };
    }

    if (name === 'document_create') {
      const rawContent = coerceString(args.markdown);
      const format = coerceString(args.format) || 'md';
      const filename = coerceString(args.filename) || `manuscript-${new Date().toISOString().slice(0, 10)}`;

      if (!rawContent) {
        return { ok: false, error: 'markdown is required to create a document.' };
      }

      if (format !== 'md' && format !== 'txt') {
        return { ok: false, error: 'Unsupported format. Use "md" or "txt".' };
      }

      const download = buildDownload({ filename, markdown: rawContent, format });
      setDownloads((prev) => [download, ...prev].slice(0, 5));
      return { ok: true, filename: download.name };
    }

    return { ok: false, error: DEFAULT_TOOL_ERROR };
  }, [updateProject]);

  const getClientSecret = useCallback(async (existingClientSecret?: string) => {
    const response = await fetch('/api/chatkit/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ existingClientSecret }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error || response.statusText || 'Unable to start ChatKit session.';
      setChatError(message);
      throw new Error(message);
    }

    setChatError(null);
    return data.client_secret as string;
  }, []);

  const { control } = useChatKit({
    api: { getClientSecret },
    onClientTool: handleClientTool,
  });

  const articleCount = useMemo(() => coerceArticles(project.pubmedArticles).length, [project.pubmedArticles]);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] h-full min-h-0">
      <PubmedArticleBoard
        articles={coerceArticles(project.pubmedArticles)}
        isInLibrary={(article) => isArticleInLibrary(project.references, article)}
        onAddToLibrary={(article) => {
          updateProject((current) => {
            const refs = current.references || [];
            if (isArticleInLibrary(refs, article)) return current;
            const newRef = {
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
            return { ...current, references: [...refs, newRef] };
          });
        }}
        onRemoveArticle={(articleId) => {
          updateProject((current) => ({
            ...current,
            pubmedArticles: coerceArticles(current.pubmedArticles).filter((article) => (article.pmid || article.id) !== articleId),
          }));
        }}
        subtitle={`Shared article board (${articleCount} items). ChatKit can add or remove articles via client tools.`}
      />

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <header className="border-b border-slate-200 p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileText size={16} /> OpenAI ChatKit Assistant
            </p>
            <p className="text-xs text-slate-500">
              Uses your ChatKit workflow. Client tools can list/add/remove articles or create markdown downloads.
            </p>
          </div>
          {downloads.length > 0 && (
            <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-1">
              {downloads.length} downloads
            </div>
          )}
        </header>

        {chatError && (
          <div className="bg-red-50 border-b border-red-100 text-red-700 text-xs px-4 py-2">
            {chatError}
          </div>
        )}

        <div className="flex-1 min-h-0">
          <ChatKit control={control} className="h-full w-full" />
        </div>

        {downloads.length > 0 && (
          <footer className="border-t border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Downloads</div>
            <div className="space-y-2">
              {downloads.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate" title={item.name}>
                    {item.name}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = item.url;
                      link.download = item.name;
                      link.click();
                    }}
                  >
                    <Download size={14} className="mr-1" /> Download
                  </Button>
                </div>
              ))}
            </div>
          </footer>
        )}
      </section>
    </div>
  );
};

export default OpenAiChatKitPanel;
