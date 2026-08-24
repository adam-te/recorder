# Recorder Runtime

Provides the application API used to record and play transactions outside any particular user interface.

It coordinates recording state with Playwright browser lifecycle, page-interaction capture, locator resolution, and playback. The actions form the complete replayable event stream, including the first browser navigation. The recording document also reports that first entered URL as `startUrl` metadata for users, but playback relies only on the actions.

ARIA snapshots are emitted separately with their action index. They provide authoring context but are not part of the replayable action document.

Recording begins on a blank page. Browser address entry is recorded as a `goto` action; Back, Forward, and Reload are not recorded. Each recorded action also includes the page URL observed when it occurred for diagnostics; that context URL does not drive playback.

## Recording flow

- `recording/createRecorder.ts` owns the public recording lifecycle.
- `recording/installRecordingCapture/` composes browser-navigation capture with the bridge to the injected page recorder.
- `recording/injected/` is client-side code serialized into every browser page. It intercepts events and generates ranked selector candidates.
- `recording/processing/` receives captured interactions on the server side and turns them into recorded actions and locators.
- `playback/` executes completed recording documents.

Low-level capture APIs are available from `@te/recorder-runtime/capture`; the package root exposes the normal recorder, playback, and browser-session APIs.
