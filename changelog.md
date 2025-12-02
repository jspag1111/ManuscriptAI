## 2025-12-01 22:32 EST
- Added shared text metrics utilities plus an include-in-counts flag for sections to persist selection state.
- Updated the Section Editor footer to show words, characters with spaces, and characters without spaces for each section.
- Introduced a sidebar project totals panel with inclusion checkboxes and hooked it into the new global word/character counts (vitest suite still green).

## 2025-12-01 21:58 EST
- Added an Express + SQLite API layer that seeds from example_data.json and persists projects locally.
- Updated storage service/App flow to use the API instead of localStorage, with loading/error handling.
- Added server/seed npm scripts, new dependencies, and refreshed storageService tests (all passing).
