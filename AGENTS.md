# AGENTS.md

## Purpose
Defines mandatory rules for automated coding agents working in this repository.

**Goals:** correctness, security, maintainability, and strict adherence to the **Next.js + Vercel + Turso + Clerk** stack.

---

## Tech Stack (Authoritative)
- **Framework:** Next.js  
- **Deployment:** Vercel  
- **Database:** Turso  
- **Auth:** Clerk  

**Agents must consult official docs whenever changes touch these services.**

---

## Global Rules
Agents **must**:
- Follow official docs and best practices for any affected service.
- Maintain backward compatibility unless explicitly instructed otherwise.
- Never hard-code secrets (use env vars only).
- Prioritize security, performance, and idiomatic Next.js patterns.

---

## Required Workflow (Every Change)
1. **Understand scope** and affected stack components.
2. **Plan small, focused changes.**
3. **Consult official docs** as needed.
4. **Implement** following existing patterns and TypeScript standards.
5. **Run checks**:
   ```bash
   npm run lint
   npm run test   # if present
   npm run build

	6.	Update documentation and always update CHANGELOG.md.
	7.	Commit & push (see Git rules below).

⸻

CHANGELOG.md (Mandatory)
	•	Update for all non-trivial changes.
	•	Include today’s date, time, and commit name.
	•	Use concise bullets (Added, Changed, Fixed, etc.).
	•	Must accurately reflect code changes.

⸻

Git Rules
	•	Commit only relevant files.
	•	Commit messages must start with codex/.
	•	Push to the current branch.
	•	No force-pushes or branch changes unless instructed.

Example:

git commit -m "codex/fix-clerk-auth-redirect"


⸻

Stack-Specific Expectations
	•	Next.js: Respect app/router structure, server vs client boundaries, and data-fetching patterns.
	•	Vercel: Ensure builds succeed; respect env vars and runtime constraints.
	•	Turso: Parameterized queries only; handle nulls; follow existing schema/migration patterns.
	•	Clerk: Treat auth as security-critical; use official components/hooks; protect routes properly.

Docs must be consulted for any changes in these areas.

⸻

Testing & Quality
	•	Tests, lint, and build are mandatory.
	•	Fix failures—do not disable tests.
	•	If no tests exist, do not invent commands; add minimal coverage when appropriate and document it.

⸻

Files to Keep in Sync
	•	AGENTS.md
	•	CHANGELOG.md
	•	Relevant config files (next.config.*, vercel.json, DB/auth configs)

⸻

Non-Goals

Do not:
	•	Add new dependencies unnecessarily.
	•	Change the tech stack.
	•	Rewrite git history.
	•	Perform large refactors without explicit approval.

