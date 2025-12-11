## 2025-12-10 23:40 EST
- (Commit: Fix Vercel runtime detection) Added a repository `vercel.json` so deployments explicitly use the Next.js framework with `.next` as the output directory, and reverted the temporary `distDir` override to restore the expected server output; verified with `npm run build` and `npm run test`.

## 2025-12-10 23:15 EST
- (Commit: Fix Vercel dist directory error) Configured Next.js to emit its build artifacts to a `dist` directory so the existing Vercel project settings detect the output, keeping the standalone backend bundle and frontend assets aligned; verified with `npm run build` and `npm run test`.

## 2025-12-09 23:09 EST
    15 +- Typed SQLite seed/query results to keep the persisted project data flow aligned between th
        e backend store and frontend normalization.
    16 +- Aligned the Vitest/Vite toolchain (move to Vite 5.x, set v8 coverage provider) to resolve
        plugin type conflicts; regenerated lockfile and typed-routes import in `next-env.d.ts`.
    17 +- Verified `npm run build` and `npm run test` complete without errors.

## 2025-12-09 22:55 EST
- (Commit: Fix typed route params for Next.js 16) Updated the projects DELETE API handler to use the Next.js 16 typedRoutes request/context signature and moved `typedRoutes` out of `experimental` in `next.config.mjs` to satisfy Vercel builds.

## 2025-12-08 22:10 EST
- (Commit: Fix missing Info icon in sidebar) Added the missing `Info` icon import to the Manuscript workspace sidebar to resolve the runtime reference error when opening a project.

## 2025-12-08 22:02 EST
- (Commit: Migrate to Next.js with Tailwind and shared API) Migrated the app to Next.js 16 with the App Router, Tailwind CSS, and a new `src/app` structure while keeping the manuscript UI intact.
- Replaced the Express server with Next.js API route handlers backed by the shared SQLite store and normalization helpers so the frontend and backend defaults stay aligned.
- Added shared project normalization utilities plus a new Vitest suite (including a normalization test) and refreshed the Vitest config for the Next.js setup.
- Updated tooling and docs (Next/Tailwind configs, ESLint, README) for the new stack and verified `npm test` passes after the migration.

## 2025-12-09 23:09 EST
- (Commit: Fix build errors and align vitest tooling) Fixed the figure replacement input ref and version snapshot typing so Next.js/TypeScript builds complete successfully.
- Typed SQLite seed/query results to keep the persisted project data flow aligned between the backend store and frontend normalization.
- Aligned the Vitest/Vite toolchain (move to Vite 5.x, set v8 coverage provider) to resolve plugin type conflicts; regenerated lockfile and typed-routes import in `next-env.d.ts`.
- Verified `npm run build` and `npm run test` complete without errors.

## 2025-12-06 17:22 EST
- (Commit: Add Gemini fallback for drafting and refine) Added a shared Gemini generation helper that automatically falls back to gemini-2.5-flash when the pro model hits quota/permission limits so the Regenerate Draft and refine-in-place tools stop erroring; logged fallback attempts for visibility and kept API prompts unchanged.
- Verified `npm run test` still passes after the update.

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
- Added server/seed npm scripts, new dependencies, and refreshed storageService tests (all passing).
