---
name: pubmed-manuscript-scraper
description: Search PubMed via NCBI E-utilities and export manuscript-ready abstract references. Use when Codex needs to find relevant medical literature with structured filters (year range, publication type, language, journal, inclusion/exclusion logic), fetch article metadata/abstracts (PMID, title, journal, publication year/date, DOI, authors), and generate reference documents for both users and models.
---

# PubMed Manuscript Scraper

Use this skill to run deterministic PubMed searches and produce reusable reference packs.

## Workflow
1. Build a focused base query with topic terms (prefer `[tiab]` and/or MeSH where appropriate).
2. Add parameterized filters for year, article type, language, journal, and exclusions.
3. Run `scripts/pubmed_scraper.py` to execute `esearch` + `efetch`.
4. Save and use generated reference files (`.json`, `.md`, `.context.md`).

## Command
```bash
python3 skills/pubmed-manuscript-scraper/scripts/pubmed_scraper.py \
  --query "(sepsis[tiab] AND norepinephrine[tiab])" \
  --year-from 2020 \
  --year-to 2026 \
  --article-type "Randomized Controlled Trial" \
  --article-type "Meta-Analysis" \
  --language english \
  --exclude-case-reports \
  --exclude-animal-only \
  --retmax 25 \
  --sort relevance \
  --output-dir ./tmp/pubmed \
  --output-prefix sepsis_vasoactive
```

## Parameter Guidance
- Use `--year-from` and `--year-to` for publication year bounds.
- Repeat `--article-type` for multiple publication types (`[pt]`).
- Use `--language english` for language filters (`[lang]`).
- Use `--journal "Journal Name"` for journal-specific searches (`[jour]`).
- Use `--humans-only` and `--exclude-animal-only` when animal studies should be filtered.
- Use `--must-include` / `--must-exclude` for custom tagged fragments, e.g. `--must-include "double blind[tiab]"`.
- Keep `--retmax` within `1..200`.
- Set `NCBI_API_KEY`, `NCBI_EMAIL`, and optionally `NCBI_TOOL` in env for better rate limits and traceability.

## Outputs
The script writes three reference documents:
- `<prefix>.json`: full structured machine-readable record list.
- `<prefix>.md`: human-readable citation + abstract pack.
- `<prefix>.context.md`: compact model-ingestion context file.

Use these files to cite papers, review abstracts, and feed curated references back into drafting/review workflows.

## Notes
- Prefer API-backed runs over manual scraping.
- Keep query logic explicit; do not hide inclusion/exclusion criteria.
- Read `references/pubmed-eutils-reference.md` for field-tag examples and endpoint references.
