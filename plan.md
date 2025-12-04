# Plan

## Root Cause
Vercel treats the project as a generic static build and looks for a `dist` output directory because no framework/output settings are provided, even though `next build` completes successfully. Additionally, npm install reports deprecation warnings from unused Supabase auth helper packages and an outdated ESLint version.

## Resolution Steps
1. Add an explicit Vercel configuration that declares the Next.js framework and output directory so deployments consume the `.vercel/output` produced by `next build`.
2. Remove deprecated Supabase auth helper packages and update ESLint to a supported release, ensuring linting still works with the Next.js config.
3. Run linting and a production build locally to verify the project passes without deprecation warnings and that the build output is correctly generated.
4. Document the updates in `changelog.md` with the final commit message.
