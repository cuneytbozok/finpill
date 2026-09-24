# Contributing

[AGENTS.md](AGENTS.md) is the canonical workflow: document ownership, the session lifecycle, owner-approval rules, testing tiers and the product/data invariants. This file adds only repository mechanics.

## Branches and commits

- `main` is the integration branch.
- Name task branches `codex/<task-id>-<short-description>`, for example `codex/02.01-source-evidence-pack`. Use `codex/docs-<topic>` for documentation-only changes.
- Use one isolated worktree per implementation task. Do not create branches or worktrees only to update task status after a merge.
- Include the task ID in commit subjects, for example `feat(02.04): add decimal parsing utilities`.
- Do not rewrite published history or force-push shared branches.

## Dependencies

Use one root npm lockfile. Add workspace dependencies from the repository root and commit manifest and lockfile changes together. Do not use `--force` to bypass toolchain requirements, mix package managers, or run `npm audit fix` without reviewing its dependency changes.

## Secrets and published content

Review staged files for secrets, credentials, signing material, raw-source usage rights and unintended generated output. Ignore rules are a guardrail, not proof that a file is safe to publish. The GitHub repository is public; private-use data rights do not authorize committing source payloads.

## Pull requests and merging

- Open a PR against `main` with the task ID in its title, using the repository template.
- The PR description is the evidence record: behavior, checks run by tier (and required checks not run, with the reason), migrations/contracts, exceptions and remaining blockers.
- Update the task's row in `docs/TASK_STATUS.md`, and any documents the change genuinely affects, in the same PR. There is no separate closeout PR.
- Use draft status while required evidence is incomplete.
- The owner reviews and merges, normally with a squash merge, after the CI jobs (`quality` and `database` in `.github/workflows/ci.yml`) and the Vercel Preview check pass. Branch protection is not configured, so this is a working agreement rather than an enforced rule.
