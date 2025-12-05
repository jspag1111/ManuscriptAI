<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ManuscriptAI

This Next.js app provides an intelligent, iterative research manuscript creation experience with built-in reference management and figure handling. The project now uses the Next.js App Router, Tailwind CSS, and a Supabase-backed API layer to keep the frontend and backend in sync.

## Run Locally

**Prerequisites:** Node.js 18+ and a Supabase project

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `projects` table in Supabase (JSONB works well for the `data` column). A minimal schema is:
   ```sql
   create table if not exists public.projects (
     id text primary key,
     title text not null,
     description text,
     created bigint not null,
     last_modified bigint not null,
     data jsonb not null
   );
   ```
3. Add Supabase credentials to `.env.local` (Anon key for the browser, service role for API routes):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
4. Start the Next.js dev server (API routes and UI together):
   ```bash
   npm run dev
   ```
5. Seed or manage the Supabase database independently (optional):
   ```bash
   npm run seed   # populate Supabase.projects from example data
   npm run server # run the standalone Express API on :4000
   ```

## Deploying to Vercel

- The included `vercel.json` pins the framework to Next.js and tells Vercel to use the `.next` build output so it no longer looks for a `dist` folder from the prior Vite setup.
- Default settings work: set the Build Command to `npm run build` (or leave the framework-provided default) and the Output Directory to `.next`.
- The API layer requires Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`).

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` must be configured for the database-backed features. The browser uses the anon key, while the API routes and Express server rely on the service role key for writes.
