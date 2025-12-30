export interface PubmedSearchResult {
  query: string;
  pmids: string[];
  count: number;
}

export interface PubmedSummary {
  pmid: string;
  title: string;
  pubdate?: string;
  source?: string;
  fullJournalName?: string;
  authors?: string[];
  doi?: string;
}

export interface PubmedAbstractRecord {
  pmid: string;
  title?: string;
  journal?: string;
  year?: string;
  abstract?: string;
}

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getNcbiCommonParams = () => {
  const params: Record<string, string> = {};
  if (process.env.NCBI_API_KEY) params.api_key = process.env.NCBI_API_KEY;
  if (process.env.NCBI_EMAIL) params.email = process.env.NCBI_EMAIL;
  params.tool = process.env.NCBI_TOOL || 'ManuscriptAI';
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

const decodeNumericEntities = (value: string) =>
  value
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code)) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    })
    .replace(/&#(\d+);/g, (match, num) => {
      const code = Number.parseInt(num, 10);
      if (!Number.isFinite(code)) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    });

const decodeXml = (value: string) => {
  const decoded = value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
  return decodeNumericEntities(decoded);
};

const stripTags = (value: string) => value.replace(/<[^>]*>/g, '');

const cleanXmlText = (value?: string | null) => {
  if (!value) return '';
  const decoded = decodeXml(value);
  return stripTags(decoded).replace(/\s+/g, ' ').trim();
};

const extractTag = (block: string, tag: string) => {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(pattern);
  return match ? cleanXmlText(match[1]) : '';
};

const extractJournalTitle = (block: string) => {
  const match = block.match(/<Journal[\s\S]*?<Title>([\s\S]*?)<\/Title>/i);
  return match ? cleanXmlText(match[1]) : '';
};

const extractYear = (block: string) => {
  const yearMatch = block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/i);
  if (yearMatch) return yearMatch[1];
  const medlineMatch = block.match(/<PubDate>[\s\S]*?<MedlineDate>([\s\S]*?)<\/MedlineDate>/i);
  return medlineMatch ? cleanXmlText(medlineMatch[1]) : '';
};

const extractAbstract = (block: string) => {
  const parts: string[] = [];
  const regex = /<AbstractText\b([^>]*)>([\s\S]*?)<\/AbstractText>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(block))) {
    const attrs = match[1] || '';
    const labelMatch = attrs.match(/Label="([^"]+)"/i) || attrs.match(/Label='([^']+)'/i);
    const label = labelMatch ? cleanXmlText(labelMatch[1]) : '';
    const text = cleanXmlText(match[2]);
    if (!text) continue;
    parts.push(label ? `${label}: ${text}` : text);
  }
  return parts.join('\n');
};

const toSortParam = (sort: 'relevance' | 'pub_date') => (sort === 'pub_date' ? 'pub+date' : 'relevance');

export const pubmedSearchPmids = async ({
  query,
  retmax = 20,
  sort = 'relevance',
  throttleMs = 340,
}: {
  query: string;
  retmax?: number;
  sort?: 'relevance' | 'pub_date';
  throttleMs?: number;
}): Promise<PubmedSearchResult> => {
  if (throttleMs > 0) await delay(throttleMs);
  const clamped = Math.max(1, Math.min(200, retmax));
  const url = buildEutilsUrl('esearch.fcgi', {
    db: 'pubmed',
    term: query,
    retmode: 'json',
    retmax: String(clamped),
    sort: toSortParam(sort),
  });

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PubMed esearch failed (${response.status}): ${text || response.statusText}`);
  }
  const data = (await response.json()) as any;
  const pmids = Array.isArray(data?.esearchresult?.idlist) ? (data.esearchresult.idlist as string[]) : [];
  const count = Number(data?.esearchresult?.count ?? 0);
  return {
    query,
    pmids,
    count: Number.isFinite(count) ? count : pmids.length,
  };
};

export const pubmedFetchSummary = async (pmids: string[], throttleMs = 340): Promise<PubmedSummary[]> => {
  const unique = Array.from(new Set(pmids.filter(Boolean)));
  if (unique.length === 0) return [];

  const batches = chunk(unique, 200);
  const results: PubmedSummary[] = [];

  for (const batch of batches) {
    if (throttleMs > 0) await delay(throttleMs);
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
        fullJournalName: typeof record.fulljournalname === 'string' ? record.fulljournalname : undefined,
        authors: Array.isArray(record.authors)
          ? record.authors
              .map((author: any) => (typeof author?.name === 'string' ? author.name : ''))
              .filter(Boolean)
          : undefined,
        doi: typeof record.elocationid === 'string' ? record.elocationid : undefined,
      });
    }
  }

  return results;
};

export const pubmedFetchAbstracts = async (pmids: string[], throttleMs = 340): Promise<PubmedAbstractRecord[]> => {
  const unique = Array.from(new Set(pmids.filter(Boolean)));
  if (unique.length === 0) return [];

  const batches = chunk(unique, 80);
  const results: PubmedAbstractRecord[] = [];

  for (const batch of batches) {
    if (throttleMs > 0) await delay(throttleMs);
    const url = buildEutilsUrl('efetch.fcgi', {
      db: 'pubmed',
      id: batch.join(','),
      retmode: 'xml',
    });
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`PubMed efetch failed (${response.status}): ${text || response.statusText}`);
    }
    const xml = await response.text();
    const articles = xml.match(/<PubmedArticle\b[\s\S]*?<\/PubmedArticle>/gi) || [];

    for (const article of articles) {
      const pmid = extractTag(article, 'PMID');
      if (!pmid) continue;
      const title = extractTag(article, 'ArticleTitle');
      const journal = extractJournalTitle(article) || extractTag(article, 'ISOAbbreviation');
      const year = extractYear(article);
      const abstract = extractAbstract(article);

      results.push({
        pmid,
        title: title || undefined,
        journal: journal || undefined,
        year: year || undefined,
        abstract: abstract || undefined,
      });
    }
  }

  return results;
};

export const pubmedFindSimilar = async (pmid: string, retmax = 20, throttleMs = 340): Promise<string[]> => {
  if (throttleMs > 0) await delay(throttleMs);
  const url = buildEutilsUrl('elink.fcgi', {
    dbfrom: 'pubmed',
    db: 'pubmed',
    id: pmid,
    linkname: 'pubmed_pubmed',
    retmode: 'json',
  });

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PubMed elink failed (${response.status}): ${text || response.statusText}`);
  }
  const data = (await response.json()) as any;
  const linksets = Array.isArray(data?.linksets) ? data.linksets : [];
  const links: string[] = [];
  for (const linkset of linksets) {
    const dbs = Array.isArray(linkset?.linksetdbs) ? linkset.linksetdbs : [];
    for (const db of dbs) {
      const items = Array.isArray(db?.links) ? db.links : [];
      for (const item of items) {
        links.push(String(item));
        if (links.length >= retmax) return links;
      }
    }
  }
  return links.slice(0, retmax);
};
