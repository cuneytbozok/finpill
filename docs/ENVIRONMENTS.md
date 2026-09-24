# Environment configuration

This guide describes the environment model and how it is configured. The architecture baseline is [blueprint §44](PROJECT_BLUEPRINT.md#44-environments-configuration--deployment), and the decision record is draft [A03](adr/A03-environments-and-releases.md). Configuration flags validate prerequisites only; they do not implement or authorize a feature.

## Application environments

On 2026-09-24 the owner approved **two** application/data environments. "Private pilot" is a usage/release mode of Production, not a separate environment.

| Aspect | Local | Production (private application) |
|---|---|---|
| Purpose | Development, automated tests, disposable databases, local integrations | The single hosted application, used by the owner and explicitly invited users |
| App environment value | `local` | `production` |
| API origin, when enabled | Explicit local origin allowed | Explicit HTTPS Production API origin |
| Client origins | Explicit comma-separated origins | Exact HTTPS Production client origins |
| Clerk | Development instance and `pk_test_`/`sk_test_` keys | Optional until hosted authentication is enabled. When `AUTH_ENABLED=true`: live instance and `pk_live_`/`sk_live_` keys only, with the development issuer rejected |
| Supabase | Disposable local instance; CI uses generated disposable projects | The one hosted project (see the [access register](ACCESS_REGISTER.md)); never a test target |
| KAP | Explicit development or production source | Production source only; the known MKK development endpoint is rejected |
| Secrets | Ignored API `.env.local`; CI-scoped secrets only where a test needs them | API deployment secret store |
| Public build settings | Copied local example | Set in the client deployment before build and frozen into native assets |

No URL or credential falls back to a development service. An explicit HTTPS URL cannot prove project ownership, source entitlement or whether a remote project contains real user data; record resource identities in the access register. A hosted Staging environment may be added later if public release, multiple users, store distribution or operational risk justify it. It is not required now.

## Deployment contexts are not environments

Vercel's `development`, `preview` and `production` values (`VERCEL_ENV`) describe **where and how a build runs**, not which data or identity it may reach.

| Context | Application environment | Credentials |
|---|---|---|
| Local machine / CI | `local` | Local or CI-scoped only. Production credentials are never used. |
| Vercel Development (`vercel dev`/pull) | `local` | Local/development only |
| Vercel **Preview** | **None.** Preview is a credential-free build context. | No Finpill, provider or data-access credentials |
| Vercel Production | `production` | Production secrets in the API project's secret store |

**Preview rules:**
- Preview verifies builds, static UI, routing, responsiveness and client behavior that needs no real identity or data.
- API, authentication, database, privileged data, KAP, AI and market-data integrations stay disabled.
- Preview must not receive Production Supabase credentials, Clerk secrets, KAP, AI or provider secrets, privileged API credentials or any other data-access credential.
- Isolation between Preview and Production therefore rests primarily on the absence of those credentials.
- The rejection applies to credentials and credential-requiring integrations only. Ordinary non-secret settings and Vercel system variables are allowed.

**Local/CI rules:** tests use local or generated disposable resources only. No test, script or CI job may accept a Production database URL, project reference or Production credential.

### Current implementation (until task 01.09)

The code still implements the superseded three-value model:

- `EnvironmentSchema` in `packages/contracts/src/environment.ts` accepts `local`, `staging` and `production`.
- The client build adapter in `apps/client/config/environment.ts` maps Vercel `preview` → `staging`, `production` → `production` and `development` → `local`.
- The environment tests assert this mapping.

Task 01.09 replaces this with:
- `local`/`production` application environments
- a Preview context that has no application environment and rejects Finpill, provider and data-access credentials and credential-requiring integrations (other server variables and Vercel system variables stay allowed)
- Production with `AUTH_ENABLED=false` needs no Clerk configuration; with auth enabled it requires live keys and rejects development keys and the development issuer
- removal of any hard-coded staging identity

Until then, do not configure any Vercel scope with `staging` values or credentials.

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
| `NEXT_PUBLIC_APP_ENV` | Currently `local`, `staging`, `production`; when omitted on Vercel, derived from its deployment environment. Task 01.09 narrows this to `local`/`production` with no value in Preview |
| `NEXT_PUBLIC_API_ENABLED` | Literal `true` / `false`; omitted means disabled |
| `NEXT_PUBLIC_API_ORIGIN` | Required only with API enabled; supplied values always validated. Transport will add `/api/v1` in 01.01 |
| `NEXT_PUBLIC_AUTH_ENABLED` | Literal `true` / `false`; omitted means disabled |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required when auth enabled; test key outside production, live key in production |

The public reader uses literal `process.env.NEXT_PUBLIC_*` references for Next's build-time replacement. The platform-neutral public schema strips unrelated server settings. The client build also permits an exact list of Vercel framework metadata names (deployment URLs, environment, region, project/deployment IDs, hash salt, observability client configuration and documented Git metadata). These are ignored by the application schema. The build adapter maps `VERCEL_ENV` to the app environment only when `VERCEL=1`. The current preview → staging mapping is superseded; see [current implementation](#current-implementation-until-task-0109). Explicit app settings retain precedence; unknown deployment environments fail. The validated public environment is inlined through Next config so browser and build agree. The list includes `NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA`, documented among system variables and prefixed by the builder. Unknown public names, including secret/token names under `NEXT_PUBLIC_VERCEL_`, remain rejected. See [Vercel framework variables](https://vercel.com/docs/environment-variables/framework-environment-variables). Client/shared source must use the validated reader rather than reading environment variables elsewhere; lint checks direct environment access as well as import boundaries. This is a guardrail, not a sandbox against intentionally obfuscated code.

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
- These checks do not prove real service access, RLS, native key storage, credential-free Preview configuration or release compatibility. A03 remains draft.

Documentation checked through Context7 for Next.js environment loading/inlining, instrumentation and Zod validation; Supabase changelog and current [API key guidance](https://supabase.com/docs/guides/getting-started/api-keys) checked on 2026-09-22. See also [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).
