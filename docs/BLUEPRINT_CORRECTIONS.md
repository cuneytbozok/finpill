# Blueprint correction register

**Current blueprint:** [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) v0.5 (2026-09-24). v0.4 applied BC-18; v0.5 applied the rest except the recorded part of BC-16.  
**Role:** traceability only. The blueprint itself is the current architecture baseline and does not need this overlay to be understood. This register is canonical only for rows or parts still marked `recorded`.

Applying a correction documents approved direction and invariants. It does not claim implementation and does not accept an ADR. Concrete schemas, algorithms and methodologies remain with their owning roadmap tasks and ADRs.

## Status convention

- `recorded`: captured; the blueprint does not reflect it yet.
- `applied`: the blueprint reflects it; the version is noted.
- `superseded`: a later approved decision replaced it; the replacing correction is named.

## Register

| ID | Blueprint sections | Required correction | Owning tasks | ADR or decision | Status |
|---|---|---|---|---|---|
| BC-01 | §4–5, §25, §37, §44 | replace the ambiguous “same Next.js application in Capacitor” assumption with the approved shared static client plus separate Next.js API architecture and early native proof. | 01.01, 01.02, 01.09, 01.10 | A01, A03 | applied (v0.5) |
| BC-02 | §22–24 | retain canonical product routes, specify client-side routing/deep-link adapters, and introduce versioned API contracts. | 01.01, 01.07 | A01, A03 | applied (v0.5) |
| BC-03 | §12.18, §32 | define Clerk text identities, native authentication adapters, Supabase third-party JWT integration, RLS and separate user/operator/machine authorities. | 01.03–01.06 | A02 | applied (v0.5) |
| BC-04 | §12.1–2, §12.13 | separate issuer identity from security/ticker identity; key prices by security and retain effective-dated mappings. | 02.02, 06.01 | A04 | applied (v0.5) |
| BC-05 | §12.4, §28.4 | replace the single mutable disclosure payload with logical disclosures, immutable source revisions and acquisition observations. | 02.03, 03.04 | A05 | applied (v0.5) |
| BC-06 | §12.6–11, §18 | define explicit context/source/build identity, comparative restatements, selection policies and atomic publication. | 02.05, 04.01, 04.05 | A05, A07 | applied (v0.5) |
| BC-07 | §11, §15–18 | add compatibility and applicability requirements for quarter, TTM, TMS 29, EBITDA, net debt and historical valuation. | 02.05, 05.01–05.05, 06.03 | A07, A09, A10 | applied (v0.5) |
| BC-08 | §12.8, §19, §40 | make lossless source parsing and decimal-string transport explicit; avoid irreversible source rounding and numeric JSON examples for authoritative amounts. | 02.04, 04.03, 08.03 | A06, A11 | applied (v0.5) |
| BC-09 | §12.19, §28–31 | add claim/lease/fencing/recovery fields, transactional checkpoint rules, source-wide rate budgets and version-aware idempotency. | 02.06, 02.07, 03.03 | A08 | applied (v0.5) |
| BC-10 | §28.1–4 | qualify unchanged-index behavior with verified correction semantics and bounded reconciliation. | 03.01, 03.03, 03.05 | A05, A08 | applied (v0.5) |
| BC-11 | §17, §37, §41 | make historical share counts, corporate actions, publication-time joins and EOD provider dependencies explicit. | 02.08, 06.02–06.04 | A10 | applied (v0.5) |
| BC-12 | §21, §47 | add persistent generation identities, evidence validation, conversation ownership, retrieval evaluations and embedding-version cutover. | 08.01, 08.03, 08.05, 08.06, 09.02 | A11, A12 | applied (v0.5) |
| BC-13 | §37–39, §50–51 | replace the original execution sequence with this dependency-driven roadmap. | 00.01 | Execution-order approval; relevant ADRs retain their own gates | applied (v0.5; §37–39, §50–51 superseded by the roadmap) |
| BC-14 | §42 | record the owner-selected 20-company × 12-quarter cohort target, deliberate structural coverage and full-market-capable architecture. | 02.01, 10.01 | Product-owner decision; A04, A07 where applicable | applied (v0.5) |
| BC-15 | §3, §14, §22 | clarify EOD valuation as required; preserve later-phase returns/scoring and optional notifications as deferred. | 05.01, 06.04, 07.06 | Product-owner scope; A09, A10 | applied (v0.5) |
| BC-16 | §43–45 | define measurable performance/recovery targets, source-specific freshness, native/API release compatibility and required operational acceptance. | 01.09, 02.05, 10.03, 10.04, 10.06, 10.07 | A03, A07, A08 | partially applied (v0.5): environment and release-compatibility parts applied (staging aspects superseded by BC-20); measurable performance/recovery targets **recorded** for 10.04/10.06 |
| BC-17 | §48 | distinguish permitted private-pilot use from public redistribution/store/billing release gates. | 00.06, 02.08, 10.07 | Product-owner release boundary; A10 | applied (v0.5) |
| BC-18 | §22–23, §28.1, §28.5 | Three primary destinations, persistent search without a tab, four company tabs with contextual saved analysis/Q&A, legacy `/ai` compatibility, explicit periods/comparison bases, independent freshness and validated takeaway sources. Preserve company Q&A; no unrestricted user regeneration. | 01.07–01.08, 07.01, 07.05–07.06, 07.08, 09.02–09.04, 09.06 | Product-owner approval on 2026-09-23; blueprint v0.4; branch `codex/docs-research-navigation` and documentation PR recorded in TASK_STATUS.md. No architecture gate accepted. | applied (v0.4) |
| BC-19 | §22.4, §23.18, §37, §44 | Keep canonical web and in-app company routes in MVP while deferring OS-verified HTTPS Universal/App Link opening, final link domain and paid Apple signing until after MVP. Do not treat the unperformed native association checks as passed. | 01.07 closeout, 01.10, post-MVP links | Product-owner acceptance and deferral on 2026-09-24; merged PR #21; roadmap gate correction recorded in TASK_STATUS.md. No A01–A03 gate accepted. | applied (v0.5) |
| BC-20 | §32, §44; roadmap §1–2, 01.09, 01.10, 03.07, 10.03–10.08 | Replace the local/staging/production topology with two application environments (Local, Production). Private pilot is a usage mode of Production. Vercel Preview is a credential-free deployment context with no application environment. Local/CI are isolated from Production; Production fails closed; hosted auth is optional until a Clerk live instance exists; hosted Staging is optional and trigger-based. Supersedes the §44 three-environment text and the staging aspects of BC-16 and the original A03 proposal. | 01.09, 01.10 | Product-owner decision 2026-09-24; draft A03 revised | applied (v0.5) |

## Notes

- **BC-18 boundary:** only the research-navigation and presentation correction was applied in v0.4. The [saved mockup](design/research-navigation-mockup.png) is illustrative, not financial evidence.
- **BC-19:** canonical web and in-app routes remain MVP requirements. OS-verified HTTPS app opening, the final link domain and paid Apple signing are post-MVP.
- **BC-20:** the hosted Supabase project called "staging" during task 01.06 is now the Production project. Historical evidence from that period remains dated development/test evidence ([archive](archive/TASK_HISTORY.md)).
- When a future architecture change is approved, update the blueprint in the same PR. Add a row here only if traceability is useful.
