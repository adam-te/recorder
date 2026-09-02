# ThousandEyes Transaction Recorder

Record, inspect, and replay ThousandEyes browser transaction tests from Visual Studio Code or the command line.

This npm workspace contains two applications built on shared recorder packages. Recordings are stored as portable `.recording` directories that can be inspected and replayed by either application.

## Development

```text
npm install
npx te record https://example.com
```

To test the extension, open this repository in VS Code and press `F5`.

## Project map

- [`apps/cli`](apps/cli/README.md)
- [`apps/vscode-extension`](apps/vscode-extension/README.md)
- [`packages/aria`](packages/aria/README.md)
- [`packages/capture`](packages/capture/README.md)
- [`packages/execution`](packages/execution/README.md)
- [`packages/recording`](packages/recording/README.md)
- [`packages/ui`](packages/ui/README.md)
