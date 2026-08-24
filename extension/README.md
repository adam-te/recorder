# ThousandEyes Recorder Extension

Provides the Visual Studio Code commands and lifecycle integration for recording and playing ThousandEyes Transaction tests.

The extension is a lightweight adapter over Recorder UI and Recorder Runtime. It owns commands, prompts, editor access, file selection, notifications, and VS Code theming without containing generic presentation or browser automation logic.

The webview JavaScript and CSS under `dist/webview/` are generated from the shared UI package and the small adapter in `webview/`; they are not extension-owned UI source.

Starting a recording opens a blank browser immediately. The first URL entered in the browser becomes the recording's reported start URL and remains the first replayable navigation action.

Recordings are staged as visible, recoverable drafts under `.thousandeyes-recorder/drafts` in the active workspace folder. The draft directory and its raw `recording.json` and `snapshots/*.aria.json` files can be inspected in the Explorer before choosing **Save Recording** or **Discard**. Closing a staged preview retains the draft and warns the user; the preview can be reopened from the warning or directly from its `recording.json`. When no workspace folder is open, the extension falls back to its private storage.

Opening a saved `.recording/recording.json` uses the Transaction Recording custom editor by default. The read-only view provides a human-readable step timeline, step details, copyable locator candidates, and the selected step's accessibility snapshot serialized as Playwright YAML with internal element refs hidden and the interacted target highlighted. Snapshots are loaded on demand. Use **Play** to run the recording or **Open JSON** to inspect the manifest in VS Code's text editor.

## Development

Open the `recorder` folder in VS Code and run the **Recorder Extension** debug configuration (F5). The Extension Development Host rebuilds and reloads automatically whenever extension source code changes.
