# iOS Clerk authentication

Task 01.04 connects the shared static client to Clerk's native iOS SDK through a small Capacitor plugin. `AuthPort.getAccessToken()` requests a fresh token from the SDK. The plugin exposes session state, sign-in, sign-out, and token acquisition; the application does not persist tokens in WebView storage. Clerk's default Keychain configuration owns native session persistence.

The Xcode project pins `clerk-ios` 1.3.9 and now targets iOS 17 or later, the SDK's minimum. The bridge uses ClerkKitUI's sign-in-only `AuthView`, so the Clerk instance's invitation policy remains authoritative. The web adapter and Android shell continue on their existing paths.

## Development instance setup

1. The owner confirmed that the existing development Clerk instance has Native API enabled, the iOS application registered with bundle ID `com.cuneytbozok.finpill` and App ID Prefix `7NA7D47449`, and `com.cuneytbozok.finpill://callback` allowlisted. The screenshot also shows Invite-only mode. Do not place a secret key in the client or Xcode project.
2. The owner selected Personal Team `7NA7D47449` for the App target's Debug and Release configurations in Xcode, with automatic signing. A signed Release build installed and launched on the owner's iPhone 15 Pro; the unsigned simulator build alone did not prove provisioning. Codex did not edit the signing setting.
3. Follow Clerk's iOS quickstart for the instance's `webcredentials:` associated domain when testing flows that require it. The project has no confirmed frontend API domain or associated-domain entitlement yet; universal/app links belong to task 01.07.
4. Set the ignored `apps/client/.env.local` values described in [WEB_AUTH.md](WEB_AUTH.md), including `NEXT_PUBLIC_AUTH_ENABLED=true` and the development publishable key. Build and sync the static client with `npm run native:sync`, then build the Xcode App target in Release mode. Never commit the local environment file.

## Required live acceptance

On a signed Release device, use an invited account to sign in through the native sheet and confirm “Oturum hazır”; this state calls `AuthPort.getAccessToken()` without displaying the token. Cancel the sheet and confirm no session appears. Restart the app and confirm the SDK restores the session from secure storage. Exercise token expiry, background/resume, offline and recovered network conditions, and sign-out, then inspect the packaged app and WebView persistence paths for token or server-secret leakage. The task ledger records the actual 2026-09-23 device results. A successful build or an unsigned simulator launch alone does not prove these lifecycle cases. Native Clerk SDK session tokens carry no `azp` claim. The protected API accepts such a token only from a configured native WebView origin (`capacitor://localhost` on iOS, `https://localhost` on Android) and requires browser tokens to name an allowed origin in `azp`; see [USER_DATA_AUTH.md](USER_DATA_AUTH.md). For a local simulator build, sign the app ad hoc (`CODE_SIGN_IDENTITY=-`); an unsigned build lacks the Keychain entitlement and Clerk stops at launch.

References: [Clerk iOS quickstart](https://clerk.com/docs/ios/getting-started/quickstart), [Clerk iOS AuthView](https://clerk.com/docs/ios/reference/views/authentication/auth-view), [Capacitor custom iOS code](https://capacitorjs.com/docs/ios/custom-code).
