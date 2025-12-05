## 2025-12-05 17:30 EST
- Added a Supabase connectivity verifier script (`npm run supabase:verify`) that checks schema provisioning and service-role read access to the projects table so deployments can confirm credentials are working (**commit:** "Add Supabase connectivity verification utility").

## 2025-12-05 16:20 EST
- Auto-provision the Supabase `projects` table (with anon read policy) using the provided Postgres connection string before seed or API operations and document the required connection env var alongside existing Supabase keys (**commit:** "Auto-provision Supabase projects table on startup").

## 2025-12-05 15:49 EST
- Swapped the local SQLite layer for Supabase-backed project persistence, updated the API/server wrappers, and added Supabase-focused unit tests plus documentation for required environment variables (**commit:** "Adopt Supabase-backed project storage and tests").

## 2025-12-05 11:30 EST
- Documented the Vercel build output for the Next.js app so deployments look for the correct directory (**commit:** "Add Vercel configuration for Next.js deployment").

## 2025-12-05 09:39 EST
- Migrate the UI from Vite to the Next.js App Router with Tailwind CSS, shared SQLite API routes, and Supabase client scaffolding (**commit:** "Migrate UI from Vite to Next.js with shared API").

## 2025-12-02 01:19 EST
- Simplified diff views to a single unified style without LLM vs user attribution or legends, keeping standard additions/removals highlighting only.
- Swapped the toolbar placement so “Insert Citation” sits with formatting controls and “Show/Hide Diff” lives on the right side of the editor header.

## 2025-12-02 01:07 EST
- Fixed diff attribution so user-typed text is not mislabeled as LLM output by favoring user changes when tokens overlap and tracking counts per change.
- Updated the working draft diff toggle to read “Show Diff”/“Hide Diff” and added an inline hide control when viewing the diff.
- **Still have errors**

## 2025-12-01 23:53 EST
- Added a working-draft diff toggle that highlights LLM vs user edits, plus a “Start New Version” action to snapshot the current draft and reset the diff baseline.
- Extended version history with per-version diff toggles, source badges, and color-coded changes so each version can be compared against its predecessor.
- Persisted new version metadata (baselines, last LLM output, sources) through the client normalization and SQLite API to keep frontend and backend in sync.
***Errors with diff highlighting when user edits match LLM output remain; investigating a fix.***

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
## 2025-12-05 17:00 EST
- Handle Supabase SSL errors and guard Node runtime: add optional Postgres CA/reject flags for self-signed certificates, set the
  TLS fallback to allow Supabase provisioning in Vercel previews, and gate app entrypoints with a Node version check script.

