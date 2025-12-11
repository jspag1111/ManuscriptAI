<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ManuscriptAI (Next.js)

Next.js 16 app for drafting and managing research manuscripts with AI-assisted tooling (Gemini), inline citation handling, figure/table management, and DOCX export. A built-in SQLite store keeps the UI and API in sync, and the project is wired for modern managed backends (Turso/Supabase) and auth (Clerk) via environment-driven API endpoints.

## Tech Stack
- Next.js App Router + React 19, Tailwind CSS for styling
- SQLite (better-sqlite3) with server route handlers at `/api/projects`
- Google Gemini client utilities for drafting, selection refinement, and search assistance
- Testing: Vitest + Testing Library (jsdom)

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   - `NEXT_PUBLIC_GEMINI_API_KEY` for Gemini-powered features
   - Optional: `NEXT_PUBLIC_API_BASE` if pointing the client to a remote API (e.g., Turso/Supabase edge function proxy).
3. **Run the app**
   ```bash
   npm run dev
   ```
   - API routes: `http://localhost:3000/api/projects`
   - Data lives in `data/projects.sqlite` (auto-created and seeded from `example_data*.json` if empty).

## Scripts
- `npm run dev` – start Next.js in dev mode
- `npm run build` – production build
- `npm start` – run the production server
- `npm run lint` – Next/ESLint checks
- `npm test` – Vitest suite (jsdom + Testing Library)

## Notes
- The client uses `/api/projects` by default; override with `NEXT_PUBLIC_API_BASE` to point at hosted APIs (Turso, Supabase functions, Clerk-protected endpoints, etc.).
- DOCX export and figure upload are purely client-side; data persistence is handled through the SQLite-backed API.
- The database is stored under `data/` so it can be mounted or swapped out when deploying.
