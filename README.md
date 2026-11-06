# GenerativeMusic

A standalone browser-based procedural Christmas music laboratory. This repository is independent of the PixiJS application. No AI music, external audio engine, downloaded audio or third-party sample pack is used.

## Try it online

**GitHub Pages:** https://qqd99.github.io/GenerativeMusic/

Open the page and press **Start rotation**, **Dedication — Silent Night**, or **Render complete WAV**. Audio playback starts only after a user gesture. The live player uses native Web Audio; the WAV renderer uses `OfflineAudioContext`.

GitHub Pages must be enabled with **Settings → Pages → Build and deployment → GitHub Actions**. The included workflow deploys the repository root after a push to `main`.

## Local development

- Open `index.html` in a modern browser for the self-contained demo.
- For the TypeScript module and tests, use Node.js 22+:
  ```sh
  npm install
  npm run typecheck
  npm test
  ```

## Reusable TypeScript module

`src/generative-music.ts` exports `GenerativeMusic`. It accepts an existing `BaseAudioContext` and an output `AudioNode`; all music routes through that supplied output. It does not create or close an audio context, connect to `context.destination`, or manage autoplay. The host owns master volume, mute and speech ducking.

## Current scope and honest limitations

Two preliminary melody transcriptions are encoded: Jingle Bells and Silent Night. Four styles × five transposition offsets produce 40 virtual track IDs, not 40 distinct carols. The 12 score-verified carol target is not met; both melodies still need note-by-note audit against their cited public-domain score editions. Quiet hours expose only 20 virtual combinations, so the 40-track no-repeat target cannot be met with the current repertoire.

No third-party recordings or samples are included. WAV audition output reports sample peak and RMS only; it does not certify integrated LUFS or true peak. A fast simulated 72-hour rotation test, owner listening sign-off, OBS performance measurement and 24-hour real-time soak remain outstanding. See `docs/known-limitations.md`.
