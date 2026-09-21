# Finpill project rules

## Read first and document authority

- Read `docs/PROJECT_BLUEPRINT.md` before architectural changes.
- Read `docs/MVP_EXECUTION_PLAN.md`, `docs/TASK_STATUS.md`, relevant accepted ADRs, and the predecessor handoff before implementation.
- `docs/MVP_EXECUTION_PLAN.md` is the approved execution roadmap. Its task order supersedes the original sequence in blueprint §§37–39 and §§50–51; this does not silently change product scope.
- Approved product-owner decisions and required blueprint corrections are recorded in the roadmap and `docs/BLUEPRINT_CORRECTIONS.md`. Keep the blueprint unchanged until its correction is deliberately included in an authorized documentation change.
- An approved roadmap direction is not evidence that an architecture gate has passed. Accept ADRs only after their required evidence exists.
- Always use Context7 MCP when library/API documentation, code generation, setup, or configuration steps are needed, without waiting for the user to ask. If unavailable, state that limitation rather than claiming verification.

## Architecture

- Next.js + TypeScript.
- One statically bundled Next.js client shared by web and Capacitor iOS/Android, with a separate Next.js server/API deployment.
- Supabase PostgreSQL and private Storage.
- Clerk authentication; verified user identity and Supabase RLS for user-owned data.
- Vercel deployment.
- Capacitor for mobile; validate production runtime, routing, authentication, environment configuration, assets, and deep links early.
- KAP/MKK is the primary fundamental-data source.
- Do not expand MVP scope. The private pilot and 20-company validation cohort must not become architectural limits.

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

## Engineering

- Add tests with every parser/metric change; establish fixture/golden expectations before changing behavior.
- Run lint, typecheck and tests before declaring a code task complete. For documentation-only tasks before those commands exist, perform document checks and explicitly report code checks as not applicable, not passed.
- Every database schema change must use a migration; external API responses require runtime validation.
- Do not silently change architecture.
- If an architectural decision conflicts with the blueprint, document it as an ADR.
- Select one ready task per implementation session, verify its dependencies and gates, and update `docs/TASK_STATUS.md` with evidence and the next-task handoff.
- Use an isolated worktree/branch per independent task once Git exists. Coordinate shared contracts, migrations, routing, and root dependencies through one owner.
- Bootstrap exception: task 00.01 precedes Git initialization. Carry its verified documentation into the initial repository history in task 00.02; do not claim a commit or PR exists before it does.
- Keep secrets out of commits, logs, fixtures, client bundles, and handoffs.
- Missing access or failed validation must remain explicit. Do not replace required live/native/golden evidence with a passing mock.
