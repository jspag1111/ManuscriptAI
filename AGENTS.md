## 1. Purpose

This document defines how automated coding agents (e.g., Codex, Copilot Agents, or similar tools) must operate in this repository.

The goals:

- Keep the codebase **correct, secure, and maintainable**.
- Respect the **Next.js + Vercel + Turso + Clerk** stack.
- Ensure all changes are **tested**, **documented**, and **properly committed/pushed**.

---

## 2. Tech Stack Overview

Agents must always keep this stack in mind when making changes:

- **Frontend / Fullstack Framework:** Next.js
- **Deployment / Hosting:** Vercel
- **Database:** Turso
- **Authentication / User Management:** Clerk

Whenever changes touch any of these areas, the agent must consult the **official documentation** before finalizing the implementation.

**Reference docs (non-exhaustive):**

- Next.js: <https://nextjs.org/docs>
- Vercel: <https://vercel.com/docs>
- Turso: <https://docs.turso.tech> (or current Turso documentation)
- Clerk: <https://clerk.com/docs>

---

## 3. Global Rules for All Changes

When editing this repo, the agent must:

1. **Consult documentation for the relevant service**  
   - If the change involves routing, data fetching, layouts, or API routes → check **Next.js** docs.  
   - If the change involves deployment, env vars, build, or serverless behavior → check **Vercel** docs.  
   - If the change involves database access, schema, migrations, or queries → check **Turso** docs.  
   - If the change involves auth, sessions, user accounts, or protected routes → check **Clerk** docs.

2. **Follow best practices** for:
   - Security (avoid leaking secrets, validate inputs, handle auth correctly).
   - Performance (avoid unnecessary data fetching, use caching where appropriate).
   - Code quality (consistent style, idiomatic Next.js patterns, avoid dead code).

3. **Avoid breaking existing behavior**:
   - Prefer backward-compatible changes.
   - When refactoring, keep public interfaces (API routes, auth flows, URL structure) consistent unless explicitly told to change them.

4. **Keep secrets and credentials out of the repo**:
   - Never hard-code secrets.
   - Use environment variables and follow the existing pattern in `.env` / Vercel project env settings.

---

## 4. Standard Workflow for Any Change

For **every change**, the agent must follow this workflow:

1. **Understand the task**
   - Read the relevant files and any related documentation or comments.
   - Identify which parts of the stack are affected (Next.js, Vercel, Turso, Clerk).

2. **Plan the change**
   - Outline in comments (or in the PR description) what will be modified.
   - Keep the change set as small and focused as reasonably possible.

3. **Consult documentation**
   - Look up the relevant section in the official docs for:
     - Next.js features being used/changed.
     - Vercel deployment/build behaviors, if affected.
     - Turso connection/query patterns, schema design, migrations.
     - Clerk auth flows, components, hooks, middleware, and security considerations.

4. **Implement the change**
   - Follow existing project patterns and coding style.
   - Prefer small, composable functions and components.
   - Add or update TypeScript types as needed.
   - If adding new features, also add/update tests.

5. **Run tests and checks**
   - Run the project’s test and quality commands (example, adjust to actual project scripts):

     ```bash
     # Replace with the actual commands defined in package.json
     npm run lint        # or pnpm/yarn equivalent
     npm run test        # if tests exist
     npm run build       # ensure the app still builds
     ```

   - Address all lint errors, test failures, and build errors before proceeding.

6. **Update documentation**
   - If behavior, endpoints, or flows change, update related docs and comments.
   - **Always update `CHANGELOG.md`** (see Section 5).

7. **Commit and push**
   - Stage relevant files.
   - Create a commit message that **starts with `codex/`** (see Section 6).
   - Push to the **current branch**.

---

## 5. Maintaining `CHANGELOG.md`

The agent must **always update `CHANGELOG.md`** when making any non-trivial change.

Guidelines:

- If the changelog has an **“Unreleased”** or similar section, add entries there.
- Otherwise, create or update a version section in a format consistent with the existing file.

Example entry style (adapt to existing format):

