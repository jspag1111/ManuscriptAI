import { Reference, PaperSearchResult } from '../types';

// Helper to parse XML article
const parsePubMedXml = (article: Element): PaperSearchResult => {
    const pmid = article.querySelector("MedlineCitation > PMID")?.textContent || "";
    const title = article.querySelector("ArticleTitle")?.textContent || "";
    
    const abstractTexts = article.querySelectorAll("AbstractText");
    const abstract = Array.from(abstractTexts).map(node => {
      const label = node.getAttribute("Label");
      return label ? `${label}: ${node.textContent}` : node.textContent;
    }).join("\n\n");

    const year = article.querySelector("PubDate Year")?.textContent || article.querySelector("PubDate MedlineDate")?.textContent || "";
    const journal = article.querySelector("Journal Title")?.textContent || article.querySelector("Journal ISOAbbreviation")?.textContent || "";
    
    const authorList = article.querySelectorAll("Author");
    const authors = Array.from(authorList).map(a => {
      const last = a.querySelector("LastName")?.textContent || "";
      const fore = a.querySelector("ForeName")?.textContent || "";
      return `${last} ${fore}`.trim();
    }).join(", ");
    
    const doi = article.querySelector('ArticleId[IdType="doi"]')?.textContent || "";

    const pubTypes = Array.from(article.querySelectorAll("PublicationTypeList PublicationType"))
      .map(n => n.textContent || '')
      .filter(t => t && t.toLowerCase() !== 'journal article'); 
    
    const articleType = pubTypes.join(", ");

    return {
        title,
        pmid,
        authors,
        year,
        doi,
        abstract,
        articleType,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        publication: journal
    };
};

export const searchPubMed = async (term: string): Promise<string[]> => {
  try {
    const encoded = encodeURIComponent(term);
    const response = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&retmode=json&retmax=20`,
      { mode: 'cors', credentials: 'omit' }
    );
    if (response.ok) {
        const data = await response.json();
        return data.esearchresult?.idlist || [];
    }
  } catch (e) {
      console.error("PubMed Search Error:", e);
  }
  return [];
};

export const fetchBatchReferenceMetadata = async (pmids: string[]): Promise<PaperSearchResult[]> => {
    if (pmids.length === 0) return [];
    const idString = pmids.join(',');
    
    try {
      const response = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${idString}&retmode=xml`,
        { mode: 'cors', credentials: 'omit' }
      );
      
      if (response.ok) {
          const text = await response.text();
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, "text/xml");
          const articles = Array.from(xml.querySelectorAll("PubmedArticle"));
          return articles.map(parsePubMedXml);
      }
    } catch (e) {
        console.error("Batch Fetch Error", e);
    }
    return [];
};

export const importReferenceMetadata = async (query: string): Promise<Partial<Reference> | null> => {
  const input = String(query).trim();
  const isDOI = input.includes('10.') && input.includes('/');
  const isPMID = /^\d+$/.test(input);

  try {
    if (isDOI) {
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(input)}`, {
        mode: 'cors',
        credentials: 'omit'
      });
      if (response.ok) {
        const data = await response.json();
        const item = data.message;
        const authors = item.author?.map((a: any) => `${a.family} ${a.given || ''}`).join(", ") || "";
        let abstract = item.abstract || "";
        abstract = abstract.replace(/<[^>]*>?/gm, ''); 

        const type = item.type ? item.type.replace('-', ' ') : '';

        return {
          title: item.title?.[0] || "",
          authors: authors,
          year: item.published?.['date-parts']?.[0]?.toString() || "",
          publication: item['container-title']?.[0] || "",
          doi: input,
          abstract: abstract,
          articleType: type
        };
      }
    } else if (isPMID) {
        const results = await fetchBatchReferenceMetadata([input]);
        if (results.length > 0) {
            const r = results[0];
            return {
                title: r.title,
                authors: r.authors,
                year: r.year,
                publication: r.publication, 
                doi: r.doi,
                abstract: r.abstract,
                articleType: r.articleType
            };
        }
    }
  } catch (error) {
    console.error("Reference Fetch Error:", error);
    return null;
  }
  return null;
};