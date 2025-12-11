import { Section } from '@/types';

// Regex to find a single citation marker [[ref:uuid]]
export const CITATION_REGEX = /\[\[ref:([a-zA-Z0-9-]+)\]\]/g;

// Regex to find sequences of markers to group them (e.g. "[[ref:a]] [[ref:b]]")
// Matches one or more markers separated by optional whitespace, commas, or semicolons
export const CITATION_SEQUENCE_REGEX = /(\[\[ref:[^\]]+\]\](?:\s*[,;]?\s*\[\[ref:[^\]]+\]\])*)/g;

/**
 * Scans all sections to determine the order of references as they appear in the text.
 * Returns an array of Reference IDs.
 */
export const getBibliographyOrder = (sections: Section[]): string[] => {
  const order: string[] = [];
  // Join all content to scan sequentially
  const content = sections.map(s => s.content).join('\n');
  
  const matches = content.matchAll(CITATION_REGEX);
  
  for (const m of matches) {
      const id = m[1];
      if (!order.includes(id)) {
          order.push(id);
      }
  }
  return order;
};

/**
 * Formats a list of numbers into ranges (e.g. [1, 2, 3, 5] -> "[1-3, 5]")
 */
export const formatCitationRanges = (numbers: number[]): string => {
  if (numbers.length === 0) return '';
  
  // Sort numerically
  const sorted = [...numbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  
  let start = sorted[0];
  let end = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  
  return `[${ranges.join(', ')}]`;
};

/**
 * Replaces citation markers in text with formatted numbers based on the provided order.
 */
export const compileText = (text: string, refOrder: string[]): string => {
  return text.replace(CITATION_SEQUENCE_REGEX, (match) => {
    // 'match' is a chunk like "[[ref:1]] [[ref:2]]"
    const ids: string[] = [];
    
    // Extract all IDs from this chunk
    const chunkMatches = match.matchAll(/\[\[ref:([a-zA-Z0-9-]+)\]\]/g);
    for (const m of chunkMatches) {
        ids.push(m[1]);
    }

    // Map IDs to their 1-based index in the bibliography order
    const numbers = ids
      .map(id => refOrder.indexOf(id) + 1)
      .filter(n => n > 0); 
      
    if (numbers.length === 0) return match; 
    
    const uniqueNumbers = Array.from(new Set(numbers));
    
    return formatCitationRanges(uniqueNumbers);
  });
};

/**
 * Converts raw content string to HTML for the editor, rendering citations as pills.
 */
export const contentToHtml = (content: string, refOrder: string[], renderCitations: boolean = true): string => {
  if (!content) return '';
  
  // 1. Basic HTML escaping
  let html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Replace citation clusters with styled spans if enabled
  if (renderCitations) {
    html = html.replace(CITATION_SEQUENCE_REGEX, (match) => {
      const ids: string[] = [];
      const chunkMatches = match.matchAll(/\[\[ref:([a-zA-Z0-9-]+)\]\]/g);
      for (const m of chunkMatches) {
          ids.push(m[1]);
      }
      
      // Calculate label [1-3]
      const numbers = ids.map(id => refOrder.indexOf(id) + 1).filter(n => n > 0);
      const uniqueNumbers = Array.from(new Set(numbers));
      const label = uniqueNumbers.length > 0 ? formatCitationRanges(uniqueNumbers) : '[?]';
      
      // Create the span
      // We store the raw IDs in data attribute to allow reconstruction
      return `<span class="citation-object inline-flex items-center justify-center bg-blue-100 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 mx-0.5 text-sm font-bold select-none cursor-pointer hover:bg-blue-200 align-middle transition-colors" contenteditable="false" data-ids="${ids.join(',')}">${label}</span>`;
    });
  }
  
  return html;
}

/**
 * Parses the HTML from the contentEditable div back into the raw storage format.
 */
export const htmlToContent = (element: HTMLElement): string => {
   let text = '';
   
   const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.classList.contains('citation-object')) {
              // Reconstruct the [[ref:id]] markers
              const ids = el.getAttribute('data-ids')?.split(',') || [];
              text += ids.map(id => ` [[ref:${id}]]`).join('');
          } else if (el.tagName === 'BR') {
              text += '\n';
          } else if (el.tagName === 'DIV') {
              // Divs in contentEditable usually represent block breaks (newlines)
              text += '\n';
              node.childNodes.forEach(walk);
          } else {
              node.childNodes.forEach(walk);
          }
      }
   };
   
   element.childNodes.forEach(walk);
   return text; 
}
