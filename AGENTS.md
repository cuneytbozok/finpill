# Finpill project rules

Finpill is a private, owner-used MVP developed mainly by one owner with coding agents. Principle: **production-grade data model, startup-grade delivery process.** The product, data and security rules below are strict. The process around them is intentionally light.

## Document ownership

| Document | Owns |
|---|---|
| [`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md) | Current approved product architecture, system invariants and technical baseline. |
| [`docs/MVP_EXECUTION_PLAN.md`](docs/MVP_EXECUTION_PLAN.md) | Task scope, order, dependencies and acceptance criteria. |
| [`docs/adr/`](docs/adr/) | Consequential architecture decisions only. Ordinary implementation needs no ADR. |
| [`docs/TASK_STATUS.md`](docs/TASK_STATUS.md) | Compact current execution state, active blockers and standing exceptions. |
| [`docs/ACCESS_REGISTER.md`](docs/ACCESS_REGISTER.md) | External prerequisites: owner, safe resource identity, status, consuming task. |
| [`docs/BLUEPRINT_CORRECTIONS.md`](docs/BLUEPRINT_CORRECTIONS.md) | Traceability for blueprint corrections; canonical only for rows still `recorded`. |
| Operational docs (`docs/ENVIRONMENTS.md`, `docs/DATABASE_DEVELOPMENT.md`, setup/auth/deep-link guides) | Setup, deployment and how-to instructions. |
| GitHub PRs and checks | Implementation history, detailed verification evidence, CI results and review. |

Do not copy the same evidence into several documents. `docs/archive/` is historical and non-canonical.

## Session lifecycle

1. Fetch `origin` and use the latest `origin/main` as the base. Do not modify the owner's existing checkout.
2. Check open and recently merged task PRs (`gh pr list --state all`) together with `docs/TASK_STATUS.md`. If they disagree, GitHub merge state wins; fix the row in your task PR.
3. Pick the first actionable roadmap task: its dependencies are merged and nothing it depends on is blocked. Continue an open task PR before starting a new task.
4. Load only that task's roadmap row, the contracts and code it touches, and any ADR or blueprint section it explicitly depends on. Do not read the whole blueprint, all ADRs, archived history or unrelated phases unless the task changes architecture or you find an actual inconsistency.
5. Create or reuse the task's branch/worktree. Implement a complete vertical slice within the task scope.
6. Run risk-appropriate tests (below). Update only the documents the change actually affects, plus the task's row in `docs/TASK_STATUS.md`, in the same PR.
7. Open one PR and stop for owner review and merge. There is no separate closeout session or PR.

If a task is blocked by external/owner input: record the blocker in `docs/TASK_STATUS.md`, tell the owner exactly what is needed (information safe to share in chat, secrets to configure outside chat, and console actions, kept separate), never claim the check passed, and continue with a genuinely independent ready task where that is safe. A blocker blocks only its dependent work.

Use Context7 or external documentation only when the task depends on unverified or version-specific library/API behavior. Say so explicitly if required verification is unavailable.

## Owner approval

Ask the owner explicitly before:

- any Production mutation (data, configuration, deployments beyond the normal merge flow)
- destructive data operations
- paid resources
- account, credential or provider-configuration changes
- irreversible actions
- architecture changes
- product-scope decisions

Do not stop for ordinary, reversible implementation choices.

## Testing tiers

- **Tier 1, every code change:** formatting, lint, typecheck and directly affected unit tests. The cheap full CI (`npm run check`, database replay) still runs on every PR.
- **Tier 2, contract-specific, when relevant:**
  - migration replay
  - pgTAP/RLS tests
  - parser fixtures and golden tests
  - financial metric tests
  - API integration
  - environment and secret-leakage tests
- **Tier 3, platform/release, only when triggered or at milestone tasks:**
  - deployed Vercel checks
  - iOS/Android Release builds and device or emulator tests
  - native lifecycle checks
  - signed artifact checks

Manual native checks are required only when native platform code, shared runtime behavior affecting native, the auth bridge, routing/deep-link integration or release configuration changes, or when a milestone task (for example 01.10, 07.08, 10.07) requires full platform proof. Backend and data work does not trigger device testing. Do not repeat established native evidence unless relevant code changed. Keep the inexpensive automated secret and native-asset scans. Attach ordinary UI screenshots to the PR; do not commit them as canonical evidence.

Run lint, typecheck and tests before declaring a code task complete. For documentation-only changes, run the documentation checks and report code checks as not applicable, not passed. Missing access or failed validation stays explicit; never replace required live, native or golden evidence with a passing mock.

## Branches and PRs

- One isolated branch/worktree per implementation task, named `codex/<task-id>-<short-description>`. No worktrees or branches for status-only or post-merge bookkeeping. Prune merged-task worktrees when they are clean.
- One task per PR is the norm. Tightly coupled tasks may share a PR only when splitting them would be artificial and the review boundary stays clear.
- The PR description carries the evidence: behavior, tests run by tier, migrations/contracts, exceptions and remaining blockers.
- The owner merges. Do not force-push shared branches or rewrite published history.

## Architecture

- Next.js + TypeScript.
- One statically bundled Next.js client shared by web and Capacitor iOS/Android, with a separate Next.js server/API deployment.
- Supabase PostgreSQL and private Storage.
- Clerk authentication; verified user identity and Supabase RLS for user-owned data.
- Vercel deployment.
- Capacitor for mobile; validate production runtime, routing, authentication, environment configuration, assets, and deep links early.
- KAP/MKK is the primary fundamental-data source.
- Do not expand MVP scope. The private pilot and 20-company validation cohort must not become architectural limits.
- **Environments:**
  - There are two application/data environments: **Local** (development, automated tests, disposable databases, the Clerk development instance) and **Production** (the single hosted private application: Vercel Production, one hosted Supabase project, and a Clerk live instance once hosted authentication is enabled).
  - "Private pilot" is a usage/release mode of Production, not a separate environment.
  - Vercel **Preview** is a credential-free deployment context, not an application environment. It must never receive Production data-access, identity, provider, KAP, AI or privileged credentials.
  - Local and CI must never target Production resources or use Production credentials.
  - Production configuration fails closed and never falls back to Local/development services.
  - A hosted Staging environment may be added later only if public release, multiple users, store distribution or operational risk justify it. See [A03](docs/adr/A03-environments-and-releases.md).

## Financial correctness

- AI must NEVER calculate authoritative financial metrics.
- Financial calculations must be deterministic.
- Never overwrite raw KAP data.
- Preserve filing versions and restatements.
- Use Decimal/Numeric for financial calculations.
- Never use JS floating point for authoritative monetary values.
- Every derived metric must have lineage and methodology version.
- Preserve exact raw values; use lossless source parsing and decimal strings at authoritative transport boundaries.
- Reject unsupported financial comparisons rather than guessing compatibility, periods, or TMS 29 adjustments.
- Keep raw sources, normalized facts, deterministic metrics, and AI interpretations separate.

## KAP parser

- Context / ReportItem / Value can be object or array.
- Always normalize cardinality, including language fields.
- Use actual source context dates.
- Never infer calendar quarters blindly.
- Preserve raw sign and preferredLabel.
- Preserve source concept, hierarchy, units, context, source revision, and parser-build identity.
- Never silently repair malformed source data or publish partially processed replacements as complete.

## Frontend

- React components must not understand raw KAP taxonomy.
- Use centralized number/currency/percentage formatters.
- Support loading, empty, error and stale-data states.
- Mobile-first.
- Follow UX rules in PROJECT_BLUEPRINT.md and the approved shared routing architecture.
- Keep secrets, privileged database clients, financial calculations, and integration code server-side.

## Engineering invariants

- Add tests with every parser/metric change; establish fixture/golden expectations before changing behavior.
- Every database schema change must use a migration; never edit an applied migration. External API responses require runtime validation.
- Ingestion is idempotent; source revisions and history are append-only.
- Versioned or backward-compatible API contracts protect installed native clients.
- Do not silently change architecture. Record a consequential architecture decision as an ADR and update the blueprint in the same PR.
- Keep secrets out of commits, logs, fixtures, client/native bundles and PR text. Secrets live only in ignored local files, CI-scoped secrets or the hosting provider's secret store.
