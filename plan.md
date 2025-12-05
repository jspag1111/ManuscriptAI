# Plan

## Root Cause
The invite gate currently blocks the entire authentication UI unless a token is validated first. This prevents new users from creating accounts and signing in, even though the real requirement is to enforce invites only after sign-in (with admins exempt via `ADMIN_ALLOWED_EMAILS`).

## Resolution Steps
1. Move invite enforcement to a post-auth access gate so anyone can sign up/sign in, while still requiring a validated token (or admin email) to enter the workspace.
2. Update the invite validation API to bind tokens to the signed-in user, persist the token in a cookie, and enforce allowed-email/expiry/redeem rules.
3. Add a client-side access gate experience for authenticated non-admins without a valid token and refresh documentation to describe the new flow.
4. Re-run linting and a production build to verify the deployment pipeline remains healthy.
5. Document the updates in `changelog.md` with the final commit message.
