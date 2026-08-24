# ThousandEyes Recorder Extension

Provides the Visual Studio Code commands and lifecycle integration for recording and playing ThousandEyes Transaction tests.

The extension is a lightweight view over Recorder Runtime. It owns commands, prompts, editor access, file selection, and notifications without containing browser or recording workflow logic.

Starting a recording opens a blank browser immediately. The first URL entered in the browser becomes the recording's reported start URL and remains the first replayable navigation action.

Completed recordings first open in a private staged custom-editor preview. The user can inspect or play the recording before choosing **Save Recording** or **Discard**; only Save commits a `.recording` directory into the selected location. Closing a staged preview discards it.

Opening a saved `.recording/recording.json` uses the Transaction Recording custom editor by default. The read-only view provides a human-readable step timeline, step details, copyable locator candidates, and the selected step's accessibility snapshot serialized as Playwright YAML with the interacted target highlighted. Snapshots are loaded on demand. Use **Play** to run the recording or **Open JSON** to inspect the manifest in VS Code's text editor.

## Development

Open the `recorder` folder in VS Code and run the **Recorder Extension** debug configuration (F5). The Extension Development Host rebuilds and reloads automatically whenever extension source code changes.
