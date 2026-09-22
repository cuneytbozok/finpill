# Finpill

Financial research for BIST companies, planned as a private pilot on web, iOS, and Android.

The repository is in foundation development: a static client, separate Node API and shared contracts workspace are scaffolded. Product features, database migrations and CI remain pending; see the [task ledger](docs/TASK_STATUS.md) for verified progress.

- [Project instructions](AGENTS.md)
- [Canonical MVP execution plan](docs/MVP_EXECUTION_PLAN.md)
- [Project blueprint](docs/PROJECT_BLUEPRINT.md)
- [Blueprint correction register](docs/BLUEPRINT_CORRECTIONS.md)
- [Repository setup](docs/REPOSITORY_SETUP.md)
- [Workspace layout and commands](docs/WORKSPACE.md)
- [Contribution and review workflow](CONTRIBUTING.md)

Use Node **24.21.0** and npm **11.19.0**, then run `npm ci` and `npm run check` from the repository root. Both app targets also build independently with `npm run build:client` and `npm run build:api`.
