# MVP task status and handoff

**Roadmap:** [MVP_EXECUTION_PLAN.md](MVP_EXECUTION_PLAN.md).  
**Current task:** 01.03 — Clerk web authentication and API bearer verification, 2026-09-23.

**State:** complete — development-instance web sign-in/out, invite-only mode, and protected API acceptance passed; PR #16 merged and CI/Preview passed. See handoff below.

**Application implementation:** Static client routing, responsive shell, theme and UI state primitives; product data features are not implemented.

**Architecture gates:** A01–A12 are not yet accepted; roadmap approval is not validation evidence.  
**Last updated:** 2026-09-23.

## Status convention

| State | Meaning |
|---|---|
| pending | Not started; prerequisite work or gate evidence remains. |
| ready | Task dependencies permit selection; verify external prerequisites and architecture gates before dependent actions. |
| in_progress | One session/worktree owns the task; record owner and base commit. |
| in_review | Deliverables exist; acceptance checks or review remain. |
| blocked | Record the specific missing input/evidence, owner, and next action. Do not claim mocked validation passed. |
| complete | Task deliverables and required acceptance checks are satisfied; record evidence and commit/PR or the explicit bootstrap exception. |

Task IDs, scope, and dependencies are authoritative in the roadmap. This ledger tracks execution only. Recompute readiness after completion or a changed gate; never mark a whole phase complete because its first task passed.

Each task handoff must record task ID, owner/worktree/base commit, deliverables, changed contracts/migrations, verification evidence, remaining blockers, commit/PR, and next ready task.

## Task ledger

### Phase 00 — Repository, toolchain, and prerequisite register

| Task | State | Evidence / handoff |
|---|---|---|
| 00.01 | complete | Baseline commit `da542dea080e124a927f13b57fa633b3cb572380` on `main`; historical handoff below. |
| 00.02 | complete | PR #1 merged as `2f9dd0464eb24defdebdd0576cde513c1057c1a2`; confirmed from GitHub and fetched Git history. |
| 00.03 | complete | See task 00.03 handoff below. |
| 00.04 | complete | PR #3 merged as `bd491ac85dded7f41760e783131a20d3da57eeed`; verified from GitHub and fetched locally. |
| 00.05 | complete | PR #4 merged as `0febc76`; confirmed from fetched `origin/main`. |
| 00.06 | complete | PR #5 merged as `74d0d6b`; [access register](ACCESS_REGISTER.md) records prerequisite owners, status, evidence, and consuming-task gates. See handoff. |

### Phase 01 — Production web/native foundation, authentication, and design system

