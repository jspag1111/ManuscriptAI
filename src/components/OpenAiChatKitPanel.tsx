'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { useAuth } from '@clerk/nextjs';

import PubmedArticleBoard from '@/components/PubmedArticleBoard';
import { generateId, getProjects } from '@/services/storageService';
import type { Project } from '@/types';
import { coerceArticles, isArticleInLibrary } from '@/utils/pubmedArticleUtils';

interface OpenAiChatKitPanelProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const OpenAiChatKitPanel: React.FC<OpenAiChatKitPanelProps> = ({ project, onUpdateProject }) => {
  const { getToken } = useAuth();
  const projectRef = useRef(project);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const updateProject = useCallback((updater: (current: Project) => Project) => {
    const current = projectRef.current;
    onUpdateProject(updater(current));
  }, [onUpdateProject]);

  const apiUrl = process.env.NEXT_PUBLIC_CHATKIT_API_URL || '/api/chatkit';
  const domainKey = process.env.NEXT_PUBLIC_CHATKIT_DOMAIN_KEY || '';

  const chatkitFetch = useCallback((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set('x-project-id', projectRef.current.id);
    return fetch(input, { ...init, headers });
  }, []);

  const refreshProjectFromServer = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const token = await getToken();
      const projects = await getProjects({ token });
      const updated = projects.find((p) => p.id === projectRef.current.id);
      if (updated) {
        onUpdateProject(updated);
      }
    } catch (error) {
      console.error('Failed to refresh project after ChatKit response.', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [getToken, isRefreshing, onUpdateProject]);

  const { control } = useChatKit({
    api: {
      url: apiUrl,
      domainKey,
      fetch: chatkitFetch,
    },
    onResponseEnd: refreshProjectFromServer,
    onError: (event) => setChatError(event.error?.message || 'ChatKit error.'),
    composer: {
      attachments: {
        enabled: false,
      },
    },
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
        subtitle={`Shared article board (${articleCount} items). Synced after ChatKit responses.`}
      />

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <header className="border-b border-slate-200 p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileText size={16} /> OpenAI ChatKit Assistant
            </p>
            <p className="text-xs text-slate-500">
              Runs the self-hosted OpenAI Agents SDK workflow. Results sync back to the article board.
            </p>
          </div>
        </header>

        {chatError && (
          <div className="bg-red-50 border-b border-red-100 text-red-700 text-xs px-4 py-2">
            {chatError}
          </div>
        )}

        <div className="flex-1 min-h-0">
          <ChatKit control={control} className="h-full w-full" />
        </div>

        {!domainKey && (
          <footer className="border-t border-slate-200 p-3 text-xs text-amber-700 bg-amber-50">
            Set `NEXT_PUBLIC_CHATKIT_DOMAIN_KEY` to enable ChatKit domain validation.
          </footer>
        )}
      </section>
    </div>
  );
};

export default OpenAiChatKitPanel;
