# ThousandEyes Transaction Recorder

Record, inspect, and replay ThousandEyes browser transaction tests from Visual Studio Code or the command line.

```text
VS Code extension ─┐
                   ├──> UI (editor + recording overlay)
CLI ───────────────┤
                   └──> Runtime (record + play) ──> Playwright
                              │
                              v
                   Core (recording + codecs)
                              │
                              v
                     .recording artifacts

             ARIA and utilities support shared packages
```

The VS Code extension and CLI host the shared UI and runtime. The UI provides the host-neutral editor and browser overlay, the runtime coordinates recording and playback with Playwright, and core owns the recording, serialization, and format codecs.

## Development

```text
npm install
npx te record https://example.com
```

To test the extension, open this repository in VS Code and press `F5`.
