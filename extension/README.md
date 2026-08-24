# ThousandEyes Recorder Extension

Provides the Visual Studio Code commands and lifecycle integration for recording and playing ThousandEyes Transaction tests.

The extension is a lightweight view over Recorder Runtime. It owns commands, prompts, editor access, file selection, and notifications without containing browser or recording workflow logic.

Starting a recording opens a blank browser immediately. The first URL entered in the browser becomes the recording's reported start URL and remains the first replayable navigation action.

Completed recordings are saved as directories containing a lean `recording.json` document and an indexed `snapshots` directory. Snapshots are staged in extension storage while recording and are only copied into the workspace after the user confirms the save.

## Development

Open the `recorder` folder in VS Code and run the **Recorder Extension** debug configuration (F5). The Extension Development Host rebuilds and reloads automatically whenever extension source code changes.
