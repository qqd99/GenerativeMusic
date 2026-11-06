# GenerativeMusic

A standalone browser-based procedural Christmas music laboratory. Independent of the PixiJS application. No AI music, external audio engine, recordings, downloaded samples or third-party runtime audio software.

## Try the browser demo

https://qqd99.github.io/GenerativeMusic/

If GitHub Pages has not been enabled yet, open **Settings → Pages → Build and deployment → GitHub Actions**. The Pages workflow builds the TypeScript modules and deploys the repository root.

## Features

- Twelve Christmas carol melody records; four arrangement styles (swing, ballad, musicbox, bellchoir); five key offsets (240 virtual combinations).
- Seeded composition and deterministic rotation selection.
- Quiet-hour rotation (22:00–06:00, Asia/Ho_Chi_Minh by default).
- Silent Night dedication followed by normal rotation.
- Browser-native Web Audio synthesis; no third-party audio engine or downloaded sample packs.
- OfflineAudioContext WAV export with K-weighted integrated-loudness estimation and 4× cubic true-peak estimation.
- Pure 72-hour scheduler simulation and tests.
- Standalone TypeScript module that accepts the host's BaseAudioContext and output AudioNode.

## Local development

Requires Node.js 22+.

```sh
npm install
npm run typecheck
npm run build
npm test
```

Then serve the repository root over HTTP (for example `python -m http.server 8000`) and open `http://localhost:8000`. Build first so `dist/index.js` exists.

## Integration

See [docs/integration.md](docs/integration.md). The app owns AudioContext lifecycle, master volume, music mute, VieNeu speech, speech ducking, SFX and autoplay. The module only creates music voices and connects them to the supplied output node.

## Important verification note

The catalog now has 12 distinct melodies and 12 public-domain score references. The cited source pages identify the score sources as public domain, but the hand-entered melody transcriptions still require note-by-note score comparison and human sign-off. This project does not claim that score-verification gate is complete. See [docs/tunes.md](docs/tunes.md) and [known limitations](docs/known-limitations.md).

## Project structure

- `index.html` — browser audition page.
- `src/catalog.ts` — repertoire and score provenance.
- `src/composer.ts` — pure seeded composer and config validation.
- `src/scheduler.ts` — pure rotation scheduler with injectable clock.
- `src/generative-music.ts` — Web Audio playback engine.
- `src/offline.ts` — OfflineAudioContext WAV renderer.
- `src/mastering.ts` — loudness and true-peak estimates.
- `tests/` — composer, scheduler, 72-hour simulation and mastering tests.
