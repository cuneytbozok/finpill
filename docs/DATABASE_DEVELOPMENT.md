# Local database and CI

Task 00.05 establishes a local Supabase/PostgreSQL 17 workflow and real disposable database checks. No hosted Supabase project, credentials, application tables or accepted identity/financial schema are assumed.

## Prerequisites

- Repository Node/npm references and frozen `npm ci` installation.
- A running local Linux Docker engine exposed through a Unix socket (Docker Desktop on macOS/Linux or Docker Engine on Linux).
- Supabase CLI **2.117.0**, exact-pinned in root development dependencies. Use npm scripts/the installed binary; do not silently use a global CLI version.

The CLI's current commands were checked with `--help` and Context7. The official changelog was reviewed; local configuration disables automatic Data API exposure for new tables and uses Postgres 17. No API integration, RLS design or native auth gate is accepted by local infrastructure success.

## Local development

```sh
npm ci
npm run db:start
npm run db:stop
```

`db:start` starts only Supabase Postgres; it does not claim that Auth, Storage or Data API services are running. `db:stop` preserves local volumes. Database port is 54322, shadow port 54320. The tracked config uses `finpill-local` as its local container identity. No login or `supabase link` is needed; never link this checkout to a pilot project.

For simultaneous development worktrees, change the local project's `project_id`, database/shadow/API ports to unused values before starting another local stack. Do not commit a machine-specific override. Disposable integration checks below automatically isolate both identity and ports, independently of this development instance.

Do not import pilot backups, provider responses or private fixtures into disposable test runs. Future authorized test fixtures need provenance and usage rights.

## Migration workflow

```sh
npm run db:migration:new -- descriptive_change_name
```

The CLI generates the timestamped file under `supabase/migrations`. Edit that migration, then run `npm run db:test` to verify replay from an empty Supabase database. Never change an applied migration; add a new forward migration. Domain schemas require their architecture gates and their own task authorization.

The initial `foundation_baseline` migration only records successful replay via a no-op SQL statement. It deliberately creates no application tables, grants, functions or financial structures. `supabase/tests/foundation.test.sql` verifies connectivity, Supabase base schema/role presence, baseline migration history and absence of a reset probe.

## Disposable integration checks

```sh
npm run db:test
```

The runner:

1. Requires a local Docker Unix socket; rejects TCP/SSH daemon endpoints before starting containers.
2. Creates a unique temporary project identity and independently selected free ports. A port race causes a failure, not reuse of another database.
3. Copies only repository configuration, migrations and SQL tests into the temporary work directory. It does not copy dotenv, linked-project files, seeds or local source payloads.
4. Passes an explicit environment allowlist to the CLI, removing provider tokens, database URLs, PostgreSQL target variables and Docker context overrides. No target arguments are accepted.
5. Starts the database, resets with explicit `--local --no-seed`, and runs real pgTAP checks.
6. Creates an empty probe table inside that run's uniquely named container, resets again, and reruns pgTAP to prove the probe was removed and migrations replayed.
7. Stops/removes only that generated project's containers and volumes in `finally`. It never uses `stop --all` or touches the development/pilot database.

A local Unix socket establishes the allowed Docker transport; operators must not forward it to a remote/pilot daemon. The script does not accept a hosted database URL or project reference. SQL fixtures/migrations execute with database-owner authority in an isolated container and must be code-reviewed.

First execution downloads official Supabase images and can take several minutes. A hard process/host kill can prevent cleanup; inspect `docker ps -a` for the specific `finpill-test-<uuid>` identity and remove only that abandoned test instance using the CLI's `stop --project-id <exact-id> --no-backup`. Do not use broad cleanup commands. Missing Docker or failed integration stays a failure, never a mock pass.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` with read-only repository permissions and SHA-pinned official checkout/setup-node actions. Checkout credentials are not persisted. No repository/provider secrets are required.

- `quality`: pinned Node, frozen npm installation, formatting/lint/typecheck/unit tests, both builds, real environment build/runtime smoke and a tracked-file diff check.
- `database`: fresh Ubuntu runner and Docker, the same frozen installation, then the disposable integration runner and two clean migration replays.

Branch-protection/required-check settings are not silently changed by this workflow. Configure `quality` and `database` as required checks under the owner's repository policy. A green workflow does not validate hosted Supabase, RLS, native apps, backups or production data access.

## Evidence

The task ledger records exact local and hosted results. Docker is not installed on the implementation Mac at task start: local `db:test` correctly fails at preflight. GitHub's Docker-equipped runner must provide the actual database acceptance evidence; do not label the Mac integration test passed based on CI.
