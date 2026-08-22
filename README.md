# ThousandEyes Transaction Recorder

Provides the packages used to author, record, and play back ThousandEyes Transaction tests from Visual Studio Code.

The domain model is kept independent from browser automation and editor integration so each layer can evolve without coupling the others.

```text
VS Code extension ─┐
                   ├──> runtime ───> core
CLI ───────────────┘       │          │
                           v          v
                       Playwright  codecs/
                                      └── thousandeyes
```

`runtime` provides the reusable browser-backed recorder API, while the extension is a lightweight UI wrapper. `core` owns the platform-independent recording document and pure format codecs.

## Development

Install the standalone workspace and run its recursive check from this directory:

```text
npm install
npm run check
```

The check formats, lints, and type-checks the entire workspace, builds the extension, and runs the browser-backed smoke tests in `smoketest/`.
