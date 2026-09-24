# Native shell build and acceptance — task 01.02

Both native projects use `com.cuneytbozok.finpill`. Capacitor core, CLI, iOS,
Android and the Swift package are pinned to 8.5.2. `apps/client/out` is the only
web input: it is the same Next.js static export used by the web deployment.
The configuration contains no remote server URL or navigation allowlist, and
WebView debugging is disabled. Native authentication and deep-link adapters
remain later tasks. Stock Capacitor icons/splash screens are placeholders.

## Reproduce the bundled shell

Use the repository Node/npm pins and `npm ci` from the repository root, then:

```sh
NEXT_PUBLIC_APP_ENV=production NEXT_PUBLIC_API_ENABLED=false NEXT_PUBLIC_AUTH_ENABLED=false npm run native:sync
```

This builds an optimized static client, syncs it to both projects, and compares
every exported asset by SHA-256 with both native copies. The inspection rejects
server output, environment files, source maps, private keys, unexpected files,
remote-server configuration, stale/missing assets and known secret patterns.
If any listed server-secret environment values are present, it also rejects
their exact values in assets. This is artifact hygiene, not proof that every
possible secret format can be detected. CI repeats the static sync/inspection;
it does not substitute for native compilation or runtime acceptance.

Run sync again after every client/configuration change. Do not copy `.next`,
API output or environment files into either native project. Public API/auth
configuration changes require a new bundled client. The standalone proof keeps
both integrations disabled, so no development/API server is required.

## iOS Release

Prerequisites: Xcode 26+ with its matching iOS platform components and an
available simulator runtime. Verified on Xcode 26.6 with the iOS 26.5 SDK and
iPhone 17 Pro simulator. Install matching platform components in
**Xcode → Settings → Components** when a build destination is unavailable.

```sh
xcodebuild -project apps/client/ios/App/App.xcodeproj -scheme App \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/finpill-ios-release CODE_SIGNING_ALLOWED=NO build
node tools/check-native-assets.mjs /tmp/finpill-ios-release/Build/Products/Release-iphonesimulator/App.app
```

Simulator builds do not need a signing account. Owned-device testing may use
the owner-approved Xcode Personal Team; configure it locally in Signing &
Capabilities. Do not commit private signing material.

## Android Release

Prerequisites: Android Studio 2025.2.1+, **JDK 21**, SDK platform 36, build
tools 35.0.0, and an ARM emulator/system image or owned device. Set `JAVA_HOME`
to JDK 21 and `ANDROID_HOME` to the SDK locally. Recent Android Studio versions
may bundle Java 25, which fails with this project’s Gradle 8.14.3
(`Unsupported class file major version 69`). Use JDK 21 for this project;
do not change the project’s Gradle version merely to match Studio’s runtime.
Select API 36 in **Tools → SDK Manager** and create a device in
**Tools → Device Manager**. Accept required image licenses locally.

```sh
cd apps/client/android
./gradlew assembleRelease -PfinpillLocalSigning
```

`finpillLocalSigning` opts into the local debug keystore for installation of a
non-debuggable Release build; without it, release signing remains unconfigured.
This is the approved private-use proof, not store signing. Extract `assets/*`
from `app/build/outputs/apk/release/app-release.apk` into a fresh temporary
directory and run `node tools/check-native-assets.mjs <extracted-directory>/assets`
from the repository root. Extracting only assets avoids unrelated Android
resource-name collisions on case-insensitive macOS filesystems. Inspect the
manifest/application flags to confirm the Release build is not debuggable.

Build both native artifacts after the **same final** production sync. Next.js
build identifiers change on a rebuild, so rebuilding the web export afterward
requires rebuilding the native artifacts before comparing hashes.

## Required runtime acceptance

1. Build both Release artifacts and inspect the actual `.app` and extracted APK.
2. Stop any web development/static server. Install each artifact locally.
3. Terminate/force-stop, then cold-launch each shell. Capture the rendered
   Finpill home screen and verify navigation to search works with no server.
4. Repeat with network unavailable to demonstrate bundled asset loading.
5. Record device/runtime, build mode, artifact identity and outcomes in the
   task PR (attach screenshots/logs there). Do not treat sync alone as runtime
   acceptance.

The shared layout exports `viewportFit: "cover"` so its CSS safe-area padding
receives native insets. Verify the header clears the status bar and bottom
navigation clears the home indicator on each platform.

No secrets or store-account enrollment are needed for this local proof.

Documentation checked through Context7: [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup),
[SPM setup](https://capacitorjs.com/docs/ios/spm), and
[build/sync workflow](https://capacitorjs.com/docs/basics/workflow).