```markdown
## Unreleased

- Added: New Next.js page for X with Clerk-protected route.
- Fixed: Turso query for Y to avoid N+1 and handle null values.
- Changed: Updated Vercel build settings for Z feature.
````

**Rules:**

* Use concise bullet points describing **what** changed and, if useful, **why**.
* Group changes by type if the file already uses labels such as `Added`, `Changed`, `Fixed`, etc.
* Ensure the changelog accurately reflects the code changes in the commit.

---

## 6. Git Workflow & Commit Messages

Agents must obey the following git workflow rules:

1. **Stage only relevant files**

   * Use `git add` for the files that belong to the change.
   * Avoid committing unrelated or temporary files.

2. **Commit message format**

   * Every commit message must start with: `codex/`
   * After the prefix, add a short, descriptive summary.

   Examples:

   ```bash
   git commit -m "codex/fix-clerk-auth-redirect"
   git commit -m "codex/add-turso-query-for-project-list"
   git commit -m "codex/refactor-nextjs-layout-structure"
   ```

3. **Push to the current branch**

   * After a successful commit and test run, push:

   ```bash
   git push
   ```

   * Do not create or switch branches unless explicitly requested.
   * Do not force-push (`git push --force`) unless explicitly instructed.

---

## 7. Stack-Specific Guidance

### 7.1 Next.js

When working with Next.js:

* Use idiomatic patterns for:

  * Routing (`app` router vs `pages` router, following the existing setup).
  * Data fetching (`fetch`, `getServerSideProps`, `getStaticProps`, or Route Handlers as applicable).
  * Server and client components (respect current architecture).
* Ensure:

  * No blocking operations on the client.
  * Proper error handling for API routes and data fetching.
  * Consistency with existing directory structure.

Always check the Next.js docs when:

* Adding or modifying routes/pages/components.
* Changing server/client component boundaries.
* Modifying data fetching or caching behavior.
* Integrating with Vercel/Vercel functions.

---

### 7.2 Vercel

When working with deployment-related code or configuration:

* Ensure build remains successful (`npm run build`).
* Respect existing environment variables and their use in code.
* Avoid breaking serverless function constraints (e.g., long-running tasks).
* Be mindful of edge runtimes vs node runtimes if the project uses them.

Consult Vercel docs when:

* Introducing new environment variables or build-time config.
* Changing deployment-related code paths or serverless functions.
* Adjusting output directories or build behavior.

---

### 7.3 Turso (Database)

When working with the database:

* Follow existing patterns for:

  * Creating connections / clients.
  * Writing queries.
  * Managing schema and migrations.
* Ensure queries:

  * Are parameterized (avoid SQL injection).
  * Handle possible `null`/`undefined` values.
  * Consider performance where relevant.

Consult Turso docs when:

* Creating or altering tables / schemas.
* Changing connection configuration.
* Introducing new query patterns or migration flows.

---

### 7.4 Clerk (Authentication)

When working with Clerk authentication and user management:

* Always assume authentication and authorization are security-critical.
* Use the official Clerk components, hooks, and middleware where possible.
* Protect server routes and pages that require authenticated access.
* Avoid leaking user data in logs or error messages.

Consult Clerk docs when:

* Modifying login/signup/logout flows.
* Changing session handling or user metadata usage.
* Protecting new routes or pages with authentication.

---

## 8. Testing & Quality Expectations

Agents must treat the following as **mandatory**, not optional:

* **Run tests and checks** after any code change:

  * Linting (`npm run lint` or equivalent).
  * Unit/integration tests (`npm run test` or equivalent).
  * Build (`npm run build`).

* **If tests fail**:

  * Fix the underlying issue.
  * Do **not** disable or remove tests just to make them pass, unless explicitly instructed and documented in `CHANGELOG.md`.

* **If the project has no tests yet**:

  * Do not invent test commands.
  * If adding a new feature or bugfix, consider adding minimal test coverage consistent with the project’s setup (if any). Document new tests in `CHANGELOG.md`.

---

## 9. Files the Agent Must Keep in Sync

The agent must keep these files updated whenever relevant:

* `AGENTS.md` – this document, if conventions change.
* `CHANGELOG.md` – always updated for code changes that affect behavior, APIs, or infrastructure.
* Any configuration files related to:

  * Next.js (e.g., `next.config.js`/`next.config.mjs`).
  * Vercel (e.g., `vercel.json`, if present).
  * Turso (e.g., DB client/config files).
  * Clerk (e.g., auth configuration, middleware).

---

## 10. Non-Goals

Unless explicitly instructed, the agent should **not**:

* Introduce new external dependencies just for convenience.
* Change the stack (e.g., swap Turso, Clerk, or hosting provider).
* Force-push or rewrite git history.
* Make large-scale, sweeping refactors without clear justification and proper testing.
