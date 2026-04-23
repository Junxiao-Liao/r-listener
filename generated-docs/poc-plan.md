# Proof of Concept (PoC) Plan

Based on the project requirements and our decisions, the PoC phase will focus on mitigating the highest technical risks associated with web-based audio playback on mobile devices.

## Strategy

We will build **separate, isolated proof-of-concepts** for each high-risk feature. This allows us to validate core capabilities without the overhead of a full application structure and makes debugging much simpler. 

For these PoCs, we will use **mock data** (static, locally hosted audio files) rather than building out the backend or S3 integration, focusing purely on frontend browser capabilities.

## PoC 1: Background Play & Media Session API

**Goal:** Prove that audio continues to play when the mobile browser is minimized or the screen is locked, and that the lock screen controls work.

**Features to Test:**
- Basic HTML5 `<audio>` playback.
- Integration with the [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API) to customize the lock screen notification (title, artist, album art).
- Handling lock screen actions (play, pause, next track, previous track).

**Expected Outcome:** A simple HTML page with a play button. When playing on iOS/Android, locking the screen should display a custom "Now Playing" card, and the media controls should correctly interact with the web page.

## PoC 2: Auto-play Next Track

**Goal:** Prove that we can seamlessly transition to the next audio track without requiring explicit user interaction, adhering to browser auto-play policies.

**Features to Test:**
- Listening to the `ended` event on the `<audio>` element.
- Programmatically changing the audio source and calling `.play()` when the current track finishes.
- Ensuring this works consistently on mobile browsers where auto-play rules are strictly enforced (especially after the screen has been locked during the first track).

**Expected Outcome:** A simple HTML page with two hardcoded audio tracks. Starting the first track manually should result in the second track playing automatically when the first one finishes, even if the user hasn't interacted with the page recently or the screen is locked.

## Out of Scope for Initial PoC

- **Backend / Database / S3:** Will be mocked.
- **Interactive Lyrics:** Deferred to later development stages as it's primarily a UI/UX implementation detail rather than a core platform risk.
- **Full UI/Styling:** Only bare-minimum HTML elements needed to trigger actions will be used.