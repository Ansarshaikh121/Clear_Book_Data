# Clearbook Android release

Clearbook's Android app should be a **Trusted Web Activity (TWA)** pointing to
`https://clearbookdata.in`. This keeps the existing browser based sign in,
statement upload and authenticated server flows. The app requires a network
connection; the service worker displays an offline notice and stores no private
responses.

## Build sequence

1. Merge and deploy the installable PWA PR. Check
   `https://clearbookdata.in/__grok/manifest.webmanifest` has the name
   "Clearbook", a 512 px icon, and the correct public HTTPS origin.
2. Confirm the final Android application ID in Play Console before building.
   A possible ID is `in.clearbookdata.app`; **do not publish with a provisional
   ID**. The package ID cannot be changed for that Play listing.
3. Install the current `@bubblewrap/cli` and use
   `bubblewrap init --manifest=https://clearbookdata.in/__grok/manifest.webmanifest`.
   Select the final package ID, Clearbook name and production signing key.
   Review the generated Android project and set `targetSdkVersion` to **36 or
   higher** before building the release AAB. Use `bubblewrap build` and check
   the generated bundle's target API and signing certificate.
4. Enable Play App Signing. Read the **App signing key certificate** SHA-256
   fingerprint in Play Console (this may differ from the upload key). Run
   `node scripts/android-assetlinks.mjs <final-package-id> <app-signing-SHA256> > public/.well-known/assetlinks.json`.
   Deploy that file to the same HTTPS domain; verify its public response is
   JSON and contains the final package ID and certificate. For local sideload
   testing, add the local release key fingerprint too; never commit keystores.
5. Install and test the built app on a real Android device. Verify that domain
   verification removes the Custom Tab toolbar, Google login returns to
   Clearbook, email login works, statement PDF picker/upload works, downloads
   work, a logged-out user cannot access account data, and offline shows only
   the offline notice.
6. Finish the Play listing with screenshots, privacy policy, account deletion
   process, Data safety, and Financial features declaration verified against
   the deployed app. Do not assert that Clearbook provides banking, loans or
   payments if it is only a personal ledger.
7. Upload a signed **AAB** to internal testing, complete prelaunch checks and
   any required closed test, then submit for production review.

## Release blockers outside the source repository

- An active Play Console account with permission to create and release the app.
- Final app ID, signing key kept outside git, and Play App Signing fingerprint.
- Public privacy policy and account deletion instructions/endpoint reflecting
  real data handling, including analytics and uploaded statements. These were
  not established by this Android preparation.
- Store declarations and testers if the developer account needs closed testing.

Do not paste account credentials, keystores or signing passwords in PRs or chat.
The GitHub PR is source preparation; it does not create a signed AAB or submit
an app to Google Play.
