import type { PubmedArticle, Reference } from '@/types';

export const coerceArticles = (articles?: PubmedArticle[]) => (Array.isArray(articles) ? articles : []);

export const formatAuthorPreview = (authors?: string) => {
  if (!authors) return 'Unknown authors';
  const parts = authors.split(',');
  if (parts.length > 1) return `${parts[0].trim()} et al.`;
  return authors;
};

export const isArticleInLibrary = (refs: Reference[], article: PubmedArticle) => {
  if (article.doi && refs.some((ref) => ref.doi && ref.doi === article.doi)) return true;
  if (article.pmid && refs.some((ref) => ref.notes?.includes(`PMID: ${article.pmid}`))) return true;
  return false;
};

export const mergeArticles = (existing: PubmedArticle[], added: PubmedArticle[]) => {
  const map = new Map<string, PubmedArticle>();
  for (const article of existing) {
    const key = article.pmid || article.id;
    if (!key) continue;
    map.set(key, article);
  }
  for (const article of added) {
    const key = article.pmid || article.id;
    if (!key) continue;
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
