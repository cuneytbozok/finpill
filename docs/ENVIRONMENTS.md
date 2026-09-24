# Environment configuration

This guide describes the environment model and how it is configured. The architecture baseline is [blueprint §44](PROJECT_BLUEPRINT.md#44-environments-configuration--deployment), and the decision record is draft [A03](adr/A03-environments-and-releases.md). Configuration flags validate prerequisites only; they do not implement or authorize a feature.

## Application environments

On 2026-09-24 the owner approved **two** application/data environments. "Private pilot" is a usage/release mode of Production, not a separate environment.

| Aspect | Local | Production (private application) |
|---|---|---|
| Purpose | Development, automated tests, disposable databases, local integrations | The single hosted application, used by the owner and explicitly invited users |
| App environment value | `local` | `production` |
| API origin, when enabled | Explicit local origin allowed | Explicit HTTPS Production API origin |
| Client origins | Explicit comma-separated origins, plus the native WebViews' `capacitor://localhost` and `https://localhost` for local native builds | Exact HTTPS Production client origins |
| Clerk | Development instance and `pk_test_`/`sk_test_` keys | Optional until hosted authentication is enabled. When `AUTH_ENABLED=true`: live instance and `pk_live_`/`sk_live_` keys only, with the development issuer rejected |
| Supabase | A disposable local instance, or the hosted project with user-scoped access only (no privileged key); CI uses disposable local databases only | The one hosted project (see the [access register](ACCESS_REGISTER.md)) |
| KAP | Explicit development or production source | Production source only; the known MKK development endpoint is rejected |
| Secrets | Ignored API `.env.local`; CI-scoped secrets only where a test needs them | API deployment secret store |
| Public build settings | Copied local example | Set in the client deployment before build and frozen into native assets |

No URL or credential falls back to a development service. An explicit HTTPS URL cannot prove project ownership, source entitlement or whether a remote project contains real user data; record resource identities in the access register. A hosted Staging environment may be added later if public release, multiple users, store distribution or operational risk justify it. It is not required now.

## Deployment contexts are not environments

Vercel's `development`, `preview` and `production` values (`VERCEL_ENV`) describe **where and how a build runs**, not which data or identity it may reach.

| Context | Application environment | Credentials |
|---|---|---|
| Local machine | `local` | Local, plus the hosted project's publishable key and development Clerk keys. Never the privileged Supabase key or live Clerk keys. |
| CI | `local` | CI-scoped only. Never a hosted project or Production credential. |
| Vercel Development (`vercel dev`/pull) | `local` | Local/development only |
| Vercel **Preview** | **None.** Preview is a credential-free build context. | No Finpill, provider or data-access credentials |
| Vercel Production | `production` | Production secrets in the API project's secret store |

**Preview rules:**
- Preview verifies builds, static UI, routing, responsiveness and client behavior that needs no real identity or data.
- API, authentication, database, privileged data, KAP, AI and market-data integrations stay disabled.
- Preview must not receive Production Supabase credentials, Clerk secrets, KAP, AI or provider secrets, privileged API credentials or any other data-access credential.
- Isolation between Preview and Production therefore rests primarily on the absence of those credentials.
- The rejection applies to credentials and credential-requiring integrations only. Ordinary non-secret settings and Vercel system variables are allowed.

**Local/CI rules:** on 2026-09-25 the owner allowed Local to use the hosted Supabase project so that no container runtime is needed. Local access is user-scoped: every request carries a development Clerk token and RLS applies; the privileged key is rejected with a hosted URL. Test accounts and their rows in the hosted project must be removed before real Production use (see [TASK_STATUS.md](TASK_STATUS.md)). CI and automated database tests still use disposable local resources only and reject a hosted database URL, project reference or Production credential.

### Enforcement

The contract lives in `packages/contracts/src/environment.ts` and is applied by the client build adapter (`apps/client/config/environment.ts`) and the API reader (`apps/api/src/server/environment-schema.ts`):

- `APP_ENV` / `NEXT_PUBLIC_APP_ENV` accept only `local` and `production`.
- **Preview** (`VERCEL=1`, `VERCEL_ENV=preview`) must have no application environment. The client build, API build and API startup reject enabled integration switches and credential-shaped names: `CLERK_*`, `NEXT_PUBLIC_CLERK_*`, `SUPABASE_*`, `KAP_*`, `DATABASE_URL`, `POSTGRES_*`, `PG*` connection settings, and any name containing `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, `API_KEY` or `CREDENTIAL(S)` as a word. Vercel system variables are exempt. Errors list names only.
- **Vercel Production** binds to `production` and **Vercel Development** to `local`. The API requires `APP_ENV` explicitly; the client derives it. Cross-binding or an unknown deployment context fails.
- **Production auth:** with `AUTH_ENABLED=false` no Clerk setting is required. Supplied or enabled Clerk settings must be live (`sk_live_`/`pk_live_`), and any `*.clerk.accounts.dev` (development-instance) issuer is rejected. No specific instance, project or issuer identity is hard-coded.
- **Local** accepts a hosted `SUPABASE_URL` only with `PRIVILEGED_DATA_ENABLED=false`. The iOS WebView origin `capacitor://localhost` is accepted in `CLIENT_ORIGINS` only in Local; hosted environments require HTTPS origins outside local networks.
- **CI:** a process with `CI` set (outside Vercel builds) rejects a hosted `SUPABASE_URL` and may validate a Production configuration only with every integration disabled. The workflow receives no repository secrets or variables (`tests/ci-isolation.test.mjs`), and database tests accept only a local Docker socket with a stripped environment (`tests/database-safety.test.mjs`).

## Local setup

After `npm ci`, copy the two credential-free examples:

```sh
cp apps/client/.env.example apps/client/.env.local
cp apps/api/.env.example apps/api/.env.local
npm run check
```

Never copy Production settings or credentials for tests. Examples disable all integrations and contain no credentials. Outside Vercel, the client requires an explicit app environment. Missing required base settings fail `next dev`, `next typegen`, `next build` and API startup. CI must supply the same explicit Local settings; there is no CI bypass.

Next loads `.env` files from each application directory, not the monorepo root. Shell/deployment variables take precedence. `NODE_ENV` controls Next's standard dotenv file selection; Do not set `NODE_ENV` to an application environment name.

## Public settings

Finpill reads only the following `NEXT_PUBLIC_` application settings:

| Name | Requirement |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `local` or `production`. On Vercel Production/Development it is derived from the deployment context; in Preview it must be absent |
| `NEXT_PUBLIC_API_ENABLED` | Literal `true` / `false`; omitted means disabled |
| `NEXT_PUBLIC_API_ORIGIN` | Required only with API enabled; supplied values always validated. Transport will add `/api/v1` in 01.01 |
| `NEXT_PUBLIC_AUTH_ENABLED` | Literal `true` / `false`; omitted means disabled |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required when auth enabled; test key outside production, live key in production |

The public reader uses literal `process.env.NEXT_PUBLIC_*` references for Next's build-time replacement. The platform-neutral public schema strips unrelated server settings. The client build also permits an exact list of Vercel framework metadata names (deployment URLs, environment, region, project/deployment IDs, hash salt, observability client configuration and documented Git metadata). These are ignored by the application schema. The build adapter applies the deployment-context rules in [Enforcement](#enforcement) only when `VERCEL=1`; an explicit value must agree with the binding, and a Preview build inlines no app environment. The validated public environment is inlined through Next config so browser and build agree. The list includes `NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA`, documented among system variables and prefixed by the builder. Unknown public names, including secret/token names under `NEXT_PUBLIC_VERCEL_`, remain rejected. See [Vercel framework variables](https://vercel.com/docs/environment-variables/framework-environment-variables). Client/shared source must use the validated reader rather than reading environment variables elsewhere; lint checks direct environment access as well as import boundaries. This is a guardrail, not a sandbox against intentionally obfuscated code.

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

- `npm test`: missing/malformed settings, enabled-feature requirements, public allowlist, hosted-origin restrictions, Production/Local separation, Preview credential rejection, Production auth fail-closed rules, CI isolation, native release profile/scan helpers, error redaction, and environment/import boundaries.
- `npm run test:environment-build`: rejects invalid real builds, builds a client with fake secret canaries, inspects every exported file for those canaries, verifies public API-origin inlining, rejects credentialed or integration-enabled Preview client builds, builds a credential-free Preview client, builds the API and checks Production and credential-free Preview startup (and credentialed Preview refusal) on a temporary port.
- The build smoke uses fake canaries only. Run it from a clean checkout without real service `.env` files; it invokes no providers or database. It replaces generated build outputs with verification artifacts, so rebuild with the intended environment before deployment.
- These checks do not prove real service access, RLS, native key storage or the actual contents of hosted Vercel scopes; the deployed Preview/Production checks and scope audit are recorded in the 01.09 PR. A03 remains draft until 01.09 and 01.10 evidence is complete.

Documentation checked through Context7 for Next.js environment loading/inlining, instrumentation and Zod validation; Supabase changelog and current [API key guidance](https://supabase.com/docs/guides/getting-started/api-keys) checked on 2026-09-22. See also [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).
