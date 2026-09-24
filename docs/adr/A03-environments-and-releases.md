# A03 — Environments and releases

- Status: **Draft, not accepted.** The decision is approved by the owner; implementation evidence is pending in tasks 01.09 and 01.10.
- Revised: 2026-09-24 (owner decision). Originally proposed: 2026-09-22 (task 00.04).
- Owner: project owner for environment identities and access; the implementing task for configuration contracts.

## Context

Finpill is a private application used mainly by its owner, on free tiers of Vercel, Supabase and Clerk where practical, with no near-term public users or store distribution. The architecture uses one static client, bundled into web and Capacitor shells, and a separately deployed API. Installed native clients keep build-time public settings, and API secrets stay server-side.

The 2026-09-22 proposal mirrored an enterprise topology that is unnecessary at this stage.

## Decision (2026-09-24)

1. **Two application/data environments.**
   - `local`: development, automated tests, disposable databases, the Clerk development instance.
   - `production`: the single hosted private application. It consists of Vercel Production, one hosted Supabase project, and a Clerk live instance once hosted authentication is enabled.
   - "Pilot" and "private pilot" describe a usage/release mode of Production, not a separate environment.
2. **Deployment context is not application environment.** Vercel `development`, `preview` and `production` are deployment contexts.
   - Vercel Development maps to `local`, and Vercel Production to `production`.
   - **Preview maps to no application environment.** It is credential-free. It builds and runs with API, authentication, database, privileged, KAP, AI and provider integrations disabled.
   - It rejects Finpill, provider and data-access credentials, and integrations that would need them. It does not reject other server variables, ordinary non-secret settings or Vercel system variables.
   - Isolation between Preview and Production is enforced primarily by the absence of credentials.
3. **Local/CI isolation.** Tests and CI use only local or generated disposable resources and never accept Production credentials, database URLs or project references.
4. **Production fails closed.** Missing required Production configuration fails rather than falling back to Local/development services.
   - Hosted authentication is optional: with `AUTH_ENABLED=false`, Production requires no Clerk configuration at all.
   - When authentication is enabled, Production requires live Clerk keys and rejects development/test keys and the development issuer.
5. **Secret boundaries.** Unchanged from the original proposal:
   - allowlisted build-time public settings
   - server-only secrets with field-name-only error reporting
   - privileged Supabase access enabled separately from user-scoped access
   - browser-bundle and native-artifact secret scans
6. **Release compatibility.** Native clients use the versioned `/api/v1` contract. A new API version is introduced before a v1 contract is removed or changed. Public setting changes require a rebuilt static/native artifact.
7. **Staging is not required now.** A dedicated hosted Staging environment may be introduced when public release, multiple users, store distribution, significant operational risk or release-management needs justify it. Doing so requires revising this ADR.

## Alternatives considered

- **Separate hosted staging and pilot projects (the original proposal):** rejected for this stage. It doubles hosted identity and data infrastructure without protecting a single private user more than credential-free Preview plus Local/CI isolation.
- **Implicit localhost/development defaults:** rejected, because hosted configuration omissions could silently reach the wrong service.
- **One combined server/client config object:** rejected, because it increases accidental disclosure risk.

## Consequences

- No hosted environment exists for credentialed pre-Production testing. Integrated authentication and authorization are proven against Local (task 01.10). Hosted Production authentication is a deferred prerequisite: owned domain, Clerk live instance, and switching the hosted Supabase trust to the live issuer.
- The existing hosted Supabase project, called "staging" during task 01.06, becomes the Production project. Its development-issuer trust and development test rows are cleaned up before real Production use.
- The code still implements `local`/`staging`/`production` and a Preview → `staging` mapping. Task 01.09 migrates it.

## Evidence required for acceptance

- **Task 01.09:**
  - two-value environment contract
  - Preview context with no application environment, verified to reject Finpill, provider and data-access credentials and credentialed integrations (not other server or Vercel system variables)
  - Production fail-closed tests: no Clerk configuration required with `AUTH_ENABLED=false`; live keys required and development keys/issuer rejected when auth is enabled
  - proof that Local/CI cannot target Production
  - separate client/API deployments with deployed v1 health and exact-origin CORS
  - a native release build path with manifest and artifact scans (profile naming and design are decided in 01.09 and need not mirror environment names)
  - a Vercel scope audit confirming no credentials in Preview
- **Task 01.10:** integrated Local proof on web, iOS and Android, as defined in the roadmap.

Accepting A03 does not require hosted Production authentication.

## History

- **2026-09-22 (superseded):** proposed explicit `local`, `staging` and `production` app environments independent of Node build mode, with Vercel Preview deriving `staging`. It also proposed separate Clerk instances and Supabase projects for staging and production/pilot, and Preview isolation from pilot resources. Task 00.04 implemented the schema boundaries under that proposal.
- **2026-09-24:** revised to the two-environment model above by product-owner decision. The superseded staging assumptions are recorded as BC-20 in the [correction register](../BLUEPRINT_CORRECTIONS.md).
