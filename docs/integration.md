# Integration example (proposal only)

This project is standalone. Do not copy it into the PixiJS app without the integrating agent's review. The existing app remains the owner of context lifecycle, master volume, mute, speech ducking, VieNeu speech, SFX and autoplay.

```ts
import { GenerativeMusic, defaultConfig } from 'generativemusic';

// Reuse the app-owned audio context and the app-owned music bus.
// Never pass context.destination unless that is the app's intended output node.
const music = new GenerativeMusic({
  context: appAudioContext,
  output: appMusicBus,
  config: defaultConfig,
  onTrack: ({ title, style, bpm }) => {
    console.info('Music:', title, style, bpm);
  }
});

// The app decides when to call these, e.g. after its own user gesture.
music.start();
music.dedication(); // Silent Night, then normal rotation
music.transitionTo('exciting', 8); // 8-bar same-song emotional transition
music.transitionTo('calm', 8); // transition back to calm
music.stop();
music.dispose(); // when the owning app permanently tears down this module
```

The module does not create an AudioContext, call resume/suspend/close, set master volume, change mute, duck for speech, play gift sounds, or connect to `context.destination`.

Mood transitions preserve the current carol, key and tempo. The accompaniment is recomposed deterministically and crossfaded over the requested number of bars. Supported moods are `calm` (ambient accompaniment) and `exciting` (festive swing accompaniment); valid transition lengths are 1–32 bars. Every live musical voice routes through the supplied `output` AudioNode.

## Host-side responsibilities

- Create and resume the app-owned AudioContext after a user gesture.
- Create and manage the music bus and global master bus.
- Apply master volume, mute and speech ducking outside this module.
- Route gift/reward sound effects through the separate SFX bus.
- Call `stop()` during music stop and `dispose()` during permanent teardown.
- Do not let this module control TikTok handling, rewards, scenes, TTS, WebSocket messages or operator controls.

## Offline audition

The browser audition uses `renderTrackOffline()`, which creates an OfflineAudioContext for rendering a WAV. This is an isolated render context, not a live app AudioContext. The live playback class still accepts only the supplied host context and output node.
