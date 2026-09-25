# Task status

Compact execution state for the [MVP execution plan](MVP_EXECUTION_PLAN.md). The roadmap owns task scope, order, dependencies and acceptance criteria. GitHub owns merge state, implementation history and detailed evidence (PR descriptions, checks and review). This file records only current state, active blockers and exceptions that change future work. Pre-2026-09-24 handoffs are archived, non-canonically, in [archive/TASK_HISTORY.md](archive/TASK_HISTORY.md).

**Last updated:** 2026-09-25 (02.02 merged; 02.03 in review).  
**Next actionable task:** 02.04 (exact numbers); 02.08 (market provider) is also ready. After 02.03 merges: 02.06 (jobs).  
**Architecture gates:** A01–A03 accepted 2026-09-25; A04 accepted 2026-09-25 (PR #28); A05 proposed in the 02.03 PR (accepted on merge); A06–A12 are not accepted. A gate blocks only the work its roadmap row names.

## How to update this file

- The implementation PR updates its own row, for example `complete — PR #N`, in the same PR. If that PR is closed without merging, GitHub merge state wins; correct the row in the next PR that touches this file. Do not open a separate closeout PR.
- States: `pending` (dependencies not met), `ready` (dependencies merged), `in_progress` (an implementation session owns an open branch/PR), `blocked` (a named input, decision or prerequisite change is missing), `complete` (PR merged with its acceptance criteria met or an explicit owner exception recorded below).
- Keep rows to one line. Put evidence in the PR, not here.

## Active work

| Item | State |
|---|---|
| 02.03 | in_progress — PR #29, awaiting owner review |

## Active blockers and prerequisites

| Prerequisite | Blocks | Owner action |
|---|---|---|
| Hosted Production authentication: owned domain → Clerk live instance → hosted Supabase third-party trust switched to the live issuer → development-issuer trust and development test accounts' eligibility and profile rows removed (the original invited account and the 01.10 second test account) → `SUPABASE_SECRET_KEY` rotated (it was once present in the client Vercel project) | 10.07 and any earlier task that needs hosted signed-in use. It does **not** block 01.09, 01.10 or Local development. | Deferred by owner decision on 2026-09-24. Each step is an owner-approved Production or account change. |
| MKK production account, endpoint, token flow and terms | 03.01 onward; the 02.01 evidence gaps (TMS 29 filings, 12-quarter history, FR-level corrections) | Owner confirms access |
| Market-data provider and rights | 02.08 decision, 06.01 | Evaluation under 02.08 |
| AI provider/account | 08.01 | Selection under 08.01 |

## Standing exceptions

- **Production `source-payloads` bucket (2026-09-25):** created by the owner in the hosted project (private, 50 MiB, `application/octet-stream`), matching A05; no further action before Production ingestion.

- **01.02:** the owner waived the unperformed iOS offline check (archived history, 2026-09-23).
- **01.07 / BC-19:** OS-verified HTTPS Universal/App Link opening, the final link domain and paid Apple signing are post-MVP. Safe route handling, sign-in return and Back behavior remain 01.10 acceptance.
- **Local uses the hosted database (2026-09-25):** owner decision; Local may use the hosted Supabase project with user-scoped access only. CI stays on disposable databases. See A03.
- **01.10 web identity switch (2026-09-25):** the owner waived the live web sign-in-return and account-switch run and the reverse-direction (original → second account) matrix; the second-account matrix, web sign-out and the iOS/Android account switches were run.
- **02.01 development-data gaps (2026-09-25):** owner decision to record, not block. The MKK development snapshot (about Mar–Dec 2023) has no TMS 29 filings, no 12-quarter history and no FR-level corrections; these are evidence items for production access and 04.05/04.06, not approximated. Once production access exists, compare its responses with this catalogue and add examples only where needed. See [KAP_FIXTURES.md](KAP_FIXTURES.md).
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
| 01.09 | complete — PR #23; Production API verified in the closeout PR |
| 01.10 | complete — PR #26 |

### Phases 02–10

Every task not listed below is `pending` on its roadmap dependencies.

| Task | State |
|---|---|
| 02.01 | complete — PR #27 (development-data gaps recorded above) |
| 02.02 | complete — PR #28 (A04 accepted) |
| 02.03 | in_progress — PR #29 (A05 proposed) |
| 02.04 | ready |
| 02.08 | ready — needs a provider with permitted pilot use |
