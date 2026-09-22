# Finpill project rules

## Read first and document authority

- `origin/main` is the canonical merged integration state. A local checkout, local `main`, or local `TASK_STATUS.md` may be stale or dirty and must not be used as authoritative task state without reconciliation.

- Before implementation:

  ### Task discovery

  1. Fetch and prune `origin` before selecting a task.
  2. Determine the canonical task state from `docs/TASK_STATUS.md` on `origin/main`, preferably without modifying the current checkout.
  3. Do not reset, clean, fast-forward, switch, or otherwise modify the user's existing checkout during task discovery.
  4. If the canonical ledger shows a task as `in_progress` or `in_review`, inspect only the relevant task branch/PR state needed to reconcile its actual status.
  5. If repository/PR evidence shows that a ledger state is stale, use the verified repository/PR state for task selection and preserve the discrepancy for correction in the next safe documentation update.
  6. If an actionable task is already `in_progress`, continue that task from its existing branch/worktree.
  7. If a task is `in_review`, continue it only when there is actionable unresolved review or acceptance work that can be completed in this session. If it is merely awaiting review/merge and does not block later work, leave it in review and continue task selection.
  8. Otherwise select the first `ready` task in roadmap order whose dependencies and required architecture gates are satisfied. Before selecting a later `ready` task, check whether any earlier roadmap task is blocked only by user/external action, regardless of its recorded ledger state. If so, surface that blocker under the rules below and obtain explicit user approval before bypassing it.
  9. If the remote state cannot be verified, do not start a new task based only on potentially stale local state. Report the verification failure instead.
  10. Do not load task-specific skills, Context7, external documentation, implementation files, or create a new worktree until task selection is complete.

  ### External blockers and user input

  - Do not silently skip an earlier roadmap task because it requires user-provided access, ownership, configuration, credentials, account setup, signing, provider selection, or another external decision.
  - When the next roadmap task cannot proceed because of a user/external prerequisite:

    1. Stop before starting a later task.
    2. State the blocked task ID and the exact blocking requirement.
    3. Tell the user exactly what they need to do or provide to unblock it.
    4. Separate:
       - information the user can safely provide in chat,
       - secrets/credentials that must be configured outside chat,
       - external actions the user must perform in a provider console or account.
    5. Give concrete identifiers, settings, console locations, or verification steps when known.
    6. Explain how completion will be verified.
    7. Record the blocker and required next action in `docs/TASK_STATUS.md`.
    8. Wait for the user's response before starting a later independent task; a response alone does not authorize bypassing the blocker.

  - A later independent `ready` task may be started while an earlier task is blocked only after the user explicitly approves continuing around that blocker. Existing dependency and architecture-gate requirements still apply.
  - If several upcoming tasks require user action, group their requirements into one concise checklist so the user can clear multiple blockers at once. Use targeted prerequisite reads to prepare this checklist without loading unrelated task context or starting those tasks.

  ### Selected-task context

  11. After selecting the task, read only:
      - the selected task's definition and directly relevant dependency context in `docs/MVP_EXECUTION_PLAN.md`,
      - the selected task's current/predecessor handoff in `docs/TASK_STATUS.md`,
      - explicitly referenced ADRs,
      - relevant `PROJECT_BLUEPRINT.md` sections when architectural or product context is required.
  12. Use targeted searches and line/range reads for long documents. Do not dump entire roadmap, ledger, blueprint, ADR, or log files into context when only a section is needed.
  13. Do not read unrelated historical handoffs, roadmap phases, ADRs, or blueprint sections.
  14. Read `docs/PROJECT_BLUEPRINT.md` only when the selected task requires architectural/product context or an architectural change.

  ### Execution

  15. For a new task, create its isolated worktree/branch from the verified `origin/main` base unless the roadmap explicitly requires another base.
  16. For an existing `in_progress` task, reuse its existing task branch/worktree rather than creating duplicate work.
  17. Work on one task only per implementation session.
  18. Implement only the selected task's scope and required acceptance work.
  19. Verify the task using its required checks and record actual evidence.
  20. Update `docs/TASK_STATUS.md` with the resulting state, evidence, blockers, commit/PR information, and next-task handoff.
  21. After verification and handoff, stop. Do not start another task in the same session.

- `docs/MVP_EXECUTION_PLAN.md` is the approved execution roadmap. Its task order supersedes the original sequence in blueprint §§37–39 and §§50–51; this does not silently change product scope.
- Approved product-owner decisions and required blueprint corrections are recorded in the roadmap and `docs/BLUEPRINT_CORRECTIONS.md`. Keep the blueprint unchanged until its correction is deliberately included in an authorized documentation change.
- An approved roadmap direction is not evidence that an architecture gate has passed. Accept ADRs only after their required evidence exists.
- Use Context7 only when the task materially depends on unverified or version-specific external library/API behavior, setup, or configuration. Reuse documentation already retrieved for the current task, request only the minimum relevant documentation, and do not use it for routine code generation or repository-established behavior. If required verification is unavailable, state that explicitly.

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
- Follow the task-discovery, context-loading, and single-task execution protocol above; keep `docs/TASK_STATUS.md` synchronized with verified evidence and handoffs.
- Use an isolated worktree/branch per independent task once Git exists. Coordinate shared contracts, migrations, routing, and root dependencies through one owner.
- Bootstrap exception: task 00.01 precedes Git initialization. Carry its verified documentation into the initial repository history in task 00.02; do not claim a commit or PR exists before it does.
- Keep secrets out of commits, logs, fixtures, client bundles, and handoffs.
- Missing access or failed validation must remain explicit. Do not replace required live/native/golden evidence with a passing mock.