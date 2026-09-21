# Finpill

Financial research for BIST companies, planned as a private pilot on web, iOS, and Android.

The repository is in foundation development. The application, database migrations, and CI do not exist yet; see the [task ledger](docs/TASK_STATUS.md) for verified progress.

- [Project instructions](AGENTS.md)
- [Canonical MVP execution plan](docs/MVP_EXECUTION_PLAN.md)
- [Project blueprint](docs/PROJECT_BLUEPRINT.md)
- [Blueprint correction register](docs/BLUEPRINT_CORRECTIONS.md)
- [Repository setup](docs/REPOSITORY_SETUP.md)
- [Contribution and review workflow](CONTRIBUTING.md)

Use Node **24.21.0** and npm **11.19.0**, then run `npm ci` from the repository root. This currently verifies the dependency-free bootstrap; application build/test commands arrive in task 00.03.
