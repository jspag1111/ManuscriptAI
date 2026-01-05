import React, { useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';

import { Button } from '@/components/Button';
import type { PubmedArticle } from '@/types';
import { formatAuthorPreview } from '@/utils/pubmedArticleUtils';

interface PubmedArticleBoardProps {
  articles: PubmedArticle[];
  isInLibrary: (article: PubmedArticle) => boolean;
  onAddToLibrary: (article: PubmedArticle) => void;
  onRemoveArticle: (articleId: string) => void;
  title?: string;
  subtitle?: string;
  emptyState?: string;
}

const PubmedArticleBoard: React.FC<PubmedArticleBoardProps> = ({
  articles,
  isInLibrary,
  onAddToLibrary,
  onRemoveArticle,
  title = 'Article Board',
  subtitle = 'Curated PubMed results stay here across chats.',
  emptyState = 'No articles yet. Ask the assistant to search PubMed and the results will appear here.',
}) => {
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({});

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
      <header className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <div className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-1">
            {articles.length} items
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {articles.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-10">{emptyState}</div>
        )}

        {articles.map((article) => {
          const key = article.pmid || article.id;
          if (!key) return null;
          const isExpanded = expandedArticles[key];
          const inLibrary = isInLibrary(article);
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
                    <Button size="sm" onClick={() => onAddToLibrary(article)}>
                      Add
                    </Button>
                  )}
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                    onClick={() => onRemoveArticle(key)}
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
  );
};

export default PubmedArticleBoard;
