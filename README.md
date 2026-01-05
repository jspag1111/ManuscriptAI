<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ManuscriptAI (Next.js)

Next.js 16 app for drafting and managing research manuscripts plus general writing projects with AI-assisted tooling (Gemini plus an optional OpenAI ChatKit assistant), inline citation handling, figure/table management, and DOCX export. Sections use a ProseMirror editor with persisted edit attribution (Clerk user + LLM model), plus a toggleable highlight mode for reviewing changes.

## Tech Stack
- Next.js App Router + React 19, Tailwind CSS for styling
- ProseMirror editor for section drafting + tracked edit highlights
- Turso (libSQL via `@libsql/client`) with server route handlers at `/api/projects` (or local SQLite for development)
- Google Gemini client utilities for drafting, selection refinement, and search assistance (including the PubMed Assistant chat)
- Testing: Vitest + Testing Library (jsdom)

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   - **Database (choose one):**
     - **Turso (recommended for production):** set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
     - **Local SQLite (recommended for dev/testing):** set `MANUSCRIPTAI_DB_TARGET=local` (defaults to `data/projects.sqlite`), optionally override with `MANUSCRIPTAI_LOCAL_DB_PATH`.
       - Note: if `TURSO_DATABASE_URL` is not set, the app automatically falls back to local `data/projects.sqlite`.
   - **Auth (Clerk):** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (store only in `.env.local`/Vercel env vars).
   - **LLM (Gemini default):**
     - Provider: `MANUSCRIPTAI_LLM_PROVIDER=gemini` (default).
    - Server-side key (recommended): `GEMINI_API_KEY` (used by the PubMed Discover agent and the PubMed Assistant chat).
     - Legacy/client key: `NEXT_PUBLIC_GEMINI_API_KEY` (still used by existing client-side drafting/refinement code).
     - Optional model overrides: `MANUSCRIPTAI_LLM_MODEL_FAST` and `MANUSCRIPTAI_LLM_MODEL_QUALITY`.
   - **OpenAI ChatKit (optional, for the OpenAI assistant tab):** `OPENAI_API_KEY` and `OPENAI_CHATKIT_WORKFLOW_ID`.
     - Configure the ChatKit workflow with client tools named `article_board_list`, `article_board_add`, `article_board_remove`, and `document_create` so it can read/update the shared article board and create markdown downloads.
   - **PubMed / NCBI (optional but recommended for higher rate limits):** `NCBI_API_KEY`, plus `NCBI_EMAIL` and `NCBI_TOOL` for polite usage.
   - Optional: `NEXT_PUBLIC_API_BASE` if pointing the client to a remote API.
   - To enable Google login, open Clerk Dashboard → **SSO Connections** → add **Google** (dev instances use shared credentials automatically; production instances must provide your own OAuth client).
   - Optional: `SEED_PROJECT_OWNER_ID` (or `DEFAULT_PROJECT_OWNER_ID`) to claim seeded example projects for a specific Clerk user; set this to your own user id (e.g., `user_...`) to keep seed data private.
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

### Backfilling orphaned seed projects
If you previously seeded data before enabling Clerk, assign those projects to your account so they no longer appear for new users:
```bash
SEED_PROJECT_OWNER_ID="user_abc123" node scripts/backfill-orphaned-projects.mjs
```
Replace `user_abc123` with the Clerk user id of the account that should keep the seed projects.

## Scripts
- `npm run dev` – start Next.js in dev mode
- `npm run build` – production build
- `npm start` – run the production server
- `npm run lint` – Next/ESLint checks
- `npm test` – Vitest suite (jsdom + Testing Library)

## Notes
- The client uses `/api/projects` by default; override with `NEXT_PUBLIC_API_BASE` to point at hosted APIs (Turso, Supabase functions, Clerk-protected endpoints, etc.).
- DOCX export and figure upload are purely client-side; data persistence is handled through the `/api/projects` route handlers (Turso or local SQLite).
- The local database is stored under `data/` so it can be mounted or swapped out during development.
- Authentication is handled by Clerk (App Router). Sign-in and sign-up are available at `/sign-in` and `/sign-up`, with modal triggers in the header. All API routes enforce the signed-in user and scope data to the current Clerk user ID.
- General writing projects live at `/writing`, with a brief-first flow that feeds goals/outline context into Gemini drafting and edits.
