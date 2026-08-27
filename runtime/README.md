# Recorder Runtime

Provides the reusable browser-backed recording and playback layer for recorder hosts.

It manages Playwright browser sessions, captures transactions into core recording documents, and replays completed recordings. The CLI and VS Code extension remain responsible for persistence and host-specific user experience.

## APIs

The package root exposes the recorder, playback, and browser-session APIs.
