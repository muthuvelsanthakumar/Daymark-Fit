# Daymark Fit v0.6.1 — activity logic update

- Added shared activity consistency checks with `Verified`, `Needs Review`, and `Low Confidence` statuses and human-readable reasons. These checks are advisory and do not claim to prove an activity is genuine.
- Adjusted GPS distance filters to retain plausible faster running segments up to 9.5 m/s while still rejecting extreme GPS jumps and stationary jitter.
- Updated height-based stride estimates to match the requested reference points: 165 cm → 0.65 m, 175 cm → 0.70 m, and 180 cm+ → 0.80 m. These remain rough estimates and can be calibrated by the user.
- Improved Android step detector cadence filtering so rejected sensor events do not reset the accepted-step cadence baseline. It combines per-step detector events with recent accelerometer variation; this reduces some vibration false positives but cannot guarantee perfect vehicle rejection.
- Preserved GPS route recording, local SQLite storage, the no-map UI, and independent all-day step totals.

## Verification note
`npm test` is a source sanity check, not a native Android build or real-device sensor QA. Validate on a physical Android phone before release.
