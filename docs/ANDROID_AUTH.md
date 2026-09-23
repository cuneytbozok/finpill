# Android Clerk authentication

Task 01.05 connects the shared static client to Clerk's official Android SDK through the same narrow `AuthPort` contract used on iOS. The Android app pins `com.clerk:clerk-android-ui:1.0.39`. A local Capacitor plugin exposes only SDK readiness, user identity, native sign-in, sign-out, and a current session token. The app does not persist tokens in WebView storage or Android code. The SDK owns encrypted native session storage; Android application backup is disabled so its encrypted preferences are not copied separately from the device key.

The bridge initializes Clerk from the public build-time publishable key after the shared client starts. `FinpillClerkActivity` presents Clerk's sign-in-only `AuthView`; dismissal returns to the unchanged signed-out shell. The shared client polls native session state and requests a fresh token through `AuthPort` on sign-in, resume, and every minute while signed in. No Clerk server key belongs in the client, Android project, or APK.

## Development setup

1. In the development Clerk instance, enable Native API and register Android package `com.cuneytbozok.finpill` and the local signing certificate fingerprint as required by the instance. Keep Invite-only access enabled. Production registration and callback/deep-link configuration remain later foundation work.
2. Set ignored `apps/client/.env.local` values as described in [WEB_AUTH.md](WEB_AUTH.md), including `NEXT_PUBLIC_AUTH_ENABLED=true` and the development publishable key. Never commit this file.
3. Use JDK 21 and Android SDK platform 36. Run `npm run native:sync`, then build from `apps/client/android` with `./gradlew :app:assembleRelease -PfinpillLocalSigning`. The local signing flag uses Android's development keystore for private installation; it is not a distribution signing decision.
4. Install `app/build/outputs/apk/release/app-release.apk` on an emulator or owned device. The native sign-in sheet should show the configured development instance. The protected API bearer acceptance belongs to task 01.10.

## Remaining live acceptance

With an invited account, verify sign-in and “Oturum hazır,” force-stop/relaunch session restoration, Android process recreation, background/resume, token refresh after expiry, offline failure and recovered network, and sign-out. Dismiss the native sheet before authenticating and confirm no session appears. Check the installed artifact and WebView persistence for token/server-key leakage. The task ledger records which cases have actual evidence; a Release build and signed-out emulator launch do not establish signed-in lifecycle behavior.

References: [Clerk Android quickstart](https://clerk.com/docs/android/getting-started/quickstart), [AuthView](https://clerk.com/docs/android/reference/views/authentication/auth-view), [Android authentication reference](https://clerk.com/docs/android/reference/native-mobile/auth), [SDK release 1.0.39](https://github.com/clerk/clerk-android/releases/tag/v1.0.39).
