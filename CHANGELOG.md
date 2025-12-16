## 2025-12-15 22:27 EST
- (Commit: codex/fix-comment-bubble-init-crash) Fixed a runtime crash when opening projects where comment bubble widgets tried to compute screen coordinates before ProseMirror finished initializing its DOM view.

## 2025-12-15 22:19 EST
- (Commit: codex/comment-bubbles-ux) Changed comment rendering so comment ranges are only highlighted when the Comments panel is open; when closed, show small margin bubbles on the referenced line that can be clicked to open/select the thread and jump to the text.

## 2025-12-15 16:12 EST
- (Commit: codex/inline-comments-panel) Added inline text comments with a selection toolbar (AI + comment actions), a right-side Comments panel (with mobile drawer), threaded replies, resolve/reopen, and Open/Resolved/All filters.
- Added comment highlighting in the editor plus comment-linked tracked-edit attribution (Change panel shows a Comment badge when an edit is related to a comment).
- Added “Address with AI” on comment threads to propose tracked edits using the selected text + comment thread context, and persisted comment threads (including resolve metadata and AI links) into section version snapshots/restores.

## 2025-12-15 15:06 EST
- (Commit: codex/change-panel-focus-and-llm-request) Added click-to-focus in the Edits panel so selecting an edit highlights (and scrolls to) the exact tracked-change spans it produced.
- Added optional persisted LLM request text on tracked change events, with a compact preview + modal viewer in the Edits panel.

## 2025-12-14 01:45 EST
- (Commit: codex/prosemirror-ai-selection-refine) Fixed click-drag selection + AI refine in the ProseMirror editor to preserve multi-paragraph selections and citation atoms by applying replacements as ProseMirror slices (not raw text insertion).

## 2025-12-14 01:34 EST
- (Commit: codex/version-history-tracked-edits) Added per-version tracked-edit snapshots (base content + change events) so Version History can replay highlights + attribution relative to the document each version started from.
- Fixed AI-apply flows to persist LLM-attributed change events reliably (so tracked edits survive navigation/reload).

## 2025-12-14 01:01 EST
- (Commit: codex/prosemirror-track-changes) Added a ProseMirror section editor with persisted edit-attribution (Clerk user + LLM model) plus a highlight toggle + change panel.
- Added ProseMirror-native in-text citation rendering (atomic citation nodes with formatted numbering, raw marker display, and clipboard-safe serialization).
- Changed AI draft/refine review to a ProseMirror-based overlay that previews and applies edits as tracked changes (replacing the legacy diff viewer).
- Added a local DB toggle (`MANUSCRIPTAI_DB_TARGET=local`) to test against `data/projects.sqlite` while keeping Turso configuration intact.

## 2025-12-12
- Fixed UI layout to reduce side margins and optimize working space.
- Merged section title and "last saved" info into the section notes card.
- Added collapsible functionality to the Section Info card, allowing users to hide details while keeping actions visible.
- Refactored Section Editor to allow full sidebar toggling. Actions (History, New Version, Save) are now accessible via the editor toolbar.

## 2025-12-11
- Improved diff computation to group substitutions into cohesive delete/insert blocks with better whitespace handling so change reviews read closer to Word-style track changes across sections and version history views.
- Added unit coverage for the diff utility to lock in the new grouped highlighting behavior.
- Adjusted the project header to wrap long manuscript titles gracefully on small screens while keeping the card layout intact.
- Refined the version history view with a responsive layout, wider readable content pane, and softer panel styling for easier review on mobile.
- Rounded the main section editor card and clipped overflow so the writing surface matches the rest of the workspace styling.
- Restyled the authentication, landing, and workspace shells with modern gradients, glassy cards, and responsive layouts for desktop, tablet, and mobile.
- Refreshed the project dashboard and in-app sidebar to feel more polished, with clearer hierarchy, quick actions, and improved section navigation.
- Added a collapsible Gemini drafter card inside each section so AI generation stays hidden until toggled, while keeping save/version controls always available.

## 2025-12-10
- Fixed linting for Next.js 16/ESLint 9 by switching to a flat config, updating the lint script to use `eslint .`, and addressing new rule violations (history viewer state reset, icon alt warning, metadata copy escaping, RichEditor handler order, SectionEditor effect deps) so `npm run lint` runs cleanly again.
- Added Clerk authentication (App Router) with middleware proxy, layout provider, sign-in/up routes, and UI gating plus Google SSO support guidance; API routes now require the current Clerk user and scope Turso records by user ID.
- Moved project persistence to Turso via `@libsql/client`, keeping the existing schema and async API handlers aligned with Next.js 16 server routes.
- Added `scripts/migrate-to-turso.mjs` to upsert all projects from `data/projects.sqlite` into the configured Turso database before switching environments.
- Documented the new Turso env vars and migration flow in `README.md`.
- Migration script now auto-loads `.env.local` via `@next/env` so locally defined Turso credentials are picked up without manual exporting.
- Scoped seeded projects to a configured Clerk user (`SEED_PROJECT_OWNER_ID`/`DEFAULT_PROJECT_OWNER_ID`) to prevent example data from appearing on new accounts, updated queries to return only owned projects, and added a backfill script to reclaim orphaned seed rows. Documented the env and script usage in `README.md`.

## [2024-03-21]

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
