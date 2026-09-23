# Blueprint correction register

**Baseline:** Original [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) v0.3; current v0.4 applies BC-18 only.
**Authority:** Approved [MVP execution plan](MVP_EXECUTION_PLAN.md), section 8.  
**Status:** BC-01–BC-17 remain recorded and unapplied. BC-18 is applied to blueprint v0.4 in this documentation revision; integration is tracked in TASK_STATUS.md.

This register identifies required documentation reconciliation. It does not claim that architecture gates have passed or that the associated implementation exists. The blueprint remains unchanged during task 00.01. The approved roadmap already governs execution order and the explicit product-owner choices; its acceptance does not approve an unevidenced implementation ADR.

## Status convention

- `recorded`: correction captured; blueprint text has not changed.
- `in_review`: proposed blueprint edit is under review with the linked ADR/evidence.
- `applied`: a deliberate documentation change has updated the blueprint; record its commit/PR and relevant accepted ADR.
- `superseded`: a later approved decision replaces the correction; retain a link to that decision.

The owner is the implementer of the listed task, not an assumed service-account owner. When several tasks are listed, coordinate the correction through one reviewer.

| ID | Blueprint sections | Required correction | Owning tasks | ADR or decision | Status |
|---|---|---|---|---|---|
| BC-01 | §4–5, §25, §37, §44 | replace the ambiguous “same Next.js application in Capacitor” assumption with the approved shared static client plus separate Next.js API architecture and early native proof. | 01.01, 01.02, 01.09, 01.10 | A01, A03 | recorded |
| BC-02 | §22–24 | retain canonical product routes, specify client-side routing/deep-link adapters, and introduce versioned API contracts. | 01.01, 01.07 | A01, A03 | recorded |
| BC-03 | §12.18, §32 | define Clerk text identities, native authentication adapters, Supabase third-party JWT integration, RLS and separate user/operator/machine authorities. | 01.03–01.06 | A02 | recorded |
| BC-04 | §12.1–2, §12.13 | separate issuer identity from security/ticker identity; key prices by security and retain effective-dated mappings. | 02.02, 06.01 | A04 | recorded |
| BC-05 | §12.4, §28.4 | replace the single mutable disclosure payload with logical disclosures, immutable source revisions and acquisition observations. | 02.03, 03.04 | A05 | recorded |
| BC-06 | §12.6–11, §18 | define explicit context/source/build identity, comparative restatements, selection policies and atomic publication. | 02.05, 04.01, 04.05 | A05, A07 | recorded |
| BC-07 | §11, §15–18 | add compatibility and applicability requirements for quarter, TTM, TMS 29, EBITDA, net debt and historical valuation. | 02.05, 05.01–05.05, 06.03 | A07, A09, A10 | recorded |
| BC-08 | §12.8, §19, §40 | make lossless source parsing and decimal-string transport explicit; avoid irreversible source rounding and numeric JSON examples for authoritative amounts. | 02.04, 04.03, 08.03 | A06, A11 | recorded |
| BC-09 | §12.19, §28–31 | add claim/lease/fencing/recovery fields, transactional checkpoint rules, source-wide rate budgets and version-aware idempotency. | 02.06, 02.07, 03.03 | A08 | recorded |
| BC-10 | §28.1–4 | qualify unchanged-index behavior with verified correction semantics and bounded reconciliation. | 03.01, 03.03, 03.05 | A05, A08 | recorded |
| BC-11 | §17, §37, §41 | make historical share counts, corporate actions, publication-time joins and EOD provider dependencies explicit. | 02.08, 06.02–06.04 | A10 | recorded |
| BC-12 | §21, §47 | add persistent generation identities, evidence validation, conversation ownership, retrieval evaluations and embedding-version cutover. | 08.01, 08.03, 08.05, 08.06, 09.02 | A11, A12 | recorded |
| BC-13 | §37–39, §50–51 | replace the original execution sequence with this dependency-driven roadmap. | 00.01 | Execution-order approval; relevant ADRs retain their own gates | recorded |
| BC-14 | §42 | record the owner-selected 20-company × 12-quarter cohort target, deliberate structural coverage and full-market-capable architecture. | 02.01, 10.01 | Product-owner decision; A04, A07 where applicable | recorded |
| BC-15 | §3, §14, §22 | clarify EOD valuation as required; preserve later-phase returns/scoring and optional notifications as deferred. | 05.01, 06.04, 07.06 | Product-owner scope; A09, A10 | recorded |
| BC-16 | §43–45 | define measurable performance/recovery targets, source-specific freshness, native/API release compatibility and required operational acceptance. | 01.09, 02.05, 10.03, 10.04, 10.06, 10.07 | A03, A07, A08 | recorded |
| BC-17 | §48 | distinguish permitted private-pilot use from public redistribution/store/billing release gates. | 00.06, 02.08, 10.07 | Product-owner release boundary; A10 | recorded |
| BC-18 | §22–23, §28.1, §28.5 | Three primary destinations, persistent search without a tab, four company tabs with contextual saved analysis/Q&A, legacy `/ai` compatibility, explicit periods/comparison bases, independent freshness and validated takeaway sources. Preserve company Q&A; no unrestricted user regeneration. | 01.07–01.08, 07.01, 07.05–07.06, 07.08, 09.02–09.04, 09.06 | Product-owner approval on 2026-09-23; blueprint v0.4; branch `codex/docs-research-navigation` and documentation PR recorded in TASK_STATUS.md. No architecture gate accepted. | applied |

### BC-18 application boundary

Only the approved research-navigation and presentation correction is applied in this revision. The [saved mockup](design/research-navigation-mockup.png) is illustrative, not financial evidence. Existing runtime architecture, canonical company routes, private company Q&A, phase dependencies and financial correctness remain intact. The global `/ai` route becomes a compatibility entry to search; it is not a primary destination. BC-02 remains recorded for its broader routing/API reconciliation; BC-18 deliberately supersedes only the global AI destination requirement. Application of this correction is documentation evidence, not implementation or native acceptance.

## Evidence and edit policy

- No ADR is marked accepted by this register.
- Preserve financial correctness, immutable sources, authorization, lineage, and MVP capabilities when reconciling text.
- Do not rewrite the blueprint opportunistically while implementing unrelated code.
- Public redistribution, store publication, and billing remain post-MVP release gates. Permitted private-pilot data use still requires evidence.
- Record the blueprint version and documentation commit/PR when a correction is applied.
