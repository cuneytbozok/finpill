# Task 01.07 deep-link setup and acceptance

The link origin selected for this task is `https://finpill.vercel.app`. The user
identified it as Finpill's Vercel host, and HTTPS returned `200` on 2026-09-23.
Native builds must
set `NEXT_PUBLIC_DEEP_LINK_ORIGIN=https://finpill.vercel.app`; a build without
that setting rejects incoming links. The app accepts only this exact origin and
known shared routes. Unknown hosts, malformed routes, query strings and fragments
are rejected. The legacy `/ai` route resolves to `/search`.

The iOS entitlement declares `applinks:finpill.vercel.app`. The exported client
contains `/.well-known/apple-app-site-association` for team
`7NA7D47449` and bundle `com.cuneytbozok.finpill`. The Android manifest has
verified HTTPS intent filters for company and search paths. Its
`/.well-known/assetlinks.json` contains the SHA-256 fingerprint of the owner's
local Android debug keystore used to sign Release-mode emulator builds. **Replace
or supplement that fingerprint with the distribution signer's fingerprint
before a pilot release.** No distribution signing identity has been selected.

The association files must be deployed at the exact production host, served
directly over HTTPS with JSON content, without a redirect or auth challenge.
Preview URLs do not establish ownership of `finpill.vercel.app`. After the
production deployment, check both file responses and OS domain verification.
The iOS Associated Domains capability must be enabled for the signed app ID in
Apple's provisioning setup. An unsigned simulator build proves compilation only.

Acceptance sequence on signed native builds:

1. Cold launch a company overview and each company tab from links on the trusted
   host. Repeat while the app is already open. Check that the ticker and tab are
   retained.
2. Open a link while signed out, complete or cancel sign-in, and check that the
   target remains the active route rather than falling back to Home or accepting
   an external return target.
3. Check browser Back and Android system Back through company, search and Home.
   A direct detail entry returns to Home. The Home Back action exits Android.
4. Send an untrusted host, a host suffix, malformed ticker, query redirect and
   fragment. Confirm none changes the route.

The pure URL trust and canonical routing cases are in `tests/deep-links.test.ts`.
Native OS verification and the sign-in interruption flow require the deployed
association files and signed installed builds; a passing unit test or static
build cannot replace those checks.
