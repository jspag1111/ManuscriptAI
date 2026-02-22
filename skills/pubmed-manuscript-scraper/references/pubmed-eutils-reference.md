# PubMed E-utilities Reference

Use this note when crafting PubMed queries for `scripts/pubmed_scraper.py`.

## Key API Endpoints
- `esearch.fcgi`: search PMIDs from a query string.
- `efetch.fcgi`: fetch PubMed article details and abstracts for PMIDs.

## Common Query Field Tags
- `[tiab]`: title/abstract terms.
- `[pt]`: publication type (article type).
- `[lang]`: language.
- `[jour]`: journal name.
- `[mh]`: MeSH heading.
- `[dp]` or `Date - Publication`: publication date filtering.

## Useful Filters
- Year range: `("2019"[Date - Publication] : "2025"[Date - Publication])`
- Article types: `("Randomized Controlled Trial"[pt] OR "Meta-Analysis"[pt])`
- English only: `english[lang]`
- Humans only: `humans[mh]`
- Exclude animal-only papers: `NOT (animals[mh] NOT humans[mh])`
- Exclude case reports: `NOT ("Case Reports"[pt])`

## CLI Mapping
- `--year-from` + `--year-to` => `Date - Publication` range filter.
- `--article-type` (repeatable) => `[pt]` OR block.
- `--language` => `[lang]`.
- `--journal` => `[jour]`.
- `--humans-only` => `humans[mh]`.
- `--exclude-case-reports` => `NOT ("Case Reports"[pt])`.
- `--exclude-animal-only` => `NOT (animals[mh] NOT humans[mh])`.
- `--must-include` / `--must-exclude` => appended raw query fragments.

## Sources
- E-utilities documentation (NCBI Bookshelf): https://www.ncbi.nlm.nih.gov/books/NBK25499/
- PubMed search field descriptions: https://pubmed.ncbi.nlm.nih.gov/help/#search-field-descriptions-and-tags
- ESearch API endpoint: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
- EFetch API endpoint: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi
