## 2025-12-01 21:58 EST
- Added an Express + SQLite API layer that seeds from example_data.json and persists projects locally.
- Updated storage service/App flow to use the API instead of localStorage, with loading/error handling.
- Added server/seed npm scripts, new dependencies, and refreshed storageService tests (all passing).
