# A01 — Web/native runtime

- Status: **Accepted 2026-09-25** by the project owner, on the evidence of tasks 01.01–01.10 (PRs #7, #11, #21, #8/#14, #23, #26).
- Owner: project owner; implementing tasks own the adapters.

## Decision

1. **One static client, separate API.** A single Next.js static export (`apps/client/out`) is the web deployment and the only web input bundled into the Capacitor iOS and Android shells. Server code, secrets and privileged clients live only in the separately deployed Next.js API (`apps/api`), reached through the versioned `/api/v1` transport.
2. **Release builds need no development server.** Native shells load bundled assets, carry no remote server URL or navigation allowlist, and package no `.next` server output or server secrets. Local-networking allowances exist only in local/debug builds.
3. **Shared routing.** Canonical blueprint routes are defined once in the shared route registry and work for arbitrary tickers without build-time enumeration. Platform navigation (browser history, native Back) goes through a shared navigation adapter; legacy `/ai` resolves to `/search`.
4. **Safe external links.** Incoming links are accepted only from the configured link origin and for known shared routes; malformed routes, unknown hosts, queries and fragments are rejected.
5. **Platform ports.** Authentication and platform behavior are reached through narrow interfaces (`AuthPort`, platform ports) so web, iOS and Android differ only in adapters.
6. **Client/API compatibility.** Installed clients depend on `/api/v1`; incompatible changes require a new API version (see [A03](A03-environments-and-releases.md)).

## Exception

OS-verified HTTPS Universal/App Link opening, the final link domain and paid Apple signing are post-MVP (owner decision 2026-09-24, BC-19). They are not A01 evidence.

## Evidence

Task PRs and guides: [NATIVE_SHELLS.md](../NATIVE_SHELLS.md), [DEEP_LINKS.md](../DEEP_LINKS.md), [DEPLOYMENT.md](../DEPLOYMENT.md). Task 01.10 (PR #26) proved canonical navigation, sign-in return, browser Back and Android Back against Local on web, iOS and Android.
