# Access register

**Last reviewed:** 2026-09-24 (environment reconciliation).  
**Secret policy:** This register holds owners, safe resource identities, status and next actions only. Never record credentials, tokens, signing material or unredacted fixture data. Detailed verification evidence belongs in the linked PRs. The pre-2026-09-24 narrative version is preserved in Git history.

A `confirmed` status covers only the stated capability. An `unconfirmed` or `deferred` row is a gate on its consuming tasks, not authorization to create accounts or use credentials. A missing row blocks only its listed consumers. Review this register before enabling an integration, adding a service secret, promoting a deployment, or adding a fixture.

Environment terms follow [ENVIRONMENTS.md](ENVIRONMENTS.md): **Local** and **Production** application environments, plus a credential-free Vercel **Preview** deployment context.

| Prerequisite | Owner | Environment / identity | Status | Consuming tasks / next action |
|---|---|---|---|---|
| GitHub repository | Project owner | `cuneytbozok/finpill` (public); `main` | confirmed | Ongoing. Branch protection is not configured. |
| Supabase local | Project owner | Local: disposable `finpill-local` and CI-generated projects | confirmed (PR #4) | Ongoing. |
| Supabase hosted | Project owner | Production: `gsgkoiwjkqbkuyyafzbf` (dashboard branch `main PRODUCTION`) | Production designated 2026-09-24; foundation and 01.06 migrations applied | Called "staging" during 01.06 (2026-09-23, PR #20); the evidence from then is development/test evidence. Before real Production use: switch third-party auth to the live issuer, remove development-issuer trust, remove development test rows, and rotate `SUPABASE_SECRET_KEY`. Storage bucket not created; it is gated by 02.03. |
| Clerk development | Project owner | Local: instance `ins_3JhfrCFuR2VJKzxOXqdjUbaZ1lw`, issuer `https://ample-chicken-233.clerk.accounts.dev`; invite-only; iOS app registered | confirmed (PRs #16, #18, #19) | Local development and 01.10. Must not be configured in Vercel Preview or Production. |
| Clerk live | Project owner | Production: not created | deferred (owner decision 2026-09-24) | Requires an owned domain. Needed for hosted Production authentication, which gates 10.07 and any earlier task that needs hosted signed-in use. |
| Clerk ↔ hosted Supabase trust | Project owner | Development issuer is trusted by the hosted project | historical test configuration | Replace with live-issuer trust as part of hosted Production authentication. |
| Vercel client project | Project owner | `finpill` → Production `finpill.vercel.app` (static client) | confirmed | 01.09 audit (2026-09-24): Preview holds only a branch-scoped, non-secret `NEXT_PUBLIC_API_ORIGIN`. The earlier Clerk keys and API switch were removed; the Clerk development secret should be rotated because it had been in this project. Client-scope Supabase entries were deleted during 01.06 with owner approval. |
| Vercel API project | Project owner | `finpill-api` (`prj_RPrp1YttJigzDOBXIUI3cYGbBjJb`), Root Directory `apps/api` | created during PR #23; Production not deployed | 01.09 audit (2026-09-24): Production has `APP_ENV` and `CLIENT_ORIGINS`; Preview has only `CLIENT_ORIGINS`. The task-branch Preview Ready and served v1 health/CORS. Production deploys once `apps/api/vercel.json` is on `main`; auth stays off until Clerk live. The task-branch Preview domain's Vercel Authentication exception is still in place; remove it after merge. |
| Domain | Project owner | Provisional `finpill.vercel.app`; official domain not selected | deferred | Needed for Clerk live and for OS-verified app links (post-MVP, BC-19). |
| KAP / MKK development | Project owner | Local only: `https://apigwdev.mkk.com.tr/api/vyk`, HTTP Basic (key/secret as username/password) in ignored `apps/api/.env.local`; free plan, 6 calls/min | confirmed for read-only VYK endpoints (02.01, 2026-09-25) | Frozen, sparse snapshot (indexes ~1103282–1231017, about Mar–Dec 2023). The credential was exposed in chat on 2026-09-25; owner rotation pending confirmation. |
| KAP / MKK production | Project owner | Production account, endpoint and token flow not recorded | unconfirmed | 03.01–03.07: confirm permitted endpoint, rate plan and retention terms. Needed for TMS 29 filings and 12-quarter history. |
| Market-data provider | Project owner | Not selected | unconfirmed | 02.08: evaluate and record the decision and rights. |
| AI provider / Vercel AI Gateway | Project owner | Not selected | unconfirmed | 08.01: select the model, account and permitted use. |
| iOS signing | Project owner | Bundle `com.cuneytbozok.finpill`; Personal Team `7NA7D47449` | local signed Release confirmed (PR #18) | Personal Team cannot sign Associated Domains; paid signing is post-MVP. |
| Android signing | Project owner | Application ID `com.cuneytbozok.finpill`; local development keystore | local signed Release confirmed (PR #19) | Distribution signing not selected. |
| Store publication | Project owner | App Store Connect / Google Play not enrolled | deferred | Separate post-MVP release gate. Never commit signing secrets. |
| KAP fixtures | Project owner | MKK development responses; manifest `tests/fixtures/kap/manifest.json` | confirmed for private development testing (owner decision 2026-09-25) | Payloads stay in ignored `tests/fixtures/kap/payloads/`, never committed to this public repository; Git holds origin, retrieval time, hash, rights and expectations only. See [KAP_FIXTURES.md](KAP_FIXTURES.md). |
