<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ManuscriptAI (Next.js)

Next.js 16 app for drafting and managing research manuscripts with AI-assisted tooling (Gemini), inline citation handling, figure/table management, and DOCX export. A Turso (libSQL) store keeps the UI and API in sync, and the project is wired for modern managed backends (Clerk coming soon) via environment-driven API endpoints.

## Tech Stack
- Next.js App Router + React 19, Tailwind CSS for styling
- Turso (libSQL via `@libsql/client`) with server route handlers at `/api/projects`
- Google Gemini client utilities for drafting, selection refinement, and search assistance
- Testing: Vitest + Testing Library (jsdom)

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   - `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for the Turso database (required for dev + Vercel).
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` for Clerk authentication (store only in `.env.local`/Vercel env vars).
   - `NEXT_PUBLIC_GEMINI_API_KEY` for Gemini-powered features.
   - Optional: `NEXT_PUBLIC_API_BASE` if pointing the client to a remote API.
   - To enable Google login, open Clerk Dashboard → **SSO Connections** → add **Google** (dev instances use shared credentials automatically; production instances must provide your own OAuth client).
3. **Run the app**
   ```bash
   npm run dev
   ```
   - API routes: `http://localhost:3000/api/projects`
   - Data lives in Turso. If the database is empty, it will seed from `example_data*.json`.

### Migrating existing local SQLite data to Turso
If you already have data in `data/projects.sqlite`, push it to Turso before switching:
```bash
TURSO_DATABASE_URL="..." TURSO_AUTH_TOKEN="..." node scripts/migrate-to-turso.mjs
```
The script reads from `data/projects.sqlite` and upserts every project into your Turso database.

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
- Authentication is handled by Clerk (App Router). Sign-in and sign-up are available at `/sign-in` and `/sign-up`, with modal triggers in the header. All API routes enforce the signed-in user and scope data to the current Clerk user ID.
