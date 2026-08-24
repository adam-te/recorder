# Recorder Runtime

Provides the application API used to record and play transactions outside any particular user interface.

It coordinates recording state with Playwright browser lifecycle, page-interaction capture, locator resolution, and playback. Every recording requires an initial URL up front. The actions form the complete replayable event stream, including navigation to that URL as the first action. The recording document also reports the supplied URL as `startUrl` metadata for users, but playback relies only on the actions.

ARIA snapshots are emitted separately with their action index. They provide authoring context but are not part of the replayable action document.

Recording begins by navigating to the required initial URL. Subsequent browser address entry is recorded as a `goto` action; Back, Forward, and Reload are not recorded. Each recorded action also includes the page URL observed when it occurred for diagnostics; that context URL does not drive playback.

## Recording flow

- `recording/createRecorder.ts` owns the public recording lifecycle.
- `recording/capture/` reports browser navigation and page interactions without owning recorder state.
- `recording/injected/` installs the shared in-page recorder runtime and manages its browser bindings.
- `recording/actions/` and `recording/locators/` turn captured interactions into recording-domain values.
- `injected/` contains browser-only capture, overlay integration, and locator code. A single entry point is bundled into `injected/generated/` by `npm run generate:injected-runtime` so those features share ARIA and locator dependencies.
- `playback/` resolves locators and executes completed recording documents.
- `snapshots/` contains independent browser snapshot utilities.

Low-level capture APIs are available from `@te/recorder-runtime/capture`; the package root exposes the normal recorder, playback, and browser-session APIs.
