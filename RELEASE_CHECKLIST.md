# Daymark Fit release checklist

Do not mark this build production-ready until the following checks pass on real Android devices.

## Core functionality
- [ ] First launch, onboarding/permissions, navigation, empty states, and settings.
- [ ] Run and walk start/stop, pause/resume, timer excludes paused time, and saved duration is correct.
- [ ] GPS points continue recording with Wi-Fi and mobile data disabled.
- [ ] Weak GPS and GPS-off states are understandable and do not claim false accuracy.
- [ ] Test open-sky, urban buildings, tree cover, and indoor GPS loss. Confirm route distance does not bridge long outages.
- [ ] Screen-off/background location on supported Android versions with required permission granted.
- [ ] Denying background location does not prevent foreground tracking.
- [ ] Force-stop/app process kill during an activity; verify persisted route journal is retained and the product has a safe recovery/abandon path before release.
- [ ] Confirm no duplicate route points or duplicate daily aggregate totals after repeated saves/imports.
- [ ] Confirm step sensor unavailable/permission denied states remain usable.

## Data and reports
- [ ] Activity history, analytics and planner reflect saved records only (no demo metrics).
- [ ] Export backup; import valid backup; reject malformed backup without partial writes.
- [ ] PDF report generation and native share sheet work.
- [ ] Reinstall/upgrade behaviour and backup expectations are documented.
- [ ] Verify timezone/date boundaries for daily activity totals.

## Release quality
- [ ] `npm run test` passes.
- [ ] `npm run typecheck` passes.
- [ ] EAS preview APK build succeeds.
- [ ] Install APK on at least two physical Android devices and test upgrade/install flow.
- [ ] Check battery consumption, app size, accessibility/text scaling, dark theme, and permission prompts.
- [ ] Review privacy policy, app-store declarations, attribution and signing configuration.
- [ ] Replace this checklist with test results and versioned release notes.
