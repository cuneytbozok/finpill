# Task status

Compact execution state for the [MVP execution plan](MVP_EXECUTION_PLAN.md). The roadmap owns task scope, order, dependencies and acceptance criteria. GitHub owns merge state, implementation history and detailed evidence (PR descriptions, checks and review). This file records only current state, active blockers and exceptions that change future work. Pre-2026-09-24 handoffs are archived, non-canonically, in [archive/TASK_HISTORY.md](archive/TASK_HISTORY.md).

**Last updated:** 2026-09-24 (01.09 rework on the Local + Production contract).  
**Next actionable task:** 01.09 is `in_progress` on [PR #23](https://github.com/cuneytbozok/finpill/pull/23). Its code is complete; deployed acceptance waits on the owner Vercel actions below.  
**Also ready:** 02.01 (depends only on 00.06). It needs owner-supplied KAP fixture rights before source payloads are committed.  
**Architecture gates:** A01–A12 are not accepted. A gate blocks only the work its roadmap row names.

## How to update this file

- The implementation PR updates its own row, for example `complete — PR #N`, in the same PR. If that PR is closed without merging, GitHub merge state wins; correct the row in the next PR that touches this file. Do not open a separate closeout PR.
- States: `pending` (dependencies not met), `ready` (dependencies merged), `in_progress` (an implementation session owns an open branch/PR), `blocked` (a named input, decision or prerequisite change is missing), `complete` (PR merged with its acceptance criteria met or an explicit owner exception recorded below).
- Keep rows to one line. Put evidence in the PR, not here.

## Active work

| Item | State |
|---|---|
| 01.09 — [PR #23](https://github.com/cuneytbozok/finpill/pull/23) | Reworked after PR #24 merged (the branch merges `main`; no history rewrite). The `local`/`production` contract, Preview credential rejection, Production auth fail-closed rules, CI isolation, the `production` native release profile and artifact scans are implemented, and GitHub CI passes. Both Vercel Preview builds for `6977da7` failed **as designed** on the guarded Preview variables listed below. Deployed health/CORS, the scope audit and a native release run are pending owner action. |

## Active blockers and prerequisites

| Prerequisite | Blocks | Owner action |
|---|---|---|
| Hosted Production authentication: owned domain → Clerk live instance → hosted Supabase third-party trust switched to the live issuer → development-issuer trust and development test rows removed → `SUPABASE_SECRET_KEY` rotated (it was once present in the client Vercel project) | 10.07 and any earlier task that needs hosted signed-in use. It does **not** block 01.09, 01.10 or Local development. | Deferred by owner decision on 2026-09-24. Each step is an owner-approved Production or account change. |
| Vercel Preview scopes are not credential-free. The `6977da7` Preview builds reported client Preview `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `NEXT_PUBLIC_API_ENABLED`, and API Preview `APP_ENV`. A Clerk secret in the client project must also be treated as exposed to that project's builds. Also needed: API Production `APP_ENV=production` plus exact `CLIENT_ORIGINS`; re-evaluate the task-branch Preview domain's Vercel Authentication exception. The Vercel connector and CLI cannot read team-scope settings until the owner authorizes them. | 01.09 acceptance (deployed health/CORS, scope audit) | Remove the listed Preview variables; rotate the Clerk development secret key; set API Production settings. See PR #23. |
| KAP fixture source set and usage rights | 02.01 commits of real payloads | Owner selects a permitted source set |
| KAP/MKK account, endpoint and terms | 03.01 onward | Owner confirms access |
| Market-data provider and rights | 02.08 decision, 06.01 | Evaluation under 02.08 |
| AI provider/account | 08.01 | Selection under 08.01 |

## Standing exceptions

- **01.02:** the owner waived the unperformed iOS offline check (archived history, 2026-09-23).
- **01.06:** the browser-issued API path and two-account isolation were not verified. Both move into 01.10, run against Local.
- **01.07 / BC-19:** OS-verified HTTPS Universal/App Link opening, the final link domain and paid Apple signing are post-MVP. Safe route handling, sign-in return and Back behavior remain 01.10 acceptance.
- **Hosted auth deferral (2026-09-24):** 01.10 proves integrated authentication against Local. Hosted Production authentication is the prerequisite listed above, not an unperformed 01.10 check.

## Task states

### Phase 00–01

| Task | State |
|---|---|
| 00.01 | complete — baseline `da542de` |
| 00.02 | complete — PR #1 |
| 00.03 | complete — PR #2 |
| 00.04 | complete — PR #3 |
| 00.05 | complete — PR #4 |
| 00.06 | complete — PR #5 |
| 01.01 | complete — PR #7 |
| 01.02 | complete — PR #11 (iOS offline waiver) |
| 01.03 | complete — PR #16 |
| 01.04 | complete — PR #18 |
| 01.05 | complete — PR #19 |
| 01.06 | complete — PR #20 (two checks moved to 01.10) |
| 01.07 | complete — PR #21 (BC-19 deferral) |
| 01.08 | complete — PR #8, PR #14 |
| 01.09 | in_progress — PR #23 (awaiting owner Vercel actions for deployed acceptance) |
| 01.10 | pending — 01.09 |

### Phases 02–10

Every task not listed below is `pending` on its roadmap dependencies.

| Task | State |
|---|---|
| 02.01 | ready — needs KAP fixture rights before payloads are committed |
