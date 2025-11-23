
import { Project, Reference } from '../types';
import { getBibliographyOrder, compileText } from '../utils/citationUtils';

export const exportProjectToWord = (project: Project) => {
  const { title, manuscriptMetadata, sections, references, figures } = project;
  const { authors, affiliations } = manuscriptMetadata;

  // 1. Calculate References Order based on text appearance
  const refOrder = getBibliographyOrder(sections);
  const usedReferences = refOrder
    .map(id => references.find(r => r.id === id))
    .filter(Boolean) as Reference[];

  // 2. Build Title Page HTML
  // Author mapping logic to link superscripts
  let authorHtml = '';
  
  authors.forEach((author, index) => {
    // Find affiliation indices (1-based)
    const affIndices = author.affiliationIds
        .map(id => affiliations.findIndex(a => a.id === id) + 1)
        .filter(idx => idx > 0)
        .join(',');
        
    authorHtml += `
      <span class="author">
        ${author.firstName} ${author.lastName}${affIndices ? `<sup>${affIndices}</sup>` : ''}${author.isCorresponding ? '*' : ''}
      </span>${index < authors.length - 1 ? ', ' : ''}
    `;
  });

  const affiliationsHtml = affiliations.map((aff, index) => `
    <div class="affiliation">
      <sup>${index + 1}</sup> ${aff.department ? aff.department + ', ' : ''}${aff.institution}${aff.city ? ', ' + aff.city : ''}${aff.country ? ', ' + aff.country : ''}
    </div>
  `).join('');

  const correspondingHtml = authors.find(a => a.isCorresponding) 
    ? `<div class="corresponding">
         * Corresponding Author: ${authors.find(a => a.isCorresponding)?.email || 'N/A'}
       </div>`
    : '';

  // 3. Build Sections HTML
  const sectionsHtml = sections.map(section => {
    // Compile text to replace [[ref:uuid]] with [1-3]
    const compiledContent = compileText(section.content, refOrder);
    
    // Convert newlines to paragraphs
    const paragraphs = compiledContent.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');

    return `
      <div class="section">
        <h2>${section.title}</h2>
        ${paragraphs}
      </div>
    `;
  }).join('<hr class="section-break" />');

  // 4. Build Bibliography HTML
  const bibliographyHtml = usedReferences.length > 0 
    ? `
      <div class="section references">
        <h2>References</h2>
        <ol>
          ${usedReferences.map(ref => `
            <li>
              ${ref.authors} (${ref.year}). ${ref.title}. <i>${ref.publication}</i>. ${ref.doi ? `DOI: ${ref.doi}` : ''}
            </li>
          `).join('')}
        </ol>
      </div>
    `
    : '';
    
  // 5. Build Figures HTML
  const figuresHtml = figures.length > 0
    ? `
      <div class="section figures">
        <h2>Figures</h2>
        ${figures.map((fig, i) => `
          <div class="figure-container">
             <img src="${fig.base64}" alt="${fig.prompt}" width="500" />
             <p class="figure-caption"><strong>Figure ${i+1}.</strong> ${fig.prompt}</p>
          </div>
        `).join('')}
      </div>
    `
    : '';

  // 6. Assemble Full Document
  const docContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title}</title>
      <style>
        @page Section1 {
            size:8.5in 11.0in; 
            margin:1.0in 1.0in 1.0in 1.0in; 
            mso-header-margin:0.5in; 
            mso-footer-margin:0.5in; 
            mso-paper-source:0;
        }
        div.Section1 {page:Section1;}
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
        h1 { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 24pt; }
        h2 { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 12pt; }
        p { margin-bottom: 12pt; text-align: justify; }
        .title-page { text-align: center; margin-bottom: 3em; }
        .author-list { margin-bottom: 1em; font-size: 12pt; }
        .affiliation-list { margin-bottom: 2em; font-size: 10pt; font-style: italic; }
        .corresponding { margin-top: 1em; font-size: 10pt; }
        .section-break { border: 0; display: none; } /* Word treats divs as blocks anyway */
        img { max-width: 100%; height: auto; }
        .figure-container { page-break-inside: avoid; margin-bottom: 2em; text-align: center; }
        .figure-caption { text-align: left; margin-top: 0.5em; font-size: 11pt; }
      </style>
    </head>
    <body>
      <div class="Section1">
        <div class="title-page">
           <h1>${title}</h1>
           <div class="author-list">${authorHtml}</div>
           <div class="affiliation-list">${affiliationsHtml}</div>
           ${correspondingHtml}
        </div>
        
        <br style="page-break-before:always" />
        
        ${sectionsHtml}
        
        <br style="page-break-before:always" />
        
        ${bibliographyHtml}
        
        <br style="page-break-before:always" />
        
        ${figuresHtml}
      </div>
    </body>
    </html>
  `;

  // 7. Trigger Download
  const blob = new Blob(['\ufeff', docContent], {
    type: 'application/msword'
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'manuscript'}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
