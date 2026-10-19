# Build the installable Android APK

This repository is configured for an EAS preview APK. The source package itself is not an APK, and no successful native build is claimed until EAS reports a completed build.

## Build with Expo Application Services

1. Install Node.js 22 LTS and npm.
2. From the project directory run `npm install`, `npm run test`, and `npm run typecheck`.
3. Create/sign in to an Expo account at https://expo.dev/.
4. Run `npx eas-cli login` and `npx eas-cli init` to associate this project with an Expo project. Commit the generated project ID in the app config.
5. Run `npx eas-cli build --platform android --profile preview`.
6. Download the APK from the completed EAS build page and install it on a physical Android device.

## GitHub Actions build

1. Push this project to a GitHub repository.
2. Add an Expo access token as repository Actions secret `EXPO_TOKEN`.
3. Run **Actions → Android APK (EAS) → Run workflow**, or push a `v*` tag.
4. Wait for EAS to complete and retrieve the build from Expo's build page.

## Before distributing

- Complete `RELEASE_CHECKLIST.md` on physical devices.
- Check that the generated APK package ID and version are correct.
- Verify GPS recording with mobile data and Wi-Fi disabled.
- Test screen-off/background tracking, permission denial, GPS loss, app process kill, reboot, and recovery. Background GPS varies by Android version and manufacturer.
- Verify PDF export, JSON backup/restore, analytics, and local data persistence.
- Configure the correct signing and release channel for your intended distribution. A preview/internal APK is not the same as a Play Store production release.
