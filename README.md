# Daymark Fit v0.4.9

Offline-first Expo React Native fitness and routine tracker. Local records are stored in SQLite; no login or cloud account is required.

## Current features
- Activity screen with Walk, Run and Meditation sessions. Walk/Run sessions can record GPS route points, distance and pace; Meditation remains timer-only.
- Android native step counting using `TYPE_STEP_COUNTER`, falling back to `TYPE_STEP_DETECTOR` when available.
- Android foreground service, persistent daily sensor totals, and a boot/package-replacement recovery attempt.
- Step goal progress, estimated distance/calories, daily/weekly/monthly/yearly summaries, last sensor update and permission status.
- Local SQLite persistence for step totals, activities, planner records and preferences.
- Multiple routine templates, pinned tasks, recurring tasks, reports, theme presets, accent colour and font-size settings.
- Responsive safe-area-aware navigation and activity screens.

## Important tracking limitations
- Android native background tracking requires a native Android build. It does not work in Expo Go. After native module changes, run `npx expo prebuild` and build/install the app again.
- Continuous tracking depends on the phone having a supported step sensor, the user granting physical-activity permission, Android service policies, and device-vendor battery restrictions. Force-stop or revoked permissions can interrupt tracking. Reboot recovery is attempted, but must be verified on the target device.
- iOS currently uses Expo Pedometer foreground updates; the Android native background service is Android-only.
- Walk/Run sessions request foreground location and, when the user agrees, background location to record GPS route points, distance and pace. GPS can be inaccurate indoors or with weak signal; when insufficient route points are available, distance falls back to a labeled step-based estimate. Meditation does not use location. Daily step counting remains independent of workout GPS.
- The source sanity check is not a substitute for native compilation or real-device QA. Do not consider the release production-certified until these checks pass.

## Setup
Use Node.js 22 LTS with Expo SDK 54. Extract this ZIP into a **new, empty folder**. Do not merge it into an older v0.3.0 project folder: duplicate source trees and old `node_modules` can cause TypeScript to resolve mismatched Expo/React Native types. Use Node.js 22 LTS. This archive intentionally has no lockfile, so install dependencies once from this clean folder.

```bash
npm install
npx expo install --check
npm run typecheck
npm test
npx expo-doctor
```

## Android build
For local native build:

```bash
npx expo prebuild --platform android
npx expo run:android
```

Or use an EAS Android build configured to produce an installable APK. The local `modules/daymark-step-tracker` module is included in this source archive and must be compiled into the native app.

## v0.4.1 planner improvements

- Create, rename, and delete planner templates.
- Add, edit, and delete tasks inside a selected template.
- Pin/unpin task definitions; Home shows only today's pinned task instances across all templates.
- Export daily, weekly, and monthly planner records to PDF using the device's print/share flow.
- Local-first task definitions are stored in the `plannerTemplates` preference; task completion instances are stored in SQLite.

PDF reports include the planner task records that exist in the local database for the selected period. Since recurring occurrences are materialized as the planner is opened, users should open Planner regularly to create each day's task instances. Validate PDF sharing and task persistence on a physical Android device before a public release.


## v0.4.3 planner and visual iteration
- Planner templates support create, rename, duplicate and delete.
- Tasks support add/edit/delete, pinning across templates, notes and daily/weekly/monthly repeat choices.
- Home shows only tasks pinned in any template.
- Planner exports daily, weekly and monthly PDF summaries.
- Theme presets use matte charcoal/black and restrained red accents; accent colour and shared text size are configurable.
- Analytics includes a distance trend chart and explicit no-data messaging.

See `CHANGELOG-v0.4.3.md` for limitations and validation status.


## v0.4.5 step-tracking architecture

