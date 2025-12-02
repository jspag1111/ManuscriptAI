## 2025-12-01 23:22 EST
- Removed the unused AI figure generator panel, expanded figure cards with on-card replacement inputs plus full-size previews, and introduced a modal viewer so manual uploads are easier to inspect and edit without deleting an entry.

## 2025-12-01 23:15 EST
- Fixed a Vite build error in `exportService` by removing stray escaped template literals inside the DOCX figure-caption builder so the app starts cleanly again.

## 2025-12-01 22:57 EST
- Rebuilt the Figures tool so users can upload existing figures/tables, title/label them, add captions, toggle caption word-count inclusion, and manage the metadata inline alongside AI-generated assets.
- Added figure/table caption contributions to the global word/character totals with sidebar toggles, and persisted the new metadata through the storage service plus SQLite backend normalization.
- Updated the DOCX export builder to emit the richer figure/table captions (including manual uploads with optional images) so generated documents stay in sync with the new workflow.

## 2025-12-01 22:32 EST
- Added shared text metrics utilities plus an include-in-counts flag for sections to persist selection state.
- Updated the Section Editor footer to show words, characters with spaces, and characters without spaces for each section.
- Introduced a sidebar project totals panel with inclusion checkboxes and hooked it into the new global word/character counts (vitest suite still green).

## 2025-12-01 21:58 EST
- Added an Express + SQLite API layer that seeds from example_data.json and persists projects locally.
- Updated storage service/App flow to use the API instead of localStorage, with loading/error handling.
- Added server/seed npm scripts, new dependencies, and refreshed storageService tests (all passing).
