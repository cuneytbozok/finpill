# Task 01.06 — Clerk user data and pilot eligibility

The client signs in with Clerk. The API verifies each bearer token, then creates a new Supabase client for that request with the publishable key and that same token. User requests never use `SUPABASE_SECRET_KEY` or service-role authority. The API currently exposes `GET`, `POST`, and `PATCH /api/v1/profile`; responses use `Cache-Control: no-store` and the configured browser-origin allowlist.

## Configuration

1. In the development Clerk instance, enable the Supabase integration. This adds `role: authenticated` to Clerk session tokens.
2. In the owner-designated staging Supabase project, add Clerk under Authentication → Sign In / Providers → Third-Party Auth using the development issuer URL. Use a distinct identity/project pair for pilot later.
3. Apply the repository migrations in order. For local CLI development, `supabase/config.toml` registers the development Clerk domain. The hosted dashboard integration is separate from the local CLI setting.
4. Set `AUTH_ENABLED=true`, `DATABASE_ENABLED=true`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in the API's ignored `.env.local` or deployment secret manager. The API uses server-side names, without `NEXT_PUBLIC_`. `SUPABASE_SECRET_KEY` is not needed for user profile requests.

`pilot_eligibility` is an operator-managed allowlist. An invited Clerk account remains ineligible until its Clerk subject has an enabled row. Do not derive eligibility from email, editable metadata, or a client-supplied user ID. An authorized operator can provision a specific subject through a privileged database workflow:

```sql
insert into public.pilot_eligibility (user_id, enabled)
values ('user_<approved_clerk_subject>', true)
on conflict (user_id) do update set enabled = excluded.enabled;
```

Only run that statement for an explicitly approved account. The application and Data API grant `authenticated` read-only access to the caller's own eligibility row. They provide no user path to change eligibility.

`user_profiles.user_id` stores the Clerk text subject and is the primary key. RLS requires both subject ownership and enabled eligibility for reads, inserts, and updates. Column privileges allow updating only `display_name`, so a profile cannot be reassigned. No delete path or extra user-owned tables are introduced in this task.

## Verification and remaining acceptance

- Disposable local database replay and pgTAP coverage are in `supabase/tests/clerk_profiles_rls.test.sql`; run `npm run db:test` on a host with Docker.
- On 2026-09-23, the owner-designated staging project had no existing application tables or migrations. The foundation and task 01.06 migrations were applied. A rollback-only SQL probe under `authenticated` and `anon` roles passed owner isolation, reassignment denial, disabled eligibility, and anonymous denial; the security advisor returned no lints.
- Direct staging Data API requests with no token and a malformed token returned `401`. Real active Clerk session tokens carried `role=authenticated`, returned `200` with zero profile rows, and received `403` when trying to insert a profile while the account remained pilot-ineligible. After the owner explicitly approved a grant for the sole existing invited development account, its eligibility row was enabled. The same account then received `200` for its eligibility and profile reads, `201` for profile creation, and `200` for a profile update; an attempted ownership reassignment returned `403`. No token or account identifier was logged.
- The local API returned `401` for unsigned and invalid bearer requests and `403` for an untrusted origin. Backend-minted Clerk tokens lack the `azp` claim required by the existing API verifier, so they cannot stand in for web-issued bearer tokens in API acceptance.
- A browser-issued bearer token is still needed to prove the invited account's `/api/v1/profile` flow. Cross-user denial has been exercised with two simulated subjects in the rollback-only SQL probe, not with two live Clerk accounts.

The staging project is the Supabase dashboard's default `main PRODUCTION` branch but was designated by the owner as staging for task 01.06. It is not evidence of isolated pilot infrastructure or accepted A02/A03 gates.
