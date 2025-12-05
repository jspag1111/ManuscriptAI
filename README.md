<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ManuscriptAI

This Next.js app provides an intelligent, iterative research manuscript creation experience with built-in reference management and figure handling. The project now uses the Next.js App Router, Tailwind CSS, and SQLite-backed API routes to keep the frontend and backend in sync.

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Next.js dev server (API routes and UI together):
   ```bash
   npm run dev
   ```
3. Seed or manage the local SQLite database independently (optional):
   ```bash
   npm run seed   # populate data/projects.sqlite from example data
   npm run server # run the standalone Express API on :4000
   ```

## Deploying to Vercel

- The included `vercel.json` pins the framework to Next.js and tells Vercel to use the `.next` build output so it no longer looks for a `dist` folder from the prior Vite setup.
- Default settings work: set the Build Command to `npm run build` (or leave the framework-provided default) and the Output Directory to `.next`.
- No environment variables are required for the current feature set, but Supabase values can be added at any time and the client helper will pick them up automatically.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are reserved for future Supabase integration. They are optional today but the `lib/supabaseClient` helper will automatically connect once they are provided.
