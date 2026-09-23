# iOS Clerk authentication

Task 01.04 connects the shared static client to Clerk's native iOS SDK through a small Capacitor plugin. `AuthPort.getAccessToken()` requests a fresh token from the SDK. The plugin exposes session state, sign-in, sign-out, and token acquisition; the application does not persist tokens in WebView storage. Clerk's default Keychain configuration owns native session persistence.

The Xcode project pins `clerk-ios` 1.3.9 and now targets iOS 17 or later, the SDK's minimum. The bridge uses ClerkKitUI's sign-in-only `AuthView`, so the Clerk instance's invitation policy remains authoritative. The web adapter and Android shell continue on their existing paths.

## Development instance setup

1. In the existing development Clerk instance, enable the Native API and register the iOS application using bundle ID `com.cuneytbozok.finpill` and the App ID Prefix of the signing team. Confirm Invite-only access remains selected. Do not place a secret key in the client or Xcode project.
2. In Xcode, select the intended local Personal Team for the App target when testing on a physical device. The project currently uses automatic signing but has no committed `DEVELOPMENT_TEAM`; no signing setting was changed by task 01.04. Simulator builds can run unsigned.
3. Follow Clerk's iOS quickstart for the instance's `webcredentials:` associated domain when testing flows that require it. The project has no confirmed frontend API domain or associated-domain entitlement yet; universal/app links belong to task 01.07.
4. Set the ignored `apps/client/.env.local` values described in [WEB_AUTH.md](WEB_AUTH.md), including `NEXT_PUBLIC_AUTH_ENABLED=true` and the development publishable key. Build and sync the static client with `npm run native:sync`, then build the Xcode App target in Release mode. Never commit the local environment file.

## Required live acceptance

On a Release-mode simulator or signed device, use an invited account to sign in through the native sheet and obtain a fresh SDK token through `AuthPort`. Cancel the sheet and confirm no session appears. Restart the app and confirm the SDK restores the session from secure storage. Exercise token expiry, background/resume, offline and recovered network conditions, and sign-out, then inspect the packaged app and WebView storage for token or server-secret leakage. Record each actual result in the task ledger. A successful build or an unsigned simulator launch does not prove these lifecycle cases. The protected API's current authorized-party and CORS rules cover browser origins; native bearer acceptance belongs to the integrated proof in task 01.10.

References: [Clerk iOS quickstart](https://clerk.com/docs/ios/getting-started/quickstart), [Clerk iOS AuthView](https://clerk.com/docs/ios/reference/views/authentication/auth-view), [Capacitor custom iOS code](https://capacitorjs.com/docs/ios/custom-code).
