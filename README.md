# ThousandEyes Transaction Recorder

Record, inspect, and replay ThousandEyes browser transaction tests from Visual Studio Code or the command line.

This npm workspace contains two applications built on shared recorder packages. Recordings are stored as portable `.recording` directories that can be inspected and replayed by either application.

## Project map

| Path                              | Purpose                                 |
| --------------------------------- | --------------------------------------- |
| `apps/cli`                        | Command-line recorder                   |
| `apps/vscode-extension`           | VS Code recorder extension              |
| `packages/capture`                | Captures browser interactions           |
| `packages/recording`              | Defines the recording model and formats |
| `packages/ui`                     | Provides the shared recording editor    |
| `packages/execution`              | Replays recordings in Playwright        |
| `packages/aria`, `packages/utils` | Supporting shared functionality         |

## Development

```text
npm install
npx te record https://example.com
```

To test the extension, open this repository in VS Code and press `F5`.
