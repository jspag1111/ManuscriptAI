# ManuscriptAI (Next.js + Supabase)

A production-ready manuscript drafting studio built on Next.js with Supabase authentication, storage, and invite-only access controls. The UI reuses the existing manuscript editor, figure manager, and export tooling while shifting persistence to Supabase tables.

## Stack overview
- **Next.js 14 / App Router** for routing and serverless API routes
- **Supabase** for auth (email/Google), invite token gating, and Postgres storage
- **Lucide** icon system for consistent UI controls

## Prerequisites
- Node.js 18+ (Node 20 is recommended for Supabase SDK engine requirements)
- Supabase project with service role and anon keys
- Vercel (or another Next.js-capable host) for deployment

## Environment variables
Create a `.env.local` with the keys you provided. Required values:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_URL=...
SUPABASE_JWT_SECRET=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
ADMIN_ALLOWED_EMAILS=admin@example.com,second-admin@example.com
```

`ADMIN_ALLOWED_EMAILS` is a comma-delimited list of emails allowed to mint and review invite tokens via the `/admin` page.

## Database schema
Run these SQL snippets in the Supabase SQL console to provision tables:

```sql
create table if not exists public.projects (
  id uuid primary key,
  user_id uuid not null,
  title text,
  description text,
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists projects_user_idx on public.projects (user_id);

create table if not exists public.invite_tokens (
  token text primary key,
  allowed_email text,
  created_at timestamptz default now(),
  expires_at timestamptz,
  redeemed_by uuid,
  notes text
);
```

Recommended RLS policies:
- `projects`: enable RLS and add policy `user_id = auth.uid()` for select/insert/update/delete.
- `invite_tokens`: keep RLS disabled and restrict access through the server-side service role API.

## Running locally
1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Visit `http://localhost:3000`.

During development you can sign in with email or Google **after** validating an invite token. Use the `/admin` page (and an email listed in `ADMIN_ALLOWED_EMAILS`) to mint invite tokens.

## Deployment
- Vercel automatically detects the Next.js app. Set the same environment variables in Vercel.
- Supabase service keys should be stored as encrypted environment variables and never exposed to the client.

## Feature tour
- **Invite gate:** `/` prompts for an invite token before exposing Supabase Auth (email/Google).
- **Admin dashboard:** `/admin` lists and issues invite tokens for authorized emails.
- **Project persistence:** Client calls `/api/projects` which store serialized manuscripts in `projects.payload` tied to the authenticated user.
- **Export & figures:** Existing editor, reference manager, figures, and export flows remain intact inside the `ManuscriptApp` client component.

## Maintenance notes
- The API routes live under `app/api/*` and use the Supabase service role for secure database access.
- Auth state is provided via `SupabaseProvider` and `SessionContextProvider`.
- If you later add billing tiers, extend the `projects` table with plan metadata and gate routes using the same server-side session lookup used in `app/api/projects`.

