# Web authentication and bearer verification

Task 01.03 adds Clerk web sign-in to the static client and a protected endpoint on the separate API. The native bundle keeps its anonymous `AuthPort` until the iOS and Android adapters in 01.04–01.05. The client never receives the Clerk secret key.

## Instance and local setup

Use an approved Clerk development instance. Set its [Access mode to Invite-only](https://clerk.com/docs/guides/secure/restricting-access) before relying on invitation acceptance. An invitation must be accepted by the intended test account; a visible sign-in form or an existing invitation count alone does not prove this setting.

In ignored `apps/client/.env.local`, set `NEXT_PUBLIC_APP_ENV=local`, `NEXT_PUBLIC_AUTH_ENABLED=true`, and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to the instance's publishable key. To call the separate API, also set `NEXT_PUBLIC_API_ENABLED=true` and `NEXT_PUBLIC_API_ORIGIN=http://localhost:3001`.

In ignored `apps/api/.env.local`, set `APP_ENV=local`, `CLIENT_ORIGINS=http://localhost:3000`, `AUTH_ENABLED=true`, `CLERK_SECRET_KEY`, and `CLERK_JWT_ISSUER`. The issuer must be its exact origin **without a trailing slash**. Keep the publishable and secret keys from the same Clerk instance. Do not copy secrets into examples, task logs, or the client deployment.

Run `npm run dev:api` and `npm run dev:client` with the pinned toolchain. The web header provides Clerk's sign-in modal and account control. The authenticated browser sends a fresh session token through `AuthPort`; `GET /api/v1/session` accepts only a bearer token. The API verifies signature, expiration, not-before time, authorized client origin, issuer, user ID, and session ID before returning the caller's user ID. It never uses route visibility as authorization. Browser origins outside `CLIENT_ORIGINS` fail before token handling.

## Deployment scopes

Development Clerk keys (`pk_test_` and `sk_test_`) belong to Local builds only. Vercel Preview is credential-free, so it runs with authentication disabled. A production client build with `NEXT_PUBLIC_APP_ENV=production` requires a live publishable key if authentication is enabled or the key is supplied. The separate production API requires a live secret key when auth is enabled. Keep Production auth disabled, and never put development keys there, until an owned domain and Clerk live instance exist (a deferred prerequisite in [TASK_STATUS.md](TASK_STATUS.md)). Vercel Preview and Production variable scopes must be checked independently; a successful static build does not prove live session acceptance.

## Acceptance checklist

1. Confirm Clerk's Invite-only access mode and use an invited test account to sign in and out in a browser.
2. With that account's bearer token, request `/api/v1/session` and verify it returns the matching user ID. Repeat after sign-out and confirm the old browser session no longer supplies a token.
3. Confirm unsigned, malformed, expired, future, wrong-issuer, wrong-client-origin, and tampered tokens fail. Check an unknown browser `Origin` and its preflight request.
4. Run `npm run check`, inspect the static client export for secrets, and verify local and hosted build settings separately.

Token verification follows [Clerk's backend guidance](https://clerk.com/docs/reference/backend/verify-token). Task 01.06 will add pilot eligibility and database row ownership; this endpoint proves authentication only.
