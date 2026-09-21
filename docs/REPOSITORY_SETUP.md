# Repository setup

The owner-confirmed repository is [cuneytbozok/finpill](https://github.com/cuneytbozok/finpill), with `main` as the integration branch. It was empty before the approved roadmap baseline was pushed. The repository is public; the product release remains a private pilot.

## Pinned toolchain

| Tool | Required version | Enforcement |
|---|---|---|
| Node.js | 24.21.0 (24 LTS) | `.nvmrc`, `.node-version`, package `engines` and `devEngines` |
| npm | 11.19.0 | `packageManager`, `engines`, `devEngines` |

The [official Node release index](https://nodejs.org/dist/index.json) lists Node 24.21.0 with bundled npm 11.19.0. These exact versions were selected and verified on 2026-09-21. `.npmrc` enables strict engine checks and exact dependency saves. npm's [`devEngines` documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#devengines) describes checks before install, ci and run commands.

`packageManager` records the intended CLI; it does not install npm automatically. Use the official Node distribution's bundled npm, or install the exact npm version in your chosen isolated Node environment. Do not globally replace another project's runtime to satisfy this repository.

## Fresh checkout

1. Install Git and the pinned Node distribution using your preferred version manager or the [official Node archive](https://nodejs.org/dist/v24.21.0/). Verify downloaded archives against its `SHASUMS256.txt`; the Node website also provides signed checksums.
2. Clone the repository and enter its root:

   ```sh
   git clone https://github.com/cuneytbozok/finpill.git
   cd finpill
   ```

3. Activate Node 24.21.0. If nvm is already installed, `nvm install` and `nvm use` read `.nvmrc`; other managers can use `.node-version`. A version manager is optional, and this task does not install one or edit shell startup files.
4. Confirm the active versions and restore the lockfile:

   ```sh
   node --version
   npm --version
   npm ci
   git status --short
   ```

   Expect `v24.21.0`, `11.19.0`, successful installation and no tracked changes. A version mismatch must fail rather than quietly using a different runtime.

5. Read [CONTRIBUTING.md](../CONTRIBUTING.md) and choose a ready task from [TASK_STATUS.md](TASK_STATUS.md).

No service credentials are needed for the workspace foundation. After installation, run `npm run check` to verify formatting, lint, strict types, unit tests and both production builds. See [WORKSPACE.md](WORKSPACE.md) for the client/API/contracts layout and individual commands. Task 00.04 adds environment schemas; task 00.05 adds local Supabase and CI.

## Files and secrets

Commit one `package-lock.json` at the repository root. Do not introduce workspace-local lockfiles. Commit native project source and migrations when their tasks begin; generated builds, local platform configuration and signing material are ignored.

Only redacted `.env.example` or `.env.<name>.example` files may be committed. Real `.env` files, private keys, provider credentials, native signing files, local Supabase state and deployment caches stay outside Git. Ignore rules cannot detect secrets in otherwise trackable source files.

## Updating the pins

Update both Node version files, package `engines`/`devEngines`, npm `packageManager` and this guide in one reviewed toolchain change. Regenerate the root lockfile with the selected npm, rerun the fresh-clone check and all application checks that exist at that point, and record the official release evidence. Do not silently track `latest` or bypass engine enforcement.
