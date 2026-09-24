# Task 01.07 deep-link setup and acceptance

The provisional link origin prepared in task 01.07 is `https://finpill.vercel.app`.
The user identified it as Finpill's Vercel host, and HTTPS returned `200` on
2026-09-23. Native builds intended to handle external HTTPS links must set
`NEXT_PUBLIC_DEEP_LINK_ORIGIN=https://finpill.vercel.app`; a build without
that setting rejects incoming links. The app accepts only this exact origin and
known shared routes. Unknown hosts, malformed routes, query strings and fragments
are rejected. The legacy `/ai` route resolves to `/search`.

The prepared iOS entitlement declares `applinks:finpill.vercel.app`. The current
Personal Team provisioning profile cannot include Associated Domains, so the
entitlement is intentionally not attached to the App target's signing settings.
After selecting an Apple Developer Program team that supports the capability,
add Associated Domains to the **App target** in Xcode and set
`CODE_SIGN_ENTITLEMENTS` to `App/App.entitlements`. Then verify the signed app
actually contains this entitlement. The exported client
contains `/.well-known/apple-app-site-association` for team
`7NA7D47449` and bundle `com.cuneytbozok.finpill`. The Android manifest has
verified HTTPS intent filters for company and search paths. Its
`/.well-known/assetlinks.json` contains the SHA-256 fingerprint of the owner's
local Android debug keystore used to sign Release-mode emulator builds. **Replace
or supplement that fingerprint with the chosen signer before external distribution.**
No distribution signing identity has been selected.

On 2026-09-24 the owner accepted merged task 01.07 with OS-verified HTTPS app
opening deferred until after the MVP roadmap. This is an exception to the
original native link-opening acceptance, not a passing device test. Canonical
web and in-app routes, safe URL parsing, sign-in return and Back behavior remain
MVP requirements; live integration proof belongs to task 01.10. Public
association-file deployment and native OS verification are not prerequisites
for roadmap completion.

When post-MVP link work begins, choose the official HTTPS domain and Apple
Developer Program team. Update the public environment origin, iOS entitlement,
Apple association file (including the actual paid team's App ID prefix), Android
intent filters and assetlinks signing fingerprint together. Rebuild and install
both native apps; the provisional Vercel host is not a final identity.

The association files must be deployed at the exact production host, served
directly over HTTPS with JSON content, without a redirect or auth challenge.
Preview URLs do not establish ownership of `finpill.vercel.app`. After PR #21
merged, both files returned public `200` JSON from the provisional host and
matched the tracked bytes; OS domain verification remains unperformed. When the
official domain replaces it, check both file responses and OS verification again.
The iOS Associated Domains capability must be enabled for the signed app ID in
Apple's provisioning setup. An unsigned simulator build proves compilation only;
the current Personal Team cannot provide signed Universal Link evidence.

Post-MVP OS association acceptance sequence on signed native builds:

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
Native OS verification requires deployed association files and signed installed
builds; a passing unit test or static build cannot replace those checks. The
sign-in interruption and Back flows remain task 01.10 MVP acceptance and can be
tested through in-app navigation without OS-verified HTTPS link opening.
