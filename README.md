# ThousandEyes Transaction Recorder

Record, inspect, and replay ThousandEyes browser transaction tests from Visual Studio Code or the command line.

```text
VS Code extension ─┐
                   ├──> UI (recording editor)
CLI ───────────────┤
                   └──> Runtime (record + play + injected overlay) ──> Playwright
                              │
                              v
                   Core (recording + formats)
                              │
                              v
                     .recording artifacts

             ARIA and utilities support shared packages
```

The VS Code extension and CLI host the shared UI and runtime. The UI provides the host-neutral editor, the runtime coordinates recording, playback, and the injected browser overlay with Playwright, and core owns the recording, serialization, and format support.

## Development

```text
npm install
npx te record https://example.com
```

To test the extension, open this repository in VS Code and press `F5`.
