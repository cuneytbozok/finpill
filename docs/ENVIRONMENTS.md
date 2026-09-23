# Environment configuration

Task 00.04 adds fail-closed configuration validation. It does not provision services, authenticate users, implement CORS, or accept architecture gate A03. Configuration flags validate prerequisites only; they do not implement or authorize a feature.

## Environment matrix

`APP_ENV` / `NEXT_PUBLIC_APP_ENV` identify the data/deployment environment. They are independent of `NODE_ENV`: a local smoke build still uses Next's production build mode.

| Setting | Local | Staging / preview | Production / private pilot |
|---|---|---|---|
| App environment | `local` | `staging` | `production` |
| API origin, when enabled | Explicit local API origin allowed | Explicit HTTPS staging API origin | Explicit HTTPS pilot API origin |
| Client origins | Explicit comma-separated origins | Approved HTTPS preview/staging origins | Approved HTTPS pilot origins |
| Clerk, when enabled | Test instance and keys | Isolated test instance and keys | Live instance and keys |
| Supabase, when enabled | Disposable local instance | Isolated staging project | Pilot project; never a test target |
| KAP, when enabled | Explicit development or production source | Explicit permitted source environment | Production source only; known MKK dev endpoint rejected |
| Public build settings | Copied local example | Set in client deployment before build | Set in client deployment before build; also frozen into native assets |
| Secrets | API `.env.local`, ignored | API deployment secret store | API deployment secret store |

An origin is exactly `scheme://host[:port]`, with no credentials, trailing slash, path, query or fragment. Hosted origins must use HTTPS and a DNS hostname; local hostnames and IP literals are rejected. `CLIENT_ORIGINS` allows browser origins on the protected 01.03 session route and is also passed to Clerk's authorized-party token check. Other API routes must implement their own CORS policy when introduced. Native application identifiers and allowed native origins remain A01/A03 evidence work.

No URL or credential falls back to a development service. An explicit HTTPS URL cannot prove project ownership, source entitlement or whether a remote project contains pilot data: record those identities and access evidence in task 00.06. Review staging and production assignments before deployment.

## Local setup

After `npm ci`, copy the two credential-free examples:

```sh
cp apps/client/.env.example apps/client/.env.local
cp apps/api/.env.example apps/api/.env.local
npm run check
```

Do not copy a pilot environment for tests. Examples disable all integrations and contain no credentials. Outside Vercel, the client requires an explicit app environment. Missing required base settings fail `next dev`, `next typegen`, `next build` and API startup. CI must supply the same explicit non-pilot settings; there is no CI bypass.

Next loads `.env` files from each application directory, not the monorepo root. Shell/deployment variables take precedence. `NODE_ENV` controls Next's standard dotenv file selection; `.env.staging` is not automatically loaded. Do not set `NODE_ENV=staging`.

## Public settings

Finpill reads only the following `NEXT_PUBLIC_` application settings:

| Name | Requirement |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `local`, `staging`, `production`; when omitted on Vercel, derived from its deployment environment |
| `NEXT_PUBLIC_API_ENABLED` | Literal `true` / `false`; omitted means disabled |
| `NEXT_PUBLIC_API_ORIGIN` | Required only with API enabled; supplied values always validated. Transport will add `/api/v1` in 01.01 |
| `NEXT_PUBLIC_AUTH_ENABLED` | Literal `true` / `false`; omitted means disabled |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required when auth enabled; test key outside production, live key in production |

The public reader uses literal `process.env.NEXT_PUBLIC_*` references for Next's build-time replacement. The platform-neutral public schema strips unrelated server settings. The client build also permits an exact list of Vercel framework metadata names (deployment URLs, environment, region, project/deployment IDs, hash salt, observability client configuration and documented Git metadata). These are ignored by the application schema. The build adapter maps `VERCEL_ENV` to the app environment only when `VERCEL=1`: preview → staging, production → production, development → local. Explicit app settings retain precedence; unknown deployment environments fail. The validated public environment is inlined through Next config so browser and build agree. The list includes `NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA`, documented among system variables and prefixed by the builder. Unknown public names, including secret/token names under `NEXT_PUBLIC_VERCEL_`, remain rejected. See [Vercel framework variables](https://vercel.com/docs/environment-variables/framework-environment-variables). Client/shared source must use the validated reader rather than reading environment variables elsewhere; lint checks direct environment access as well as import boundaries. This is a guardrail, not a sandbox against intentionally obfuscated code.

A credential-free Vercel project can deploy the current placeholder with API/auth disabled and no origin configured. Enabling API access requires an explicit real origin; no Vercel client URL or localhost fallback is substituted. Task 01.01 must honor the API-enabled flag before transport requests.

Changing public settings requires rebuilding and redistributing the web/native artifact. Never put secrets in `next.config`'s `env` or compiler replacement options. Public keys are not authorization; auth enforcement and invitation eligibility remain 01.03–01.06.

## Server settings

| Feature | Switch | Required settings |
|---|---|---|
| Base | Always | `APP_ENV`, `CLIENT_ORIGINS` |
| Authentication | `AUTH_ENABLED=true` | `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER` |
| User-scoped database access | `DATABASE_ENABLED=true` | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` |
| Privileged background/admin data access | `PRIVILEGED_DATA_ENABLED=true` | Database enabled plus `SUPABASE_SECRET_KEY` |
| KAP access | `KAP_ENABLED=true` | `KAP_ENV` (`development` / `production`), `KAP_BASE_URL`, `KAP_AUTH_MODE` (`basic` / `token`), `KAP_API_KEY`; basic also requires `KAP_API_SECRET` |

Switches accept only literal `true` or `false`, defaulting to disabled. Supplied optional settings are still validated. Empty strings are not substitutes for omitted settings. Supabase fields use current `sb_publishable_` / `sb_secret_` keys and reject swapped key types; legacy JWT keys are not accepted by this scaffold. Privileged keys never belong to user-scoped requests and are not required merely to enable user-scoped database access.

Server schemas and readers live under `apps/api/src/server`; the runtime reader is guarded by `server-only`. Validation runs in Next configuration and again in Node instrumentation at runtime. Failures report field names only, without submitted values, raw Zod errors or nested error causes. Never log the returned configuration object.

KAP token fields are prerequisites, not a verified production authentication protocol. Task 03.01 must refine them against the permitted account documentation. AI and market-provider fields must be added with their selected providers in their consuming tasks; no default model/provider or credentials are invented here. Enabled services need separate connectivity and authorization evidence before use.

## Verification and evidence limits

- `npm test`: missing/malformed settings, enabled-feature requirements, public allowlist, hosted-origin restrictions, production/development separation, error redaction, and environment/import boundaries.
- `npm run test:environment-build`: rejects invalid real builds, builds a client with fake secret canaries, inspects every exported file for those canaries, verifies public API-origin inlining, builds the API and checks valid/invalid production startup on a temporary port.
- The build smoke uses fake canaries only. Run it from a clean checkout without real service `.env` files; it invokes no providers or database. It replaces generated build outputs with verification artifacts, so rebuild with the intended environment before deployment.
- These checks do not prove real service access, RLS, native key storage, hosted preview isolation or release compatibility. A03 remains draft.

Documentation checked through Context7 for Next.js environment loading/inlining, instrumentation and Zod validation; Supabase changelog and current [API key guidance](https://supabase.com/docs/guides/getting-started/api-keys) checked on 2026-09-22. See also [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).
