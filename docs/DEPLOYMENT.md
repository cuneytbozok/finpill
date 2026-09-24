# Client, API and native release setup

The environment model is defined in [ENVIRONMENTS.md](ENVIRONMENTS.md) and [A03](adr/A03-environments-and-releases.md): two application environments (**Local**, **Production**) and a credential-free Vercel **Preview** deployment context.

## Vercel projects

Two independent Vercel projects deploy from this repository:

| Project | Root Directory | Configuration | Output |
|---|---|---|---|
| `finpill` (client) | repository root | root `vercel.json` | static export `apps/client/out` |
| `finpill-api` (`prj_RPrp1YttJigzDOBXIUI3cYGbBjJb`) | `apps/api`, with **Include source files outside of the Root Directory** enabled | `apps/api/vercel.json` | Next.js server (`/api/v1/*`) |

Do not point the client project at the API configuration or publish the API from the client project.

## Settings per scope

| Project / scope | Settings | Must not contain |
|---|---|---|
| Client **Preview** | Nothing required. Optional non-secret settings only (for example `NEXT_PUBLIC_DEEP_LINK_ORIGIN`). `NEXT_PUBLIC_API_ENABLED`/`NEXT_PUBLIC_AUTH_ENABLED` absent or `false`. | `NEXT_PUBLIC_APP_ENV`, any Clerk key, any Supabase/KAP/AI/provider credential |
| API **Preview** | `CLIENT_ORIGINS` (exact HTTPS origins, non-secret). All switches absent or `false`. | `APP_ENV`, any `CLERK_*`, `SUPABASE_*`, `KAP_*`, database URL, or any `*_SECRET`/`*_TOKEN`/`*_API_KEY`/`*_PASSWORD` credential |
| Client **Production** | `NEXT_PUBLIC_APP_ENV` absent or `production`. When the API is live: `NEXT_PUBLIC_API_ENABLED=true` and the exact `NEXT_PUBLIC_API_ORIGIN`. Auth stays off until Clerk live exists; then `NEXT_PUBLIC_AUTH_ENABLED=true` with a `pk_live_` key. | Development/test Clerk keys |
| API **Production** | `APP_ENV=production` (explicit; there is no default) and exact `CLIENT_ORIGINS`. `AUTH_ENABLED=false` until hosted Production authentication exists; then `sk_live_` secret and the live issuer. `DATABASE_ENABLED` only once the Production Supabase prerequisites in [TASK_STATUS](TASK_STATUS.md#active-blockers-and-prerequisites) are done. | `sk_test_` keys, any `*.clerk.accounts.dev` issuer, local service URLs |

These rules are enforced, not advisory:

- **Preview** (`VERCEL=1`, `VERCEL_ENV=preview`): the client build and the API (build and runtime) fail if any application environment, enabled integration switch or credential-shaped name is present. Errors name the variable, never its value. Vercel system variables (`VERCEL_*`, `NEXT_PUBLIC_VERCEL_*`) and ordinary settings are allowed.
- **Production** (`VERCEL_ENV=production`) binds to `production` only, **Development** to `local` only. A mismatch or unknown deployment context fails.
- Production validation fails closed: missing required settings stop the build or startup rather than falling back to development services.

## API contract, CORS and native compatibility

`/api/v1/health` returns `{"status":"ok","apiVersion":"v1"}` in every context, including a credential-free Preview. The protected session/profile routes return CORS headers only for exact `CLIENT_ORIGINS`; a disallowed origin gets `403`. Do not use `*` or a preview-domain pattern. A native request has no browser `Origin` but still needs a verified bearer token. Local CORS tests do not prove hosted configuration; confirm with deployed requests.

Native clients use `/api/v1` through the shared transport. Keep v1 compatible with installed native clients and introduce a new version before removing or changing a v1 contract. Public client settings are frozen into static/native assets, so changing an origin or key requires rebuilding and reinstalling.

## Native release build

There is one release profile, `production`. It targets the Production application. Its name describes the target, not a Vercel context. Local native builds for task 01.10 are separate and never use this profile.

Requirements: macOS with Xcode, the pinned Node/npm toolchain, JDK 21 and Android SDK 36; a committed, clean working tree; and no `apps/client/.env*` file other than `.env.example`.

```sh
FINPILL_API_ORIGIN=https://<production-api-host> npm run native:release -- production
```

Optional inputs: `FINPILL_CLERK_PUBLISHABLE_KEY` (a `pk_live_` key; it enables auth in the build) and `FINPILL_DEEP_LINK_ORIGIN`.

The pipeline:

1. Rejects unknown profiles, non-hosted API origins and non-live keys.
2. Requires the deployed `/api/v1/health` to return API v1.
3. Builds from an environment with inherited public, server and credential-shaped variables removed, so only the profile's public settings reach the bundle.
4. Syncs static assets to both native projects, then builds an unsigned iOS Release simulator app and an unsigned Android Release APK.
5. Inspects the packaged `.app` and the extracted APK: asset parity with the static export, no forbidden files, and no credential patterns.
6. Writes the ignored manifest `build/native-release/production.json`. It records profile, API origin and version, auth state, source revision, toolchain, and SHA-256 hashes of the static export, the `.app` tree and the APK.

Signing and device installation are separate owner-controlled steps. The unsigned output is not a distribution artifact.
