# Client, API and native release setup

Task 01.09 uses two independent Vercel projects from this repository. The existing
client project has repository root as its Root Directory and uses the root
`vercel.json` to publish `apps/client/out`. The API project must use `apps/api`
as its Root Directory, enable **Include source files outside of the Root
Directory** for the workspace packages and lockfile, and use
`apps/api/vercel.json`. Its build command runs the API workspace build from
the repository root. Do not point the client project at the API configuration
or publish the API from the static client project.

## Deployment scopes

| Project / scope | Application settings | Identity and data target |
|---|---|---|
| Client Preview | `NEXT_PUBLIC_APP_ENV=staging`, `NEXT_PUBLIC_API_ENABLED=true`, exact HTTPS staging `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_AUTH_ENABLED=true`, test `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Staging API only. No Supabase keys or server secrets. |
| API Preview | `APP_ENV=staging`, exact HTTPS staging `CLIENT_ORIGINS`, `AUTH_ENABLED=true`, test `CLERK_SECRET_KEY`, development/test `CLERK_JWT_ISSUER`, `DATABASE_ENABLED=true`, staging `SUPABASE_URL` and publishable key | The recorded staging Supabase project is `gsgkoiwjkqbkuyyafzbf`. `PRIVILEGED_DATA_ENABLED=false`; no pilot key. |
| Client Production | `NEXT_PUBLIC_APP_ENV=production` and pilot API/live Clerk public settings only after pilot resources exist | No development or staging identity/data. A credential-free static build may keep API/auth disabled meanwhile. |
| API Production | `APP_ENV=production`, exact pilot `CLIENT_ORIGINS`, live Clerk secret/issuer, pilot Supabase URL/publishable key | Do not enable until the pilot project, issuer and origins are registered and verified. |

The API rejects a Vercel Preview with `APP_ENV=production` and a Production
deployment with `APP_ENV=staging`. Staging database access is pinned to the
recorded project URL; Production rejects that staging URL and the known
development Clerk issuer. Client public validation separately requires test
Clerk keys in Preview and live keys in Production. These are build/runtime
guards, not proof of external service ownership or RLS behavior.

Set `CLIENT_ORIGINS` to the exact browser origin(s) that should call the API.
The protected session and profile routes return CORS headers only for those
origins. Do not use `*` or a broad preview-domain pattern. Each browser
preview origin used for authenticated acceptance must be explicitly registered
in the corresponding API deployment, and Clerk must authorize that origin for
the bearer token's `azp` claim. A native request has no browser `Origin` but
still needs a valid verified bearer token. Confirm this with deployed negative
and positive requests; a local CORS test does not prove a hosted configuration.

The API health endpoint is `/api/v1/health` and returns `apiVersion: "v1"`.
Release clients use `/api/v1` through the shared transport. Keep v1 compatible
with installed native clients. Introduce a new version before removing or
changing a v1 contract. Public client settings are frozen into static/native
assets, so an origin or key change requires rebuilding and reinstalling the
native app.

## Native build profile

On macOS with the pinned Node/npm toolchain, JDK 21, Android SDK 36 and Xcode,
set `FINPILL_API_ORIGIN` to the target's exact HTTPS origin and
`FINPILL_CLERK_PUBLISHABLE_KEY` to a matching test/live public key. Then run:

```sh
npm run native:release -- staging
```

The pipeline checks the deployed `/api/v1/health` response for API v1 before
building. It sets the matching client environment, enables API/auth, syncs
the static assets to both native projects, checks identical assets, and builds
an unsigned iOS Release simulator app and unsigned Android Release APK. It
writes an ignored `build/native-release/staging.json` manifest with the API
origin, source revision, API version and static index SHA-256. Use `production`
only after pilot resources are verified. Signing and device installation are
separate owner-controlled steps; the CI-style unsigned output is not a
distribution artifact.

For acceptance, record project IDs and exact deployment origins in the access
register, confirm both client and API previews are Ready, request deployed
health, test allowed/disallowed browser origins and bearer paths, inspect
client and native artifacts for server secrets, and prove Preview credentials
cannot access pilot resources. The Vercel connector lacks access to the
owner's team, but authenticated Chrome can inspect project settings. The
separate API project is `finpill-api` (`prj_RPrp1YttJigzDOBXIUI3cYGbBjJb`).
Its task-branch Preview has only non-secret `APP_ENV=staging` and exact
`CLIENT_ORIGINS` configured. The owner explicitly approved removing Vercel
Authentication for the exact task-branch API Preview domain recorded in the
access register; Production protection remains enabled. Public deployed health
now returns API v1, allowed-origin preflight returns `204`, disallowed-origin
preflight returns `403`, and a session request without a bearer returns `401`.
The task-branch client Preview has branch-scoped `NEXT_PUBLIC_API_ENABLED=true`
and the exact API Preview origin, effective after its next deployment; hosted
auth remains disabled. The native staging profile successfully consumed that
live API v1 and built both unsigned Release targets. Pilot resources and a
positive hosted signed-bearer flow remain unconfirmed. Do not treat these
checks as proof of Preview-to-pilot isolation or integrated authentication.
