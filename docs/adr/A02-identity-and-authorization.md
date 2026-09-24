# A02 — Identity and authorization

- Status: **Accepted 2026-09-25** by the project owner, on the evidence of tasks 01.03–01.06 and 01.10 (PRs #16, #18, #19, #20, #26).
- Owner: project owner for Clerk instances and pilot eligibility; implementing tasks own the adapters and policies.

## Decision

1. **Clerk is the identity provider.** Web uses Clerk's browser SDK; iOS and Android use Clerk's native SDKs behind the shared `AuthPort`. Session material stays in SDK-supported storage, never in WebView storage.
2. **Verified bearer tokens.** The API verifies every Clerk session token (signature, issuer, authorized party, expiry). Protection never relies on route hiding.
3. **Text subject identity.** The user identity stored in the database is the Clerk subject, as text.
4. **Supabase RLS with the user's token.** User requests create a per-request Supabase client with the publishable key and the caller's Clerk token through Supabase third-party authentication; RLS enforces ownership. User requests never use service-role authority.
5. **Private-pilot eligibility** is an operator-managed allowlist keyed by Clerk subject, never derived from email, editable metadata or client-supplied IDs.
6. **Separate authorities.** User, operator/admin and machine (job) authority are distinct; machine routes reject user credentials (implemented with 02.07 and 03.06).

## Evidence

Guides: [WEB_AUTH.md](../WEB_AUTH.md), [IOS_AUTH.md](../IOS_AUTH.md), [ANDROID_AUTH.md](../ANDROID_AUTH.md), [USER_DATA_AUTH.md](../USER_DATA_AUTH.md). Task 01.10 (PR #26) ran the two-account authorization/RLS matrix with real Clerk tokens and the real-token platform proofs; the owner waived the reverse-direction matrix and the live web account-switch run (recorded in [TASK_STATUS.md](../TASK_STATUS.md)).

Hosted Production authentication (Clerk live instance) is a deferred Production prerequisite, not A02 evidence.
