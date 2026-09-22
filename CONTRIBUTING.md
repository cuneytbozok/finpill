# Contributing

Read [AGENTS.md](AGENTS.md) first. Follow its task-selection and context-loading rules, then read only the selected task's relevant roadmap, handoff, blueprint and ADR context before starting.

## Branches and worktrees

- `main` is the integration branch. The initial approved documentation commit is the bootstrap baseline.
- Name task branches `codex/<task-id>-<short-description>`, for example `codex/00.02-repository-foundation`.
- Use one isolated worktree per independent task, based on the merged prerequisite commit. Record the base commit in the task handoff.
- Stacked branches must identify their base PR and merge order. Re-run integration checks against the combined state.
- Assign one owner to shared contracts, migrations, root manifests/lockfile, routing and ADRs. Do not run competing edits on these interfaces.
- Do not rewrite published history or force-push shared branches as part of normal implementation.

## Changes and verification

Keep each change independently reviewable and within its roadmap task. Include the task ID in commit subjects, for example `chore(00.02): establish repository toolchain`.

Run the checks required by the task and report actual outcomes. Parser/metric changes require independently checked fixture expectations; database changes require migrations. Missing live/native evidence stays explicit. Documentation/bootstrap work must not report nonexistent application tests as passing.

Use one root npm lockfile. Add workspace dependencies from the repository root when task 00.03 establishes the workspace. Commit manifest and lockfile changes together. Do not use `--force` to bypass toolchain requirements, mix package managers, or run `npm audit fix` without reviewing its dependency changes.

Review staged files for secrets, credentials, signing material, raw-source usage rights and unintended generated output. Ignore rules are a guardrail, not proof that a file is safe to publish. The owner-selected GitHub repository is public; private-pilot data rights do not authorize committing source payloads.

## Pull requests and merge policy

- Open a PR targeting `main` with the task ID in its title. Use the repository template and attach the PR to the Codex task.
- Include acceptance evidence, test results, migrations/contracts, operational impact, limitations and a next-task handoff.
- Use draft status while acceptance evidence is incomplete. Keep the ledger `in_review` until review/merge acceptance is recorded.
- A reviewer checks scope, correctness, authorization, versioning and lineage, and verifies financial expectations independently where required.
- Merge after review, required checks and explicit owner authorization or a subsequently documented merge policy. Roadmap approval alone does not authorize automatic merging.
- Prefer squash merging one coherent task PR. Do not combine unrelated tasks just to reduce PR count.
- After merge, record the PR/merged commit, mark accepted tasks complete, and recompute readiness. Consumers start from the merged contract, not an unmerged working copy.

Branch protection and automated required checks are not configured by this documentation. Task 00.05 adds initial CI; task 01.09 adds deployment/native pipelines. Record the actual configured checks when available.
