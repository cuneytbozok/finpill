# Task 01.06 — Clerk user data and pilot eligibility

The client signs in with Clerk. The API verifies each bearer token, then creates a new Supabase client for that request with the publishable key and that same token. User requests never use `SUPABASE_SECRET_KEY` or service-role authority. The API currently exposes `GET`, `POST`, and `PATCH /api/v1/profile`; responses use `Cache-Control: no-store` and the configured browser-origin allowlist.

## Configuration

1. In the development Clerk instance, enable the Supabase integration. This adds `role: authenticated` to Clerk session tokens.
2. For local development, `supabase/config.toml` registers the development Clerk domain. For the hosted Production project, add Clerk under Authentication → Sign In / Providers → Third-Party Auth using the **live** issuer once hosted authentication is enabled. Remove the development-issuer trust at that point. (During task 01.06 the development issuer was registered on the hosted project; see below.)
3. Apply the repository migrations in order. The hosted dashboard integration is separate from the local CLI setting.
4. Set `AUTH_ENABLED=true`, `DATABASE_ENABLED=true`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in the API's ignored `.env.local` or deployment secret manager. The API uses server-side names, without `NEXT_PUBLIC_`. `SUPABASE_SECRET_KEY` is not needed for user profile requests.

`pilot_eligibility` is an operator-managed allowlist. An invited Clerk account remains ineligible until its Clerk subject has an enabled row. Do not derive eligibility from email, editable metadata, or a client-supplied user ID. An authorized operator can provision a specific subject through a privileged database workflow:

```sql
insert into public.pilot_eligibility (user_id, enabled)
values ('user_<approved_clerk_subject>', true)
on conflict (user_id) do update set enabled = excluded.enabled;
```

Only run that statement for an explicitly approved account. The application and Data API grant `authenticated` read-only access to the caller's own eligibility row. They provide no user path to change eligibility.

`user_profiles.user_id` stores the Clerk text subject and is the primary key. RLS requires both subject ownership and enabled eligibility for reads, inserts, and updates. Column privileges allow updating only `display_name`, so a profile cannot be reassigned. No delete path or extra user-owned tables are introduced in this task.

## Verification history and remaining acceptance

The hosted evidence below was gathered on 2026-09-23, when the owner had designated the existing hosted Supabase project as "staging". Under the 2026-09-24 environment model that same project is the single Production/private-application project. These results are historical development/test evidence obtained with the development Clerk instance; they are not the final Production identity contract. Detailed evidence is in [PR #20](https://github.com/cuneytbozok/finpill/pull/20).


- Disposable database replay and pgTAP coverage are in `supabase/tests/clerk_profiles_rls.test.sql`. This host has no Docker; PR #20's Docker-backed CI `database` job passed `npm run db:test` on commit `fb7d869`.
- On 2026-09-23, the owner-designated staging project had no existing application tables or migrations. The foundation and task 01.06 migrations were applied. A rollback-only SQL probe under `authenticated` and `anon` roles passed owner isolation, reassignment denial, disabled eligibility, and anonymous denial; the security advisor returned no lints.
- Direct staging Data API requests with no token and a malformed token returned `401`. Real active Clerk session tokens carried `role=authenticated`, returned `200` with zero profile rows, and received `403` when trying to insert a profile while the account remained pilot-ineligible. After the owner explicitly approved a grant for the sole existing invited development account, its eligibility row was enabled. The same account then received `200` for its eligibility and profile reads, `201` for profile creation, and `200` for a profile update; an attempted ownership reassignment returned `403`. No token or account identifier was logged.
- The local API returned `401` for unsigned and invalid bearer requests and `403` for an untrusted origin. Backend-minted Clerk tokens lack the `azp` claim required by the existing API verifier, so they cannot stand in for web-issued bearer tokens in API acceptance.
- A browser-issued bearer token is still needed to prove the invited account's `/api/v1/profile` flow. Cross-user denial has been exercised with two simulated subjects in the rollback-only SQL probe, not with two live Clerk accounts.

The project appears in the Supabase dashboard as its default `main PRODUCTION` branch. It was called staging during task 01.06 and is now designated Production. Before real Production use:

- switch its third-party auth to the Clerk live issuer
- remove the development-issuer trust
- remove the development test account's eligibility and profile rows (owner-approved)
- rotate `SUPABASE_SECRET_KEY`

These steps are tracked in [TASK_STATUS.md](TASK_STATUS.md). The two unverified checks above (browser-issued bearer and live two-account isolation) move to task 01.10, run against Local. Nothing here accepts A02 or A03.
