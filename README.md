# ThousandEyes Transaction Recorder

Provides the packages used to author, record, and play back ThousandEyes Transaction tests from Visual Studio Code.

The domain model and recording UI are kept independent from browser automation and editor integration so each layer can evolve without coupling the others.

```text
VS Code extension ──> UI ──────> core
        │                         ▲
        └──────────> runtime ─────┤
CLI ───────────────> runtime      │
                         │        │
                         v        v
                     Playwright  codecs/
                                  └── thousandeyes
```

`ui` provides the host-neutral recording editor and typed host protocol, while the extension supplies a thin VS Code webview adapter and theme mapping. `runtime` provides the reusable browser-backed recorder API, and `core` owns the platform-independent recording document and pure format codecs.

## Development

Install the standalone workspace and run its recursive check from this directory:

```text
npm install
npm run check
```

The check formats, lints, and type-checks the entire workspace, builds the extension, and runs the package-local test suites.
