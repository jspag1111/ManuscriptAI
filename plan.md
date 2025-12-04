# Plan

## Root Cause
TypeScript could not infer the Supabase client table types when calling `.insert(payload)` in `app/api/invite/route.ts`, so the `values` parameter was typed as `never`, causing the Vercel build to fail.

## Resolution Steps
1. Add explicit Supabase client typing to the server-side client factory to preserve the generated database schema types.
2. Update the invite creation route to use the typed client when inserting invite tokens.
3. Run linting/tests to confirm the build passes locally.
4. Document the change in `changelog.md` with the commit message.
