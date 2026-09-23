# Access register

**Task:** 00.06 — Access register  
**Last reviewed:** 2026-09-22  
**Secret policy:** This register contains ownership, status and evidence references only. It must never contain credentials, tokens, project URLs that disclose private resources, signing material, or unredacted fixture data.

## Operating rules

- `confirmed` means only the cited capability has evidence; it does not imply access to another environment or service.
- `unconfirmed` is a dependency gate, not authorization to create an account, configure a service, or use credentials.
- The project owner controls access grants and must update this register when an environment, owner, permitted use, or consuming task changes.
- Store secrets only in the approved service secret manager or local ignored environment file. Refer to a secret by service and environment, never by value.

## Register

| Prerequisite | Owner | Environment / identifier | Status | Rights or evidence | Consuming tasks / next action |
|---|---|---|---|---|---|
| GitHub repository | Project owner | `cuneytbozok/finpill`; `main` integration branch | confirmed | Repository and merged PRs #1–#4 are present in the configured `origin`; repository setup guide records it as public. | Ongoing. Maintain branch protection/required-check policy before relying on it for releases. |
| Supabase local workflow | Project owner | Disposable local `finpill-local` Supabase/Postgres instance | confirmed | Task 00.05 GitHub Actions replay passed; no hosted project or credentials are implied. | 01.06, 02.02 onward. Hosted staging/pilot projects, RLS and service ownership require separate evidence. |
| Supabase hosted project and Storage | Project owner | Staging and pilot project IDs: not recorded | unconfirmed | No hosted project, Storage bucket, Data API, or credentials were configured by tasks 00.04–00.05. | 01.06, 01.09, 02.03. Obtain isolated project ownership and project identifiers without recording keys here. |
| Clerk | Project owner | Development instance `ins_3JhfrCFuR2VJKzxOXqdjUbaZ1lw`; issuer `https://ample-chicken-233.clerk.accounts.dev` | development web acceptance confirmed; staging/pilot pending | Owner supplied the issuer and confirmed keys in ignored local files and Vercel. A read-only Backend API check returned this development instance. Dashboard Access mode showed Invite-only selected; an invited test account signed in and out through the local web shell, and its bearer request passed the separate protected API. No credentials or personal details are recorded here. Staging and pilot instances remain unconfirmed. | 01.04–01.06 and 01.10. Preserve separate native auth acceptance and establish pilot identity plus approved deployment scopes before integrated proof. |
| Vercel client preview | Project owner | Existing Finpill client project; deployment URL is recorded in the 00.04 handoff | confirmed | GitHub Vercel status passed for 00.04. This proves the credential-free static scaffold build only. | 01.09. Confirm project ownership, staging/pilot isolation and API deployment separately. |
| Vercel API deployment | Project owner | Project/domain: not recorded | unconfirmed | The API is intentionally a separate deployment target; no API project or production origin is configured. | 01.09. Create/confirm isolated target and record non-secret project and origin identifiers. |
| KAP / MKK | Project owner | Development and production accounts/endpoints: not recorded | unconfirmed | The blueprint keeps production authentication TBD pending permitted account/documentation evidence; no credentials or protocol validation exists. | 03.01–03.07. Confirm account owner, environment, permitted endpoint, rate plan and retention terms before implementation. |
| Market-data provider | Project owner | Provider and environment: not selected | unconfirmed | No provider, historical coverage evidence, license, or pilot storage/display rights have been selected. | 02.08. Evaluate candidates and record the decision and rights evidence before an adapter is built. |
| AI provider / Vercel AI Gateway | Project owner | Provider/model and account: not selected | unconfirmed | The blueprint names an integration approach, not an account, model, credential, or usage approval. | AI-consuming tasks. Select under the relevant task and add owner, environment and permitted use. |
| Domains and deep-link hosts | Project owner | Production, staging and universal/app-link domains: not recorded | unconfirmed | No domain ownership, DNS control, redirect host or mobile association-file evidence exists. | 01.07, 01.09. Confirm owner and isolate preview/staging/pilot hosts. |
| iOS local identity and signing | Project owner | Bundle ID `com.cuneytbozok.finpill`; Personal Team `7NA7D47449` | simulator build confirmed; device provisioning unverified | Task 01.04's Xcode inspection initially found automatic signing with no team. The owner then selected Personal Team `7NA7D47449` for Debug and Release in the task worktree; Codex did not edit signing settings. The Release simulator build passed unsigned, so physical-device provisioning remains unverified. | 01.04. Use the actual signing App ID Prefix for Clerk native registration and verify a signed device build if device testing is chosen. |
| Android local identity and signing | Project owner | Application ID `com.cuneytbozok.finpill`; local development/debug signing where needed | owner-confirmed plan; runtime unverified | Owner confirmed personal/private use on 2026-09-23. Android project, emulator/device build and signing behavior still require task evidence. | 01.02 and 01.05. Use local debug signing for installation where needed; verify bundled-asset cold start and inspect artifacts. |
| Production signing and store ownership | Project owner | Apple Developer Program/App Store Connect, Google Play Console, production certificates and keystore custody: not selected | deferred | No App Store or Google Play publication is planned in the near term. Task 01.02 does not require store enrollment or production credentials for its local shell proof. | Reassess at 01.09/10.07 only if the chosen release/distribution method technically requires these assets; otherwise retain as a separate post-MVP store-publication gate. Never store signing secrets in the repository. |
| KAP financial-report fixtures | Project owner | Permitted source set and manifest: not selected | unconfirmed | No raw KAP payload or rights/provenance manifest is tracked. | 02.01, 03.01, 04.02–04.03. Select a diverse, permitted cohort and record retrieval time, hash, origin and usage rights. |

## Review triggers

Review this register before enabling an integration, adding a service secret, promoting a deployment, adding a fixture, or changing the responsible owner. A missing row blocks only its listed consuming tasks; it does not block unrelated roadmap work.
