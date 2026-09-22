# Workspace foundation

Task 00.03 establishes the build and verification structure. It does not accept the production web/native, routing or authentication gates in A01–A03.

## Layout and ownership

| Workspace | Responsibility | Output |
|---|---|---|
| `apps/client` / `@finpill/client` | Shared Next.js static client, currently a placeholder page | `apps/client/out/` |
| `apps/api` / `@finpill/api` | Next.js Node.js API and server-only modules | `apps/api/.next/` |
| `packages/contracts` / `@finpill/contracts` | Platform-neutral schemas and DTOs | TypeScript source consumed by each app |

Both apps transpile the shared contracts package directly. No separate package publish/build step or extra build orchestrator is required. Contracts have no Node or browser ambient types; runtime DTO validation uses Zod. Do not export database rows, credentials, provider clients or financial-domain implementations from this package.

The only endpoint is `GET /api/v1/health`, returning `{"status":"ok","apiVersion":"v1"}` with `Cache-Control: no-store`. It reports process liveness only. It does not claim database/provider readiness and contains no user data. The client does not call this endpoint yet.

All application source lives under each workspace's `src/`. Place API integrations/domain services under `apps/api/src/server/` and mark server entry modules with `import "server-only"`. Do not add routes, server actions or request-time features to the statically exported client.

## Commands

Run commands at the repository root with the pinned Node/npm versions:

| Command | Purpose |
|---|---|
| `npm ci` | Install the one committed root lockfile |
| `npm run dev:client` | Client development server on port 3000 |
| `npm run dev:api` | API development server on port 3001 |
| `npm run build:client` | Build/export client independently |
| `npm run build:api` | Build API independently |
| `npm run start --workspace @finpill/api` | Serve the built API on port 3001 |
| `npm run lint` | ESLint, including workspace import boundaries |
| `npm run typecheck` | Generate Next route types; strictly check apps, contracts and TypeScript tests |
| `npm test` | Run contract and boundary tests once |
| `npm run test:watch` | Watch unit tests |
| `npm run format:check` / `npm run format` | Check/write source and config formatting |
| `npm run check` | Formatting, lint, types, tests, then both production builds |

Next-generated route types, `next-env.d.ts`, output and caches stay ignored. Each app's typecheck runs `next typegen`, so a fresh checkout does not require a previous build.

Prettier excludes existing documentation and the lockfile to preserve approved documents without unrelated reformatting. Review Markdown edits and local links separately.

## Import-boundary enforcement

The ESLint boundary rule checks client/shared source imports, re-exports, dynamic imports, CommonJS imports, TypeScript import types and server-action directives. It resolves local paths and aliases against the workspace TypeScript configuration.

- Client source may import its own source, public shared contracts and browser-compatible dependencies.
- Shared contracts may import their own source and platform-neutral dependencies.
- Neither may import API source, Node builtins, server-only Next helpers, server-marked modules or build configuration.
- Computed dynamic imports are rejected because their target cannot be checked statically.
- Unresolved modules fail TypeScript checking. Dependency compatibility and package contents still require review; this lint rule is not a security sandbox or a substitute for asset/secret inspection.

Tests exercise allowed paths and rejection cases, including cross-application relative imports and aliases. Next's own server-only checks add a separate build-time guard.

## Tooling choices

Next.js/React and runtime dependencies are exact-pinned in workspace manifests; development tools are exact-pinned at the root. TypeScript 5.9.3 is within the installed TypeScript ESLint parser's supported range. ESLint 10 uses the official Next plugin directly, plus TypeScript and React Hooks recommended rules, avoiding incompatible peer ranges in the aggregate Next config. See the [official custom Next ESLint setup](https://nextjs.org/docs/app/api-reference/config/eslint).

The frozen lockfile records the actual dependency graph. Review `npm audit` results rather than applying forced dependency upgrades. The current build and tests do not require optional filesystem-watcher install hooks.

## Handoff boundaries

### Current Vercel client preview

The root `vercel.json` deploys the static client only: frozen installation with `npm ci`, `npm run build:client`, and output `apps/client/out`. Keep this project's Root Directory at the repository root (blank in Vercel). The explicit output overrides the generic `public` default; the framework is `null` (Other) because Vercel serves the exported assets rather than a Next.js server.

The API needs a separate Vercel project rooted at `apps/api`, using the Next.js preset and access to shared workspace files. Do not point that project at the root client configuration or deploy `apps/api/.next` as static files. Coordinated deployments and environment isolation remain task 01.09. This preview configuration does not establish native routing, authentication, or API deployment readiness.

Task 00.04 owns validated environment configuration. Task 00.05 owns local database setup and CI. Task 01.01 owns API transport and shared route/platform interfaces; tasks 01.02–01.10 prove native/auth deployment behavior. This placeholder page is not a product screen, and the static build alone does not prove Capacitor routing or authentication.

Parallel worktrees must use distinct development ports when running the same app simultaneously. Files are isolated; host ports and external services are not. Coordinate changes to root dependencies, contracts and shared configuration before merging.
