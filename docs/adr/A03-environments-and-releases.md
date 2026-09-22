# A03 — Environments and releases

- Status: **Draft — not accepted**
- Date: 2026-09-22
- Owner: project owner for environment identities/access; Codex task 00.04 for schema boundaries.

## Context

The approved roadmap requires one static client plus a separately deployed API. Installed native clients retain build-time public settings, while API secrets remain server-side. Task 00.04 establishes validation without assuming that live accounts, domains or signing identities exist.

## Proposed decision and implemented portion

Use explicit `local`, `staging`, and `production` app environments independently of Node build mode. Validate required origins with no service fallback. Allowlist build-time public settings, validate enabled service prerequisites on the server, and report only field names on invalid configuration. Privileged Supabase access is separately enabled from user-scoped data access. See the [environment matrix](../ENVIRONMENTS.md).

## Alternatives considered

- Implicit localhost/development defaults: rejected because hosted configuration omissions can silently reach the wrong service.
- Exporting one combined server/client config object: rejected because it increases accidental disclosure risk.
- Requiring all service credentials for a foundation build: rejected because integrations and their access evidence are separate gated tasks.

## Consequences

Existing hosted builds must supply explicit public settings before adopting this change. Public setting changes require a fresh static/native build. Nonlocal HTTPS syntax alone cannot verify a remote project's identity; the access register must identify each environment. No provider adapter, authorization boundary or release compatibility policy is accepted by schema tests.

## Evidence still required for acceptance

Task 00.06 records confirmed service ownership, environment IDs, domains and signing owners. Tasks 01.02–01.10 must prove native configuration, real authentication, preview isolation, coordinated client/API deployments, and installed-client compatibility. Only then can A03 be accepted and its associated blueprint correction deliberately applied. The blueprint is unchanged.
