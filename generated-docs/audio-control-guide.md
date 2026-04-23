# Audio Control Guide

## Key Takeaway

The PoC validated that web audio control is viable on iOS Safari for this project shape.

- Background playback works with a standard HTML5 `<audio>` element and a single shared player instance. See `@poc/background-play/index.html:41` and `@poc/background-play/app.js:28`.
- Lock screen / Now Playing controls can be customized and handled through the Media Session API. See `@poc/background-play/app.js:65`, `@poc/background-play/app.js:139`, and `@poc/background-play/app.js:191`.
- Auto-playing the next track works after the user has manually started playback once. See `@poc/auto-play-next/index.html:15`, `@poc/auto-play-next/app.js:80`, and `@poc/auto-play-next/app.js:124`.

## Practical Guidance

Use a single long-lived `<audio>` element and treat it as the source of truth for playback state.

- Require one explicit user gesture to start the first track. See `@poc/auto-play-next/index.html:49` and `@poc/auto-play-next/app.js:94`.
- After that gesture, it is acceptable to switch `src` and call `audio.play()` on `ended` for the next item in the queue. See `@poc/auto-play-next/app.js:48`, `@poc/auto-play-next/app.js:80`, and `@poc/auto-play-next/app.js:124`.
- Register Media Session metadata and action handlers whenever the active track changes. See `@poc/background-play/app.js:100`, `@poc/background-play/app.js:110`, and `@poc/background-play/app.js:147`.
- Keep the page state synchronized with native media actions such as play, pause, previous, and next. See `@poc/background-play/app.js:125`, `@poc/background-play/app.js:130`, and `@poc/background-play/app.js:191`.

## Important Implementation Note

The PoC exposed one easy failure mode: if the app only "arms" queue progression from a custom button, auto-play-next can fail when playback is started from the native `<audio>` controls instead.

That fix is captured directly in the PoC by arming the sequence from both the custom start button and the native `play` event. See `@poc/auto-play-next/app.js:94` and `@poc/auto-play-next/app.js:109`.

For production code:

- Arm the queue on the first real playback event, not only on a custom UI button.
- Support both custom controls and native audio controls.
- Keep event logging during development because browser media behavior is sensitive to timing and platform differences. See `@poc/background-play/app.js:42` and `@poc/auto-play-next/app.js:26`.

## Recommendation

Proceed with a web implementation based on:

- one persistent `<audio>` element
- Media Session integration for metadata and transport controls
- queue advancement driven by the `ended` event
- an initial manual play requirement to satisfy browser autoplay policy

This area is no longer a high-risk blocker for the project, though final QA should still be done on real iOS and Android devices during app integration.
