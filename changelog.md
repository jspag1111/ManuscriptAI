## 2026-02-18
- Added a database adapter that automatically uses Turso when `TURSO_DATABASE_URL` is set and falls back to local SQLite otherwise.
- Created a sync script to upsert local SQLite projects into Turso for easy migration.
- Documented database configuration and sync workflow in the README.

## 2025-12-01 21:58 EST
- Added an Express + SQLite API layer that seeds from example_data.json and persists projects locally.
- Updated storage service/App flow to use the API instead of localStorage, with loading/error handling.
- Added server/seed npm scripts, new dependencies, and refreshed storageService tests (all passing).
