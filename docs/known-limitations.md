# Acceptance status and known limitations

## Implemented in this repository

- Standalone browser demo; no PixiJS app files are modified.
- TypeScript composition, rotation scheduler and Web Audio playback are separate modules.
- Twelve distinct carol melody records, four styles and five transposition offsets (240 virtual combinations).
- Seeded composer and seeded repertoire selection; injected clock for rotation and quiet-hour simulation.
- A 72-hour simulated scheduler test checks the rolling 40-track no-repeat window without rendering or playing 72 hours of audio.
- Quiet-hour rotation uses ballad/musicbox styles; configured timezone defaults to Asia/Ho_Chi_Minh.
- Dedication plays Silent Night and then resumes normal rotation without immediately selecting Silent Night again.
- Playback accepts a supplied BaseAudioContext and output AudioNode; app master volume, mute and speech ducking remain outside the module.
- Look-ahead scheduling uses AudioContext.currentTime; active musical voices are capped; stop cancels rotation/tick timers and stops scheduled sources.
- No decoded samples or third-party audio dependencies. A single small procedural noise buffer is reused by live playback.
- OfflineAudioContext renderer exports PCM WAV and includes K-weighted integrated-loudness estimation plus 4× cubic-interpolation true-peak estimation and gain normalization.
- CI runs TypeScript typecheck, build and unit tests.

## Still not signed off

- **Score verification:** 12 score sources are recorded and their pages identify the scores as public domain, but the note-by-note transcription audit remains pending for every hand-entered melody. Do not mark the CR-03 “12 verified scores” requirement complete until reviewed and signed off.
- **Legal scope:** public-domain claims depend on jurisdiction and exact score edition. The ledger records source-page statements, not legal advice or a worldwide legal opinion.
- **Audio acceptance:** offline export uses an EBU R128-style K-weighted integrated-loudness estimate and a 4× cubic true-peak estimate, not an independent standards-certified meter. Live playback uses a deterministic event-energy/peak-bound estimate for track gain, not a real-time standards-certified loudness meter. Human listening and reference-meter verification remain required.
- **Target loudness:** offline export aims at −22 LUFS while limiting the estimated true peak to −1 dBTP. Live track gain is estimated toward the same target with a conservative peak bound. If the peak ceiling prevents reaching −22 LUFS, the peak ceiling takes priority.
- **Suspended tabs / delayed timers:** the live look-ahead scheduler only schedules a bounded future window. If a tab is suspended long enough to miss note events, those stale events are skipped rather than replayed as a burst; rotation continues when its delayed timer is allowed to run again. Browser/OS behavior still needs target-device testing.
- **72-hour simulation:** this is a fast scheduler-only test. It does not play audio for 72 hours and does not validate browser throttling, device sleep or OS audio behavior.
- **Operational soak:** owner listening sign-off, OBS CPU/GPU measurements, browser/device compatibility and a 24-hour real-time soak remain outstanding.
- **WAV audition artifacts:** WAVs are generated on demand by the browser OfflineAudioContext renderer; the repository does not commit large generated binary WAVs.

## Dependencies

Runtime: browser Web Audio API only (no external runtime dependency).
Development: TypeScript 5.9 and Vitest 3.