| Task | State | Evidence / handoff |
|---|---|---|
| 01.01 | complete | PR #7 merged as `9e2185b`; verified from fetched `origin/main`. See handoff. |
| 01.02 | complete | PR #11 merged as `4243be4`. Release builds/artifacts, iOS home/search and Android offline runtime verified. Owner waived the unperformed iOS offline check; see closeout exception below. |
| 01.03 | complete | [PR #16](https://github.com/cuneytbozok/finpill/pull/16) merged as `2489019`; development Clerk sign-in/out, signed bearer access, negative token cases, CI, and Preview passed. See handoff. |
| 01.04 | pending | — |
| 01.05 | pending | — |
| 01.06 | pending | — |
| 01.07 | pending | — |
| 01.08 | complete | PR #8 and BC-18 [PR #14](https://github.com/cuneytbozok/finpill/pull/14) merged. Web, iOS and Android shell evidence plus interactive iOS acceptance are recorded below. |
| 01.09 | pending | — |
| 01.10 | pending | — |

### Phase 02 — Source identity, financial contracts, and recoverable execution

| Task | State | Evidence / handoff |
|---|---|---|
| 02.01 | pending | — |
| 02.02 | pending | — |
| 02.03 | pending | — |
| 02.04 | pending | — |
| 02.05 | pending | — |
| 02.06 | pending | — |
| 02.07 | pending | — |
| 02.08 | pending | — |

### Phase 03 — KAP acquisition and change-driven synchronization

| Task | State | Evidence / handoff |
|---|---|---|
| 03.01 | pending | — |
| 03.02 | pending | — |
| 03.03 | pending | — |
| 03.04 | pending | — |
| 03.05 | pending | — |
| 03.06 | pending | — |
| 03.07 | pending | — |

### Phase 04 — Financial normalization, filing versions, and quality

| Task | State | Evidence / handoff |
|---|---|---|
| 04.01 | pending | — |
| 04.02 | pending | — |
| 04.03 | pending | — |
| 04.04 | pending | — |
| 04.05 | pending | — |
| 04.06 | pending | — |
| 04.07 | pending | — |

### Phase 05 — Deterministic metrics, methodology, and lineage

| Task | State | Evidence / handoff |
|---|---|---|
| 05.01 | pending | — |
| 05.02 | pending | — |
| 05.03 | pending | — |
| 05.04 | pending | — |
| 05.05 | pending | — |
| 05.06 | pending | — |
| 05.07 | pending | — |

### Phase 06 — EOD history, corporate actions, and valuation

| Task | State | Evidence / handoff |
|---|---|---|
| 06.01 | pending | — |
| 06.02 | pending | — |
| 06.03 | pending | — |
| 06.04 | pending | — |
| 06.05 | pending | — |
| 06.06 | pending | — |

### Phase 07 — Complete deterministic product experience

| Task | State | Evidence / handoff |
|---|---|---|
| 07.01 | pending | — |
| 07.02 | pending | — |
| 07.03 | pending | — |
| 07.04 | pending | — |
| 07.05 | pending | — |
| 07.06 | pending | — |
| 07.07 | pending | — |
| 07.08 | pending | — |

### Phase 08 — Disclosure intelligence and evidence retrieval

| Task | State | Evidence / handoff |
|---|---|---|
| 08.01 | pending | — |
| 08.02 | pending | — |
| 08.03 | pending | — |
| 08.04 | pending | — |
| 08.05 | pending | — |
| 08.06 | pending | — |
| 08.07 | pending | — |

### Phase 09 — Company Q&A, “what changed,” and final product integration

| Task | State | Evidence / handoff |
|---|---|---|
| 09.01 | pending | — |
| 09.02 | pending | — |
| 09.03 | pending | — |
| 09.04 | pending | — |
| 09.05 | pending | — |
| 09.06 | pending | — |

### Phase 10 — Cohort completion, operations, hardening, and private pilot

| Task | State | Evidence / handoff |
|---|---|---|
| 10.01 | pending | — |
| 10.02 | pending | — |
| 10.03 | pending | — |
| 10.04 | pending | — |
| 10.05 | pending | — |
| 10.06 | pending | — |
| 10.07 | pending | — |
| 10.08 | pending | — |

## Task 00.01 handoff (historical)

### Scope and ownership

- Owner: Codex, current implementation session.
- Working directory: the existing project directory.
- Worktree/base commit: not applicable; Git initialization is task 00.02.
- Commit/PR: none. Include these verified documents in the initial repository history in task 00.02.
- Scope: documentation adoption only. No application code, packages, migrations, service provisioning, or blueprint rewrite.

### Deliverables

- [Canonical roadmap](MVP_EXECUTION_PLAN.md): all 80 approved tasks, 11 phases, dependencies, acceptance criteria, required tests, ADR gates, milestones, MVP checklist, and execution protocol.
- [Root instructions](../AGENTS.md): plain UTF-8 Markdown, original project rules preserved, Context7 requirement, and approved execution governance.
- [Legacy instructions pointer](agents.md): replaces the RTF duplicate with links to canonical documents.
- [Blueprint correction register](BLUEPRINT_CORRECTIONS.md): all 17 required corrections, owning tasks, ADR mappings, and unapplied status.
- This ledger: execution states and next-task handoff convention.

Only adoption metadata in the supplied roadmap is updated: approved/file status, current-state links, historical repository-state wording, correction-register link, phase-graph interpretation, and obsolete Plan Mode references. Task definitions and acceptance requirements are preserved.

### Verification

Verified on 2026-09-21:

- All 80 task rows match the approved roadmap exactly; all dependency references resolve and the task graph has no cycles.
- All 11 phases, 12 ADR gates, and 17 blueprint corrections are present; the task ledger matches all 80 IDs in order.
- All five adopted/updated documents are plain UTF-8 Markdown, with balanced code fences and 17 valid local links.
- Original project rules and the Context7 requirement are preserved in root instructions; the legacy rules file is a canonical pointer.
- The blueprint is byte-for-byte unchanged. SHA-256: `221d658915a46afdfe7983f908715a0c710c12e666068d974fd1de7941f22008`.
- Repository inventory contains documentation only; no application code, dependencies, migrations, or deployment configuration was added.

Application lint/typecheck/tests are not applicable: this task changes documentation only and the repository has no application toolchain. No architecture gate, live service, native build, or financial result is claimed validated. Git/commit/PR work remains task 00.02 under the bootstrap exception.

### Next task

Select **00.02 — Git/GitHub setup, branch/PR conventions, Node/npm pins, and ignore rules** next.

- Confirm the GitHub owner and repository destination; neither is established by this documentation task.
- Carry the task 00.01 documentation into initial Git history.
- Preserve the blueprint unchanged until an explicit correction change.
- Do not skip 00.02 to scaffold the application.
- Task **00.06 — Access register** is independently eligible after 00.01 and may be selected in a separate session.
- This handoff does not claim that GitHub, Supabase, Clerk, Vercel, KAP, market-data accounts, domains, signing identities, or permitted fixtures are available.

## Task 00.02 handoff (historical)

### Scope and ownership

- Owner: Codex, task 00.02 implementation session.
- Repository: owner-confirmed [cuneytbozok/finpill](https://github.com/cuneytbozok/finpill), public, default branch `main`.
- Base commit: `da542dea080e124a927f13b57fa633b3cb572380`, the task 00.01 documentation baseline, pushed to `origin/main`.
- Worktree: `/Users/cuneytbozok/.codex/worktrees/finpill-00-02/Finpill`.
- Branch: `codex/00.02-repository-foundation`.
- Implementation commit: `c3963da`; subsequent evidence-only commits retain the same task branch.
- PR: [#1 — Repository conventions and pinned toolchain](https://github.com/cuneytbozok/finpill/pull/1), merged on 2026-09-21 as `2f9dd0464eb24defdebdd0576cde513c1057c1a2`. GitHub merged status and local fast-forward to `origin/main` verified.
- Scope: Git/GitHub connection, toolchain pins, ignore/editor rules, root lockfile and contribution/setup documentation. No application scaffold, database migration, service provisioning or blueprint change.

### Deliverables and decisions

- Exact Node 24.21.0 / npm 11.19.0 pins, using the official bundled versions; dependency-free private root manifest and a single root lockfile.
- npm `devEngines` and strict engine checking reject mismatches; version files support common version managers.
- Ignore rules exclude environment secrets, signing files, dependencies and generated output while retaining examples, source files and migrations.
- [Repository setup](REPOSITORY_SETUP.md), [contribution conventions](../CONTRIBUTING.md), root README and PR template describe reproducible setup, worktree ownership, review and handoff.
- No architecture ADR is accepted or changed by this bootstrap task. CI and hosted branch-protection checks are not yet configured; initial CI belongs to task 00.05.

### Verification

- Official macOS ARM64 archive SHA-256 matched Node's published checksum: `bed7eea5325e1108f32ce5228ddd6a5f0f08a499ee42aa7442aea583702f6057`.
- Isolated runtime reports Node `v24.21.0` and npm `11.19.0`. System Node/npm were not replaced.
- Pinned npm generated the root lockfile offline; manifest, lockfile and version-file consistency passed.
- Wrong Node and wrong npm each failed with `EBADDEVENGINES` before installation.
- Ignore-rule checks passed for 13 excluded paths and seven retained example/source paths.
- New local documentation links resolve; blueprint SHA-256 remains unchanged from task 00.01.
- Fresh local clone of implementation commit `c3963da` passed `npm ci --offline --no-audit --no-fund` with the pinned toolchain; the root lockfile was unchanged and the working tree remained clean.
- Final diff review checks task scope, local links and tracked-file hygiene. Markdown trailing spaces introduced in the ledger were removed before the final diff check.
- Application lint/typecheck/tests are not available until task 00.03; none is claimed passed.

### Next-task readiness

After review and merge acceptance for 00.02, mark it complete and select **00.03 — Client/API/contracts npm workspace, strict TypeScript, lint, formatting, unit-test and build commands** from the merged commit. Until then, 00.03 remains pending. Task 00.06 remains independently ready.

GitHub ownership and repository access are confirmed. Other service access, native signing, fixture rights and data-provider prerequisites remain unverified and belong to task 00.06 and their consuming tasks. No pilot data or credentials were committed.

## Task 00.03 handoff (historical)

### Scope and ownership

- Owner: Codex, task 00.03 implementation session.
- Base commit: `2f9dd0464eb24defdebdd0576cde513c1057c1a2` (merged PR #1).
- Worktree: `/Users/cuneytbozok/.codex/worktrees/finpill-00-03/Finpill`.
- Branch: `codex/00.03-workspace-foundation`.
- Implementation commit: `c833576`.
- PR: [#2 — Static client, Node API and shared contracts](https://github.com/cuneytbozok/finpill/pull/2), merged on 2026-09-22 as `9e2e9ffb920536a41be07d2b9785ed8f61bd197f`; GitHub merged state and local fast-forward verified.
- Scope: npm workspace, independent Next.js application targets, shared contracts, strict TypeScript, lint/format/unit-test/build commands and import-boundary checks. No product screens, routing adapters, authentication, secrets, migrations or service provisioning.

### Deliverables and contracts

- `@finpill/client`: minimal Turkish placeholder page, statically exported to `apps/client/out/`.
- `@finpill/api`: Node.js API with `GET /api/v1/health`; process liveness only.
- `@finpill/contracts`: platform-neutral, strict Zod liveness DTO and API version constant, consumed as source by Next.
- Root npm scripts provide independent app builds and `npm run check`; one lockfile records exact direct dependencies.
- ESLint rejects server imports/actions and cross-workspace/build-config imports from client/shared source, including dynamic and type imports. Tests exercise rejection and allowed cases.
- [Workspace guide](WORKSPACE.md) explains boundaries, commands, tooling compatibility and parallel-worktree constraints.
- No ADR gate was accepted. A01–A03 still require actual routing, native, identity and deployment evidence.

### Verification

- Pinned-toolchain `npm ci --offline --no-audit --no-fund` passed.
- Fresh local clone of `c833576` independently passed frozen installation and `npm run check`, with unchanged lockfile and clean tracked files afterward.
- `npm run check` passed: formatting, zero-warning lint, strict app/contracts/test type checks, 23 tests, static client production build and separate API production build.
- Production API smoke: GET returns exactly the v1 liveness DTO with `Cache-Control: no-store`; POST returns 405. The temporary server was stopped.
- Static export contains the Turkish HTML document and local Next static assets, without an API/server output directory.
- Dependency audit after remediation reported zero vulnerabilities; `npm ls --depth=0` reports the expected linked workspaces and versions without invalid peer dependencies.
- React review: semantic root/main/heading, Turkish document language, no data-fetch waterfalls, effects, global mutable state or unnecessary dependencies in the placeholder.
- Documentation links, all three locked workspaces and absence of nested lockfiles verified. Blueprint remains byte-for-byte unchanged.
- CI, native builds, authenticated services and financial outputs were not tested because they do not exist in this task.

### Vercel installation correction — 2026-09-22

The first Vercel preview for `8aa2e76` failed before installation because the manifest required Node 24.21.0 while Vercel supplied 24.19.0. Vercel supports selection by major version and manages minor/patch updates.

- Keep the exact local Node version files and npm `packageManager` reference; allow `24.x` and `11.x` consistently in `engines`, `devEngines` and lockfile metadata.
- Retain strict engine enforcement and exact dependency/lockfile versions. No force flags or deployment-specific bypass were added.
- Reproduced the original `EBADDEVENGINES` with official checksum-verified Node 24.19.0 and bundled npm 11.17.0. The corrected manifest installs; unsupported Node 25 still fails.
- Clean installation and the full check command pass on Node 24.19.0/npm 11.17.0; the full check also passes on the local reference Node 24.21.0/npm 11.19.0. Both runs include 23 tests and both production builds.
- This supersedes the earlier exact-patch rejection policy in the historical 00.02 handoff. Exact local references and supported hosted-runtime ranges serve different purposes.
- The next preview passed the installation/build stage but failed because Vercel expected `public` (owner-provided build error). Added root `vercel.json` selecting the client build and `apps/client/out` explicitly, with frozen installation. The project's Root Directory must remain the repository root. The API stays a separate deployment target.
- Hosted verification of the output-directory correction remains pending. The Vercel connector reports no authorization for the project's team; GitHub deployment status remains available.

### Next-task readiness and parallel ownership

After PR review and merge, mark 00.03 complete. Tasks **00.04 — Environment schemas** and **00.05 — Local database/CI** become ready; **00.06 — Access register** is already independently ready. Do not mark these tasks complete based on this scaffold.

00.04 and 00.05 may use separate worktrees after their common prerequisite merges, with one coordinator handling root dependency/lockfile and task-ledger changes. Different worktrees need distinct local ports and explicitly isolated databases; worktrees isolate files, not external resources. No additional agents or user-owned chats were launched in this session.

## Task 00.04 handoff

### Scope and ownership

- Owner: Codex, task 00.04 implementation session; sole owner of shared environment contracts and manifest/lockfile edits.
- Base commit: `9e2e9ffb920536a41be07d2b9785ed8f61bd197f`, merged PR #2, verified against GitHub and fetched locally.
- Worktree: `/Users/cuneytbozok/Documents/Projeler/Finpill/.worktrees/00.04`.
- Branch: `codex/00.04-environment-validation`.
- Implementation commit: `d3bf1ff`; PR [#3 — Validate public and server environment configuration](https://github.com/cuneytbozok/finpill/pull/3), opened and attached to the Codex task. Review and merge remain.
- Publication explicitly approved by the owner on 2026-09-22. GitHub initially flagged a fixed fake secret canary; test values now generate at runtime. Unpublished commits were consolidated to remove the flagged literal; no published history was rewritten.
- Scope: environment validation, credential-free examples, environment matrix, tested public/server boundaries and draft A03. No service provisioning, provider calls, migrations, financial changes or blueprint rewrite.

### Deliverables and changed contracts

- [Environment matrix and setup](ENVIRONMENTS.md), per-app `.env.example` files and [draft A03](adr/A03-environments-and-releases.md).
- Public environment schema/reader: required app environment/API origin, explicit auth prerequisites, public-name allowlist and literal build-time replacements.
- Server schema: required app environment/client origins; conditional auth, user-scoped database, privileged data and KAP requirements. Service flags default disabled; no origin/credential defaults.
- Server validation at configuration load and Node runtime startup; field-only errors. Client/shared lint rejects environment access outside the validated reader and existing server import restrictions remain.
- Current Supabase publishable/secret key types are distinguished. Privileged access is separately enabled and must not authorize ordinary user requests.
- New `npm run test:environment-build` command performs actual invalid/valid build and runtime checks plus a static secret-canary scan.
- Existing builds/type generation now require explicit environment settings. Hosted client previews must set `NEXT_PUBLIC_APP_ENV=staging` and their actual HTTPS `NEXT_PUBLIC_API_ORIGIN`; no URL was invented or written to an external deployment.

### Verification

- `npm run check` passed on Node 24.21.0/npm 11.19.0: formatting, zero-warning lint, strict type checks, 55 tests and both independent production builds.
- Actual build/runtime smoke passed: missing API origin, unknown public variable and missing server environment reject builds; valid API serves v1 liveness; invalid runtime environment stops startup. The sandbox initially blocked a loopback listener; the rerun with local-listener permission passed.
- All 21 client export files were scanned for fake Clerk, Supabase and KAP secret canaries; none appeared. Browser JavaScript includes the configured public API origin.
- Blueprint SHA-256 remains `221d658915a46afdfe7983f908715a0c710c12e666068d974fd1de7941f22008`.
- Context7 consulted for Next/Zod/Supabase configuration; current Supabase changelog and key guidance reviewed. No live service, hosted deployment, native build, authorization or RLS validation is claimed.
- Fresh clone of `729f56e`: frozen offline installation, full `npm run check`, and `npm run test:environment-build` passed; lockfile and tracked tree remained unchanged. No service `.env` files were copied.
- After replacing fixed fake canaries with runtime-generated test values, full checks (55 tests and both builds) and the build/runtime artifact scan passed again. GitHub accepted the consolidated branch without a push-protection bypass.
- Changed-document links resolve; final diff whitespace check passed.

### Next-task handoff

Task **00.05 — Local database/CI** and independent **00.06 — Access register** are ready. Prefer 00.05 next; CI should supply explicit disposable/local environment settings from the matrix. Task **01.01** becomes ready only after 00.04 merges. Public runtime reads for transport must use the validated reader; do not scatter `process.env` across client code.

A03 remains draft. Native origins/application IDs, service ownership, preview/pilot isolation, real credentials, KAP production protocol and installed-client release compatibility still need their owning tasks' evidence. AI/market-provider requirements must be added when providers are selected. No architecture gate is accepted by these schema tests.

### Task 00.04 Vercel metadata correction — 2026-09-22

- The owner-reported hosted build failed because the client validator treated Vercel's framework-prefixed public metadata as unknown application settings. A regression test reproduced the exact error before the fix.
- Added an exact platform metadata allowlist from current Vercel framework documentation and builder source, verified through Context7. Metadata is stripped from Finpill's parsed settings and does not replace the required app environment or API origin. Unknown public names, including Vercel-prefixed tokens/secrets, still fail.
- Full check passes: formatting, lint, typecheck, 57 tests and both production builds. Build/runtime smoke also passes with injected Vercel metadata; all 21 static artifacts remain free of generated secret canaries.
- Hosted confirmation remains pending. The Vercel build-log connector returned `Tool get_deployment_build_logs not found`; use the GitHub deployment status to follow the new commit. No hosted environment values were changed.
- Hosted commit `9ca9833` still failed with an unknown public name (owner supplied the new log). The exact CLI 59.23.2 dependency, `@vercel/build-utils` 14.10.1, confirms the known platform names plus injected `VERCEL_GIT_*` metadata. No broad prefix exemption was added. Errors now identify rejected variable names without values, with regression coverage; the full 57-test check and both builds pass. Hosted completion is blocked until the remaining name is identified from project settings or the diagnostic build log.


### Vercel scaffold configuration follow-up

- Owner confirmed no manually configured Vercel environment variables. The static placeholder now defaults API access to disabled; `NEXT_PUBLIC_API_ORIGIN` is required only with `NEXT_PUBLIC_API_ENABLED=true`. Supplied origins still validate, and no service URL is synthesized.
- With `VERCEL=1`, the client build maps Vercel preview/production/development to staging/production/local, then inlines that validated public environment. Explicit app environment values take precedence; unknown deployment values fail. Server requirements are unchanged.
- Added documented `NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA`, which the exact CLI builder prefixes but the framework-variable page omits. New smoke coverage builds with zero manually configured app variables and Vercel metadata. This supersedes the earlier requirement for an API origin on an API-disabled scaffold.
- Task 01.01 must use the validated API-enabled flag and configure a real origin before transport requests. A successful placeholder deployment does not validate API reachability or any architecture gate.
- Verification: full check passed with 61 tests, strict types, lint, formatting and both production builds; the expanded zero-manual-variable Vercel scaffold build and secret-canary/runtime smoke passed.
- The diagnostic hosted log for `3156c70` identified `NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG` as the remaining rejected name. Added that exact platform setting, kept it outside parsed app configuration, and included it in unit and zero-manual-variable build smoke fixtures. Full checks (61 tests and both builds), runtime smoke and all 21 artifact scans passed again. This resolves the identified code defect; hosted verification follows the new commit.
- Hosted verification passed: GitHub's Vercel status for implementation commit `007e74778b20ceaa4efbafe057bb1e9b225f626e` is `success`; [successful deployment](https://vercel.com/cuneyts-projects-ec980692/finpill/936WnTnEajTKaSNfYvASswGDNRCf). The configuration-load build failure is resolved without manually configured project variables. Task 00.04 remains in review pending PR acceptance/merge.


## Task 00.05 handoff

- Owner: Codex, sole owner of task 00.05 configuration, migration baseline, root dependency/lockfile and workflow changes.
- Base: `bd491ac85dded7f41760e783131a20d3da57eeed`, merged PR #3, verified from GitHub and fetched locally.
- Worktree: `/Users/cuneytbozok/Documents/Projeler/Finpill/.worktrees/00.05`; branch `codex/00.05-database-ci`.
- Deliverables: pinned Supabase CLI, local Postgres configuration, CLI-generated no-domain-schema baseline migration, pgTAP checks, isolated replay runner with target guard tests, two-job CI and [database development guide](DATABASE_DEVELOPMENT.md).
- No product schema, provider access, secret, hosted project or architecture gate is introduced. A03 remains draft; blueprint unchanged.
- Owner decision (2026-09-22): local Docker is deferred. `npm run db:test` therefore remains unavailable on the laptop by design; the hosted GitHub Actions Docker runner is the required migration replay evidence before completion.
- Verification: full `npm run check` passed (formatting, zero-warning lint, strict typecheck, 68 tests, both builds). Frozen offline `npm ci` and real environment build/runtime smoke passed; all 21 static export files remain free of secret canaries. Document links/diff whitespace checks pass and blueprint SHA-256 is unchanged.
- PR/publication: [PR #4](https://github.com/cuneytbozok/finpill/pull/4) is open. Owner authorized publication on 2026-09-22 so that hosted database acceptance can run.
- First hosted run: [quality passed](https://github.com/cuneytbozok/finpill/actions/runs/35762529841/job/106863852613). The database replay applied the baseline twice and passed all five pgTAP checks, then failed while a test probe assumed a generated Docker container name. The runner now uses the CLI's explicit `supabase db query --local` instead.
- Hosted acceptance passed on [CI run #2](https://github.com/cuneytbozok/finpill/actions/runs/35763173280): [quality](https://github.com/cuneytbozok/finpill/actions/runs/35763173280/job/106866037121) passed `npm run check`, environment smoke and generated-file verification; [database](https://github.com/cuneytbozok/finpill/actions/runs/35763173280/job/106866037487) passed the disposable `npm run db:test` migration replays, CLI probe, resets and pgTAP checks. PR review and merge are the only remaining step.
- Next ready tasks after review: 00.06 access register and 01.01 runtime interfaces. Select one per session; use an isolated worktree and respect remaining architecture gates.

## Task 00.06 handoff

- Owner: Codex, sole owner of the access-register documentation and ledger update.
- Base: `0febc76`, merged PR #4, verified from fetched `origin/main`.
- Worktree: `/Users/cuneytbozok/.codex/worktrees/00-06-access-register/Finpill`; branch `codex/00.06-access-register`.
- Deliverable: [access register](ACCESS_REGISTER.md) records the required GitHub, Supabase, Clerk, Vercel, KAP/MKK, market-provider, domain, native-signing, and fixture prerequisites, plus the current AI-provider gate. Each row has an owner, environment/identifier status, evidence/rights disposition, and consuming task.
- Confirmed evidence is deliberately narrow: the public GitHub repository and merged PRs, disposable local Supabase CI replay, and credential-free static Vercel preview. Hosted service access, production origins, identities, data rights, fixtures, and signing identities are unconfirmed rather than guessed.
- Verification: internal document links resolve; register contains no credential-shaped values; task scope remains documentation only. Application lint, typecheck, tests and builds are unchanged by this task and were not rerun as task evidence.
- No service account, secret, domain, fixture, migration, provider selection, or architecture gate was created or accepted. The blueprint remains unchanged.
- Publication: PR #5 merged as `74d0d6b`; verified from fetched `origin/main`.
- Next ready task in roadmap order: **01.01 — Static client entry, shared route registry, API transport, `AuthPort` and platform interfaces**. Its web/API implementation may begin, but native/auth and service-access gates remain unaccepted; select it in a new isolated implementation session.

## Task 01.01 handoff

- Owner: Codex, sole owner of the shared client route, transport and platform contracts.
- Base: `d1f520b5a26cbd8b96786af1712332d0efd1def3`, fetched `origin/main` after PRs #5 and #6 merged.
- Worktree: `/Users/cuneytbozok/.codex/worktrees/01-01-runtime-interfaces/Finpill`; branch `codex/01.01-runtime-interfaces`.
- Implementation commit: `f22a65e2983fce588c5ddcc47402e98179a671e0`, rebased onto current `origin/main`. [PR #7](https://github.com/cuneytbozok/finpill/pull/7) is open for review.
- Deliverables: centralized canonical route parser/builders for every approved fixed and company section URL; a browser navigation adapter; minimal asynchronous `AuthPort`; validated, version-scoped API transport with centralized bearer-token acquisition and response validation; and a static client shell using those interfaces.
- Static delivery: Vercel’s configured SPA rewrite directs unknown canonical paths to `index.html`, where the route registry resolves arbitrary tickers without a build-time ticker list. Other web hosts and future native shells must provide the equivalent entry-asset fallback. No server-side client routing, client credential, or API request from the API-disabled shell was added.
- Verification: credential-free local `npm run check` passed with formatting, zero-warning lint, strict type checks, 85 tests, static client build and API build. `npm run test:environment-build` passed its invalid-configuration, runtime-liveness and static secret-artifact checks. New route/transport tests cover arbitrary ticker paths, malformed/unknown paths, history-safe route construction, token propagation, network failures, malformed response rejection, and Vercel’s static fallback configuration.
- Browser verification: the local static shell visibly rendered its navigation and content, and client navigation from home to `/search` worked without an error overlay. [Hosted Vercel preview](https://finpill-git-codex-0101-runtime-8acf64-cuneyts-projects-ec980692.vercel.app/company/XYZ.123/ratios) loaded an arbitrary ticker route directly and after browser refresh; `/unknown` rendered the app's not-found state. The initial static HTML briefly displays the home placeholder before route hydration. No Capacitor shell, Clerk adapter, real API endpoint, or authentication flow is claimed verified.
- No migration, financial calculation, service credential, RLS behavior, or architecture gate was added or accepted. A01–A03 remain draft/unaccepted.
- Next-task handoff: after 01.01 review/merge, select the first eligible Phase 01 task. 01.02 and 01.03 depend on the now-merged 00.06 access register; consuming tasks must still verify their specific external prerequisites. Do not start dependent work before verifying the final merged ledger and external-access state.

## Task 01.02 readiness reassessment — 2026-09-23

- Owner: project owner supplied the private-use application identity and local signing decision; Codex reconciled the task prerequisites. Base for this documentation update: `32fccfc`, fetched `origin/main`.
- Decision: both iOS bundle ID and Android application ID are `com.cuneytbozok.finpill`. Local Xcode/Personal Team development signing and Android development/debug signing are permitted when needed for simulator, emulator or personal-device testing.
- Readiness: 01.01 and 00.06 are merged. The 01.02 acceptance criteria require release-mode bundled assets, cold starts and artifact inspection, but do not require App Store Connect, Google Play Console, paid Apple Developer Program enrollment or production signing. [Apple documents Personal Team testing on owned devices](https://developer.apple.com/help/account/basics/about-your-developer-account), and [Android Studio creates debug signing material for local runs](https://developer.android.com/studio/publish/app-signing). The requirement to prove production-style asset delivery is retained. Task 01.02 is ready to implement, not accepted.
- Deferred access: production certificates, production keystore custody and store account ownership are external prerequisites only if a later deployment/distribution method needs them. Reassess at 01.09/10.07; store publication remains a separate post-MVP gate. See the updated [access register](ACCESS_REGISTER.md).
- Roadmap clarification: the private-use signing/store rule is explicit in [MVP_EXECUTION_PLAN.md](MVP_EXECUTION_PLAN.md) without changing task 01.02's deliverables or acceptance checks.
- Verification: compared the approved 01.02 roadmap row with owner-provided identifiers and official Capacitor, Apple and Android local-run/signing guidance. No native project, build, simulator, device, secret, migration or architecture gate was created or verified by this documentation update.
- Next action: start 01.02 in a new isolated implementation worktree from verified `origin/main` after this readiness correction merges. Preserve 01.08's draft review state; its native acceptance can follow the 01.02 shell proof. Clerk instance access remains a separate 01.03 prerequisite.

## Task 01.02 implementation handoff

- Owner: Codex; branch `codex/01.02-capacitor-shells`; worktree `/private/tmp/finpill-01-02-capacitor`.
- Base: verified `origin/main` at `60407d6`; existing user checkout preserved.
- Scope: bundled static client in Capacitor iOS/Android projects, release configuration and native acceptance evidence.
- Deliverables: pinned Capacitor 8.5.2 native projects, SPM lock, shared `out` asset input, disabled WebView debugging, opt-in Android local signing for non-debuggable Release builds, build/sync/inspection commands and CI static asset check. [Native build guide](NATIVE_SHELLS.md) contains reproducible commands and acceptance steps.
- Verification: `npm run check` passed formatting, zero-warning lint, typecheck, 88 tests and both builds. `npm run test:environment-build` passed invalid-config/runtime, production-liveness and secret-canary checks (22 static files). Production client export and native sync passed; both staged bundles match all 22 exported files by hash. These are staged assets, not compiled native artifact acceptance.
- Negative artifact checks: temporary copied bundles with stale entry content, `.next` output, a remote shell URL and a synthetic secret pattern were each rejected.
- Native attempts: Xcode 26.6 resolved Capacitor Swift 8.5.2 but both generic and existing iOS 26.2 simulator Release destinations failed with “iOS 26.5 is not installed”; install/repair it in Xcode → Settings → Components. Android `./gradlew assembleRelease -PfinpillLocalSigning` failed because no Java runtime exists; Android Studio and the default SDK directory are absent.
- User action: install/repair Xcode's requested iOS platform; install Android Studio (2025.2.1+), its JDK, API 36 SDK/build tools and an emulator via SDK/Device Manager. Configure local Java/SDK paths outside the repository. No credentials, paid store enrollment or chat secrets are required. Then resume this same branch for Release builds, actual artifact inspection and offline cold starts on both platforms.
- No architecture gate is accepted; A01–A03 remain unaccepted. No migration, financial logic, auth adapter, API origin contract or deep-link integration changed. 01.08's merged PR still has outstanding native acceptance; its stale open/draft ledger description was reconciled without claiming that acceptance passed.
- Next action: remain on 01.02 until tooling and native acceptance are complete. No later task was started. Implementation commit `20f821a`, generated whitespace correction `cded9e8`; [draft PR #11](https://github.com/cuneytbozok/finpill/pull/11).


## Task 01.02 restart handoff — 2026-09-23

- Resume the existing `/private/tmp/finpill-01-02-capacitor` worktree on `codex/01.02-capacitor-shells`, PR #11. Do not create duplicate work. Fetched `origin/main` remains `60407d6`; its ready/unstarted ledger is stale relative to this verified branch. Current committed HEAD is `890a8ce`; this session’s viewport fix, guide and evidence are uncommitted at the owner-requested restart checkpoint.
- Owner reported native tooling installed. Xcode 26.6 / iOS SDK 26.5 now builds the simulator Release app successfully. Android Studio bundles Java 25, which fails Gradle 8.14.3 with class-file major version 69. Downloaded official Temurin JDK 21 into `/tmp/finpill-jdk21/jdk-21.0.12.1+1/Contents/Home`; using it makes Android Release compilation pass.
- Installed SDK platform 36 and build tools 35.0.0. Owner explicitly approved accepting the Google APIs ARM emulator-image license; API 36 image installation completed. Official ARM command-line tools 22.0 checksum verified and installed in `~/Library/Android/sdk/cmdline-tools/22.0`. Created dedicated `Finpill_API_36` (Pixel 7); emulator startup is in progress, not yet runtime acceptance.
- Native screenshot exposed header/status-bar overlap. Added typed `viewportFit: "cover"` export in the shared Next.js layout so existing CSS safe-area insets apply. Rebuilt iOS screenshot visibly clears the status bar; tapping Search displays “Ara”. No dev server was listening on 3000/3001 at verification. Captured final home evidence in [ios-home.png](evidence/01.02/ios-home.png); earlier corrected search screenshot remains `/tmp/finpill-ios-search.png`.
- Code checks passed after the viewport change: formatting, zero-warning lint, typecheck, 88 tests (7 files), both Next.js builds. Log: `/tmp/finpill-native-resume-check.log`. Initial attempts without required environment values, then with unsupported `test` app environment, failed configuration validation; rerun with the established CI `local` environment passed.
- After checks, ran one final production sync with API/auth disabled and rebuilt both native artifacts. `node tools/check-native-assets.mjs /tmp/finpill-ios-release/Build/Products/Release-iphonesimulator/App.app /tmp/finpill-apk-final/assets` passed all 22 exported asset hashes and native configuration for both compiled artifacts. Do not rebuild the web export alone before repeating inspection: generated build IDs change and require another sync/native rebuild.
- Android APK: `apps/client/android/app/build/outputs/apk/release/app-release.apk`, SHA-256 `daf847dba6d28a4140978dab031d3a753d04ad04c68d89042f155474887ddf95`. Compiled manifest has no debuggable/testOnly attribute (default false); additionally verify installed application flags. iOS Release app: `/tmp/finpill-ios-release/Build/Products/Release-iphonesimulator/App.app`; executable SHA-256 `c9302ac2af613c14cc022c5d0c24a7870b7ee9f12bfd702edf5bf5417b4c00d7`; bundled `public/index.html` SHA-256 `97b751faf91b8c342134f79a8bb0ecec4f92a4a7eceda804c6394ff6436655f3`.
- Logs: `/tmp/finpill-ios-release-build.log`, `/tmp/finpill-android-release-build.log`, `/tmp/finpill-native-resume-sync.log`, `/tmp/finpill-sdk-image-install.log`, `/tmp/finpill-emulator.log`. Node/npm toolchain: `/tmp/finpill-toolchain/node-v24.21.0-darwin-arm64/bin`. iOS simulator UDID: `FB422F68-22F0-4137-BDB4-B4853BA67DE2`. Android serial was `emulator-5554`; recheck boot status after restart.
- Pause reason: desktop UI capture intermittently fails with ScreenCaptureKit error `-3811`. Owner offered to close/reopen Codex to apply permissions and asked to wait. No native runtime check is substituted with a mock. Simulator command-line access works; normal iOS rendering/search was observed during a period when UI automation recovered.
- Remaining: install final APK on the booted emulator; verify non-debuggable Release flags, cold-start home and Search navigation; verify offline cold starts and asset loading on both platforms; save screenshots/outcomes, update acceptance state, commit and push PR #11 changes. A question requesting permission to briefly disconnect/restore Mac Wi-Fi for the iOS offline proof is still unanswered; **do not disconnect the host network without that approval**. No host network settings have been changed. Android offline checks can use its dedicated emulator. Re-read current PR status before publishing. A01–A03 remain unaccepted, 01.08 acceptance remains separate, and no later task was started.


## Task 01.02 runtime acceptance handoff — 2026-09-23

- Resumed after Codex restart in the same worktree/branch. Fetched origin and verified PR #11 remains open/draft; the canonical ledger still understates the implemented task. No new task or worktree was started.
- Both final compiled artifacts were re-inspected successfully against all 22 production-export assets; hashes recorded above remain the artifact identities. No implementation changes were made after the passing 88-test full check.
- Android: installed the locally signed, non-debuggable Release APK on `Finpill_API_36`, Pixel 7 / Google APIs ARM64 / API 36. Package flags contain `HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP` and do not contain `DEBUGGABLE` or `TEST_ONLY`. Normal cold start returned `Status: ok`, `LaunchState: COLD` (1827 ms), and the home screen rendered. No server listened on ports 3000/3001.
- Android offline: disabled Wi-Fi and mobile data only inside the dedicated emulator. `dumpsys connectivity` reported `Active default network: none`, and a network probe failed with `Network is unreachable`. Force-stop/relaunch returned `Status: ok`, `LaunchState: COLD` (599 ms). Home rendered and tapping Search displayed “Ara”. Saved [home](evidence/01.02/android-home.png), [offline home](evidence/01.02/android-offline-home.png), and [offline search](evidence/01.02/android-offline-search.png). Restored emulator Wi-Fi/mobile data afterward. Owner explicitly authorized ADB interaction when the UI tool could not attach to the standalone emulator.
- iOS: Release cold-start rendering and Search navigation passed with no development server, including corrected safe-area spacing. Saved [home](evidence/01.02/ios-home.png) and [search](evidence/01.02/ios-search.png). The Search capture uses the same corrected source before the final export rebuild; it is navigation/layout evidence, while the final artifact hashes independently prove packaging.
- Remaining acceptance: owner chose to perform the iOS offline test manually instead of authorizing host-network changes. Disconnect the Mac’s Wi-Fi, fully quit/reopen Finpill in the iPhone 17 Pro simulator, verify home and Search render, reconnect and report the outcome. No host network setting was changed by Codex. Do not mark this check passed without the owner’s result or equivalent observed evidence.
- Publication: PR #11 remains draft pending that result. Safe-area fix and native evidence were committed and pushed as `ca90824`; the PR description now reflects the verified runtime outcomes. Once the iOS offline result is recorded, finish 01.02 acceptance and review handoff; do not start another task in this session. No architecture gate is accepted, and 01.08’s broader native design-system acceptance is not claimed complete.


## Task 01.02 owner acceptance and merge closeout — 2026-09-23

- Verified PR #11 merged into `origin/main` as `4243be4aca1ff9b2689cdc80f5e9062e129bb656` after fetch/prune. Documentation closeout uses branch `codex/01.02-closeout`, worktree `/private/tmp/finpill-01-02-closeout`, based on that merged commit; the user's checkout is unchanged.
- Owner explicitly stated that the manual iOS offline test was not performed, would not be performed, and that the implementation was accepted and PR merged. Task 01.02 is complete by owner acceptance with this scoped verification exception.
- **Waived, not passed:** iOS cold-start/Home/Search with the host network unavailable. Existing iOS Release build, compiled-asset inspection, no-development-server rendering and Search evidence remain valid; they do not prove the waived offline condition. Android offline acceptance remains verified.
- This exception closes only task 01.02. It does not accept A01–A03, waive later authentication/lifecycle/release checks, or complete task 01.08's broader native acceptance. Preserve the unverified iOS offline condition in future gate assessments rather than treating the merge as test evidence.
- Validation for this closeout: verified GitHub merge and fetched commit; checked the ledger state and exception text; documentation formatting and diff checks only. No code changed and no code/native tests were rerun; prior implementation results remain recorded above.
- Next-session handoff: task 01.03 is the next roadmap candidate; re-run canonical task discovery and verify its prerequisites before selecting it. No later task was started in this closeout.


## Research-navigation documentation alignment — 2026-09-23

- Owner: Codex, implementing the product owner's explicit approval to align documentation before resuming implementation. Single-session scope is BC-18 only; no roadmap implementation task was selected or started.
- Branch/worktree/base: `codex/docs-research-navigation`, `/private/tmp/finpill-docs-research-navigation`, verified `origin/main` at `ad860e37c6353e6e50759cac1af5b7c5470dad0c`. Existing user checkout and implementation worktrees were not changed.
- Deliverables: blueprint v0.4; revised roadmap acceptance for 01.07–01.08, 07.01, 07.05–07.06, 07.08 and 09.02–09.04/09.06; BC-18 application record; [illustrative mockup](design/research-navigation-mockup.png). Three primary destinations and contextual analysis/Q&A replace primary Search/AI tabs. Private company Q&A remains in scope. Comparison labels, independent freshness, sources and readable mobile layouts are explicit.
- Contracts/migrations: documentation only; no code, schema, API transport or architecture-gate change. Existing `/search` and company AI URLs remain; `/ai` compatibility behavior is specified for implementation. All other correction-register entries remain unapplied.
- Reconciliation: fetched/pruned origin and verified GitHub PR #8 is MERGED (2026-09-22T23:29:14Z). Its original five-destination implementation/evidence does not satisfy BC-18. Preserve task 01.08 as in_review until revised shell behavior and outstanding web/native acceptance are verified. No architecture gate is accepted.
- Verification: PASS — `git diff --check`; balanced Markdown fences; newly introduced relative links resolve; all roadmap task IDs/order/dependencies unchanged; obsolete five-destination/global-selector requirements removed; BC-18 is part of the correction table; saved mockup SHA-256 matches the attachment. Prettier excludes `docs/` by repository policy, so its no-op check is not claimed as document validation. Code lint/typecheck/tests and native checks were not rerun (documentation/image only); no new runtime acceptance is claimed.
- Publication: documentation commit `8408f56`; [PR #13](https://github.com/cuneytbozok/finpill/pull/13) is open for review. This revision must merge into origin/main before it becomes canonical task-discovery input.
- Next-session handoff: re-run fetch/prune and canonical discovery. Reconcile actionable 01.08 acceptance work first under the existing-task rule, using its existing branch/worktree and merged documentation; do not duplicate the task. Scope that work to revised shell/routing entry behavior and native design-system acceptance, leaving real directory results to 07.01 and AI features to Phase 09. If no actionable 01.08 work can proceed, consider 01.03 after prerequisite verification. Preserve 01.02's iOS offline exception as waived, not passed. Stop this session after documentation verification/publication.

## Task 01.08 BC-18 shell acceptance handoff — 2026-09-23

- Owner: Codex. Continued the existing `codex/01.08-design-system` branch/worktree, moved to `.worktrees/01.08` for writable access and fast-forwarded from verified `origin/main` base `3230c9295afd30af2c74af9c6acae8bdbf964621`. The user's `main` checkout remained unchanged.
- Deliverables: three primary destinations on mobile and desktop; persistent mobile search control and desktop input with Ctrl/⌘K; focused `/search` detail with return/focus restoration; company-context analysis action; legacy `/ai` replacement to `/search`; static entry pages for fixed routes. Real directory results and AI generation remain later-task scope. No schema, API, authentication, or financial contract changed.
- Verification: `npm run check` passed under the documented local disabled-integration environment (Prettier, lint, typecheck, 88 tests, client/API builds). Browser verified three desktop destinations, search entry/return focus, and direct `/ai` to `/search`. `npm run native:sync` verified 42 identical static assets in both native projects. iOS Release simulator build, app asset inspection, install and launch passed; [home screenshot](evidence/01.08/ios-home.png) shows safe areas and three destinations. Android Release build and install passed on `emulator-5554`; cold start returned `Status: ok`, `LaunchState: COLD` (984 ms), and package flags omitted `DEBUGGABLE` and `TEST_ONLY`. [Home](evidence/01.08/android-home.png), [Search](evidence/01.08/android-search.png), and [Watchlist](evidence/01.08/android-watchlist.png) screenshots show the revised mobile shell.
- Remaining acceptance: interactive iOS search, all three destinations, return/focus behavior, and narrow-screen accessibility checks require a working Simulator UI connection or owner run. Simulator visual automation failed with a ScreenCaptureKit stream error; only its launched Home screen was captured. Do not count this as full native acceptance. Hosted preview verification and PR review also remain. A01–A12 remain unaccepted; preserve task 01.02's waived iOS offline exception.
- Publication: implementation/evidence commit `66521dd`; [PR #14](https://github.com/cuneytbozok/finpill/pull/14) is open for review.
- Next-session handoff: reconcile PR #14 and finish the remaining 01.08 acceptance on this branch/worktree. If it is only awaiting external review and does not block later work, select the next ready roadmap task under canonical discovery, likely 01.03 after prerequisite verification. Do not duplicate 01.08 or infer any architecture gate passed.

## Task 01.08 acceptance closeout — 2026-09-23

- Owner: Codex. Reused the existing `.worktrees/01.08` worktree for the acceptance run, then created `codex/01.08-acceptance-closeout` from verified `origin/main` commit `0e5c5fb` for this ledger-only update. The user's `main` checkout was not changed. GitHub reports PR #14 merged, with successful quality, database, and Vercel checks.
- Closeout publication: commit `b67d305`; [PR #15](https://github.com/cuneytbozok/finpill/pull/15) is open for review.
- Interactive iOS acceptance: on the booted iPhone 17 Pro / iOS 26.5 Simulator, the installed Release shell displayed Home with safe areas and three readable navigation labels. Search opened from Home and More with its input focused. Back returned to the originating destination; pressing Return immediately afterward reopened Search, confirming focus restoration to its entry control. Watchlist and More each rendered with the corresponding selected navigation item. The empty-state content remained legible and no clipping was visible at this phone width.
- Narrow-screen secondary-text check: the rendered phone UI showed complete navigation labels and secondary copy. The committed light-theme secondary token `#5d6977` has contrast ratios of 5.60:1 on white, 5.27:1 on the page background, and 5.03:1 on the muted surface; the dark-theme secondary token `#b3c0cc` has 8.78:1 on its surface and 7.76:1 on its muted surface. These exceed the 4.5:1 normal-text threshold. This check uses the existing iPhone 17 Pro viewport; it does not claim a separate 320-pixel device run.
- Prior PR #14 evidence covers web shell/search behavior, Android Release cold start and navigation, both native builds and packaged assets, and the 88-test full check. This closeout changes documentation only; code lint, typecheck, tests, and native builds were not rerun. `git diff --check` and document checks validate this update.
- No contracts, migrations, product data features, or architecture gates changed. Task 01.02's waived iOS offline check remains waived rather than passed. Next session: re-run canonical discovery and verify Clerk access prerequisites for task 01.03 before implementation. Do not start 01.03 in this session.

## Task 01.03 implementation handoff — 2026-09-23

- Owner: Codex; worktree `.worktrees/01.03`, branch `codex/01.03-clerk-web-auth`, base `813017f` from verified `origin/main` after PR #15 merged. Implementation commit `5c459d2` is in [PR #16](https://github.com/cuneytbozok/finpill/pull/16). The user's `main` checkout was not changed.
- Deliverables: pinned `@clerk/react` web adapter behind the existing `AuthPort`, with sign-in and account controls only on the web runtime of the shared static bundle; pinned `@clerk/backend` bearer verifier on the separate API; `GET /api/v1/session` protected endpoint with explicit browser-origin handling and no-store responses; typed session response contract; [web auth guide](WEB_AUTH.md) and updated access/environment documentation. No migration, native auth adapter, RLS policy, pilot eligibility rule, or architecture gate changed.
- Clerk evidence: the owner supplied a development-instance issuer and keys through ignored local environment files. The Backend API returned instance `ins_3JhfrCFuR2VJKzxOXqdjUbaZ1lw` as development; the dashboard showed Invite-only access selected. An invited account signed in through the local web UI, the client displayed “Oturum doğrulandı” after a `200` bearer response from the separate API, and sign-out restored “Giriş yap.” The owner entered the password; no credential value was copied into code, commands, fixtures, or this handoff. An uninvited sign-up was not attempted; the dashboard setting is the invitation restriction evidence.
- Negative verification: real Clerk JWT verification against generated RSA fixtures rejected unsigned, malformed, expired, future, wrong-issuer, wrong-authorized-party, missing-authorized-party, missing-session, and tampered requests (11 auth tests). Live local API returned `401` for unsigned and invalid bearer requests, `403` for an unknown browser origin, and `204` with only the allowed origin/Authorization header for valid preflight. The client and API builds remained separate.
- Full `npm run check` passed on pinned Node 24.21.0/npm 11.19.0: Prettier, zero-warning lint, strict typecheck, 99 tests, static client export, and API build. `npm run test:environment-build` passed isolated from ignored local env files: invalid-build/runtime checks, production liveness, and 43-file static scan. An additional 43-file scan found no server secret value in the client export. Browser checks showed the sign-in modal, no framework overlay in the isolated browser, and complete controls without horizontal overflow at 390 and 320 CSS pixels. A Chrome extension caused a development-only hydration warning by adding an attribute to `<html>`; it did not occur in the isolated browser run.
- Deployment blocker outside local 01.03 acceptance: the owner reported a Vercel production build of `813017f` failing because a `pk_test_` value is present in Production, while `NEXT_PUBLIC_APP_ENV=production` requires a live key even when the key is merely supplied. The Vercel page showed both Clerk keys scoped to All Environments. Automatic approval review rejected changing the Production scope; the owner then chose to keep both keys in All Environments for now. No Vercel scope was changed by Codex. That production build remains unverified and must be corrected with approved environment isolation or live pilot keys before 01.09/01.10; do not weaken the production-key validation or count this as A03 evidence.
- Closeout: [PR #16](https://github.com/cuneytbozok/finpill/pull/16) merged into `origin/main` as `2489019ba40626044d8b20aeeed1308df75e555d`, verified by fetch and GitHub. The final implementation commit passed CI quality and database jobs, including `npm run check`, native sync, environment smoke, and database tests; Vercel Preview passed. Hosted authentication and Production remain unverified. After this ledger closeout merges, re-run canonical discovery; 01.04 is the next roadmap candidate, subject to its native SDK and release-mode prerequisites. Keep the 01.02 iOS offline waiver and A01–A12 unaccepted.
