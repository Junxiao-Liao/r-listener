# Audio Playback PoCs

This directory contains two standalone browser PoCs built from `generated-docs/poc-plan.md`.

- `background-play/`: verifies basic audio playback plus Media Session metadata and lock-screen media actions.
- `auto-play-next/`: verifies that track 2 can start automatically after track 1 ends.

## Run

Serve the repo locally so the browser loads the files over `http://localhost` instead of `file://`:

```bash
python3 -m http.server
```

Then open `http://localhost:8000/poc/`.

## Notes

- The audio files are locally generated WAV fixtures inside `assets/audio/`.
- The Media Session API behavior should be validated on physical iOS and Android devices.
- Some lock-screen behaviors vary by browser and OS version, so the event log in each PoC is included to help compare results.
