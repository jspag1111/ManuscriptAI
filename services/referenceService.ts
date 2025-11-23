
import { Reference } from '../types';

export const importReferenceMetadata = async (query: string): Promise<Partial<Reference> | null> => {
  const input = query.trim();
  const isDOI = input.includes('10.') && input.includes('/');
  const isPMID = /^\d+$/.test(input);

  try {
    if (isDOI) {
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(input)}`);
      if (response.ok) {
        const data = await response.json();
        const item = data.message;
        const authors = item.author?.map((a: any) => `${a.family} ${a.given || ''}`).join(", ") || "";
        let abstract = item.abstract || "";
        abstract = abstract.replace(/<[^>]*>?/gm, ''); 

        return {
          title: item.title?.[0] || "",
          authors: authors,
          year: item.published?.['date-parts']?.[0]?.[0]?.toString() || "",
          publication: item['container-title']?.[0] || "",
          doi: input,
          abstract: abstract
        };
      }
    } else if (isPMID) {
      const response = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${input}&retmode=xml`);
      if (response.ok) {
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        const article = xml.querySelector("PubmedArticle");
        
        if (article) {
          const title = article.querySelector("ArticleTitle")?.textContent || "";
          const abstractTexts = article.querySelectorAll("AbstractText");
          const abstractText = Array.from(abstractTexts).map(node => {
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

          return { title, authors, year, publication: journal, doi, abstract: abstractText };
        }
      }
    }
  } catch (error) {
    console.error("Reference Fetch Error:", error);
    return null;
  }
  return null;
};