- Android uses the local Expo module in `modules/daymark-step-tracker` to register the native `TYPE_STEP_COUNTER` sensor (falling back to `TYPE_STEP_DETECTOR`).
- The native foreground service writes daily totals and the last sensor counter to Android SharedPreferences so step collection can continue while the React Native UI is backgrounded. The UI periodically reconciles the native total into SQLite.
- A boot/package-replacement receiver attempts to restart the service when Android permits it. Android force-stop, revoked permissions, unsupported hardware, battery policies and vendor restrictions can still interrupt tracking.
- This requires a native Android build (`npx expo prebuild` then `npx expo run:android`, or an EAS development/production build); Expo Go cannot load this local native module. Rebuild after changing native code.
- iOS remains on Expo Pedometer foreground updates in this release; this native background service is Android-only.
- No GPS/location permission is requested. Distance and calories are estimates.

### Verification status

Source sanity checks can be run with `npm test`. TypeScript/native compilation and background/reboot behaviour must be verified with a complete dependency install and a real Android device before calling this client-ready.


## Latest source changes
See `CHANGELOG-v0.4.8.md` for the PDF sharing, meditation metrics, and step refresh changes. Native build and real-device tracking must be verified before release.


## v0.5.0 update and validation notes

- Corrected the Expo SDK dependency family to SDK 58 / React Native 0.88 to match the versions already declared by the router and React Native. The previous lockfile pinned Expo 44 and `expo-modules-core` 0.6.5, which caused the missing-export TypeScript errors.
- Added the local `daymark-step-tracker` module as a package dependency so Expo autolinking can discover it.
- Fixed the tab icon nullable color typing.
- Fixed the React Native strict TextInput ref typing.
- Updated Planner task notes to multiline and added keyboard-aware scrolling in the task editor modal.
- Added a dedicated `/run-tracker` route and connected Activity → Run to it. The route saves a run record and route JSON to SQLite when `onSaveWorkout` completes.
- Removed the duplicated nested `daymark_v049` copy from this delivery and omitted `node_modules` and `.git` to keep the source archive clean.

### Install after extracting

Use Node.js 22.13+ for SDK 58. From the project root:

```powershell
npm install
npx expo install --fix
npx expo-doctor
npm run typecheck
npm test
```

Then rebuild native Android because Expo SDK and native module versions changed:

```powershell
npx expo prebuild --clean --platform android
npx expo run:android
```

`prebuild --clean` regenerates the native Android folder; commit/backup any custom native changes first. If you use the checked-in Android project as a source of custom changes, back it up before running this command.

### QA limitations

The source sanity script passes in the build environment. This environment did not have network access to reinstall the SDK 58 dependency tree, and no Android device/emulator was attached, so a fresh SDK 58 TypeScript run, Gradle build, runtime test, GPS accuracy test, background/process-death test, and PDF share-sheet device test are **not claimed as passed**. Run the commands above and test on a physical Android device before treating this as production-ready.


## v0.5.2 build notes

The Strava-style map display and `react-native-maps` dependency are removed. Outdoor run GPS recording and workout metrics remain available in a map-free screen. Planner templates, tasks, multiline notes, SQLite storage, steps, activity sessions and analytics/reporting are retained. See `CHANGELOG-v0.5.2.md`. After extracting, run `npm install`, `npm run typecheck`, `npm test`, then `eas build --platform android --profile preview`. This source has not been validated by a fresh EAS build or device QA.


## v0.6.0 update

This release adds first-launch height setup, a height-based stride estimate, activity-history date/type/distance filters, sorting, and heuristic session review labels. The Android daily step module prefers per-step detector events checked against accelerometer variation and cadence; devices without the required filtered sensor combination report tracking unavailable rather than silently counting unfiltered cumulative steps. This heuristic reduces some false detections but cannot guarantee perfect separation of walking from motorbike vibration on every device.

The map UI and `react-native-maps` dependency remain removed. Walk/run sessions still use GPS for distance and pace without drawing a map.

### Build / verify

1. Extract the archive and open a terminal in `daymark-fit-release`.
2. Run `npm install` to generate a local `package-lock.json` and install SDK dependencies.
3. Run `npx expo install --fix`, `npm run typecheck`, and `npm test`.
4. Only after those checks pass, run `npx expo-doctor` and create a new Android preview build.

This archive passed its source sanity script in the packaging environment, but it has not been tested with a complete dependency install, a fresh EAS Android build, or on a physical phone.
