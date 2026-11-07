# Requirement-to-implementation status

This checklist maps only the requirements present in the supplied music brief. It does not infer the content of unseen change-request documents.

| Requirement | Current status | Evidence / caveat |
|---|---|---|
| Standalone browser module, separate from PixiJS app | Implemented | This public repository is independent; no app source was changed |
| TypeScript and Web Audio | Implemented | `src/generative-music.ts` |
| Accept host BaseAudioContext and output AudioNode | Implemented | `GenerativeMusic` constructor; live voices route through internal bus to supplied output |
| Never create/close/suspend host AudioContext or control autoplay | Implemented | Player class does not own context lifecycle; demo owns its own context and starts after user gesture |
| start(), stop(), dedication() | Implemented | Idempotent scheduler/player methods; dedication returns to rotation |
| Separate composer, scheduler and playback | Implemented | `composer.ts`, `scheduler.ts`, `generative-music.ts` |
| Deterministic seeded composition and injected clock | Implemented | Pure composer and clock-driven scheduler |
| 72-hour fast scheduler simulation | Implemented | Fake-clock test; no audio playback |
| OfflineAudioContext WAV audition | Implemented | `renderTrackOffline()`; browser exports WAV on demand |
| Bounded active voices and look-ahead | Implemented | Voice cap and configurable 1.25-second look-ahead default |
| Sample cache below 150 MB | Implemented by omission | No decoded sample assets or sample cache; procedural noise only |
| Smooth transitions and node cleanup | Implemented in engine | Crossfade, scheduled stop, onended cleanup; real device soak still needed |
| Quiet-hour behavior | Implemented | Ballad/musicbox during configured 22:00–06:00 local time |
| Dedication support | Implemented | Silent Night dedication, then normal rotation; skips that tune on immediate next pick |
| Twelve public-domain/PD score source records | Recorded | See `docs/tunes.md`; sources identify scores as public domain |
| Twelve note-for-note verified melody transcriptions | **Pending** | Every hand-entered melody still needs a score-by-score pitch/rhythm audit and human sign-off |
| Approximately −22 LUFS / below −1 dBTP | Engineering estimates implemented | Offline K-weighted loudness estimate and 4× cubic true-peak estimate; live gain estimate and peak bound; independent reference-meter verification remains |
| Owner audition and 24-hour soak | Pending | Cannot be completed without owner listening and real target runtime/device |
| OBS CPU/GPU acceptance | Pending | Requires the actual streaming setup |
| Gift/SFX separation | Preserved | No gift effects included; integration note reserves SFX for app-owned bus |
| No downloaded art/audio | Implemented | All timbres procedural; no samples/recordings/artwork downloaded or included |

## What is needed to close the remaining gates

1. Compare each of the 12 encoded melodies against the exact linked score edition, then have a human reviewer sign off.
2. Render representative WAVs and verify integrated LUFS/true peak with a trusted reference meter and listening review.
3. Run the actual browser/OBS environment for 24 hours and record CPU/GPU/memory behavior.
4. Have the owner approve the repertoire, style balance, quiet-hour sound and dedication arrangement.
