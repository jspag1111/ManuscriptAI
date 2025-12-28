export interface PubMedSearchResult {
  ids: string[];
  count: number;
}

export interface PubMedSummary {
  pmid: string;
  title: string;
  pubdate?: string;
  source?: string;
}

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const getNcbiCommonParams = () => {
  const params: Record<string, string> = {};
  if (process.env.NCBI_API_KEY) params.api_key = process.env.NCBI_API_KEY;
  params.tool = process.env.NCBI_TOOL || 'ManuscriptAI';
  if (process.env.NCBI_EMAIL) params.email = process.env.NCBI_EMAIL;
  return params;
};

const buildEutilsUrl = (path: string, params: Record<string, string>) => {
  const url = new URL(`${EUTILS_BASE}/${path}`);
  const merged = { ...getNcbiCommonParams(), ...params };
  for (const [key, value] of Object.entries(merged)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
};

const chunk = <T,>(values: T[], size: number): T[][] => {
  if (size <= 0) return [values];
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
};

const toSortParam = (sort: 'relevance' | 'pub_date') => (sort === 'pub_date' ? 'pub+date' : 'relevance');

export const pubmedEsearch = async ({
  term,
  retmax,
  sort,
}: {
  term: string;
  retmax: number;
  sort: 'relevance' | 'pub_date';
}): Promise<PubMedSearchResult> => {
  const url = buildEutilsUrl('esearch.fcgi', {
    db: 'pubmed',
    term,
    retmode: 'json',
    retmax: String(Math.max(1, Math.min(200, retmax))),
    sort: toSortParam(sort),
  });

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PubMed esearch failed (${response.status}): ${text || response.statusText}`);
  }
  const data = (await response.json()) as any;
  const ids = Array.isArray(data?.esearchresult?.idlist) ? (data.esearchresult.idlist as string[]) : [];
  const count = Number(data?.esearchresult?.count ?? 0);
  return { ids, count: Number.isFinite(count) ? count : ids.length };
};

export const pubmedEsummary = async (ids: string[]): Promise<PubMedSummary[]> => {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];

  const batches = chunk(unique, 200);
  const results: PubMedSummary[] = [];

  for (const batch of batches) {
    const url = buildEutilsUrl('esummary.fcgi', {
      db: 'pubmed',
      id: batch.join(','),
      retmode: 'json',
    });
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`PubMed esummary failed (${response.status}): ${text || response.statusText}`);
    }
    const data = (await response.json()) as any;
    const uids = Array.isArray(data?.result?.uids) ? (data.result.uids as string[]) : [];
    for (const uid of uids) {
      const record = data?.result?.[uid];
      if (!record) continue;
      results.push({
        pmid: String(uid),
        title: typeof record.title === 'string' ? record.title : '',
        pubdate: typeof record.pubdate === 'string' ? record.pubdate : undefined,
        source: typeof record.source === 'string' ? record.source : undefined,
      });
    }
  }

  return results;
};

export const pubmedElinkRelated = async (seedPmids: string[], limit = 200): Promise<string[]> => {
  const unique = Array.from(new Set(seedPmids.filter(Boolean)));
  if (unique.length === 0) return [];

  const batches = chunk(unique, 20);
  const related = new Set<string>();

  for (const batch of batches) {
    const url = buildEutilsUrl('elink.fcgi', {
      dbfrom: 'pubmed',
      db: 'pubmed',
      id: batch.join(','),
      linkname: 'pubmed_pubmed',
      retmode: 'json',
    });
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) continue;
    const data = (await response.json()) as any;
    const linksets = Array.isArray(data?.linksets) ? data.linksets : [];
    for (const linkset of linksets) {
      const dbs = Array.isArray(linkset?.linksetdbs) ? linkset.linksetdbs : [];
      for (const db of dbs) {
        const links = Array.isArray(db?.links) ? (db.links as any[]) : [];
        for (const link of links) {
          related.add(String(link));
          if (related.size >= limit) return Array.from(related);
        }
      }
    }
  }

  return Array.from(related);
};

