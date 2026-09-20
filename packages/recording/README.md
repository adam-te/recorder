# Recording

Defines the platform-independent recording event and step models shared by capture, execution, and UI.

It provides recording artifact storage, validation, serialization, step derivation, and Playwright and ThousandEyes script generation.

Recording performs no browser automation, filesystem access, editor integration, or ThousandEyes API calls.

## Recording artifacts

Each `.recording` directory separates immutable capture data from mutable authored steps:

```text
example.recording/
├─ recording.json   # captured events
├─ steps.json       # actions, marker boundaries, and screenshots
└─ snapshots/
```

`steps.json` is initially derived from the captured events. The editor and script generators subsequently use that ordered step list directly; the current editor changes only marker and screenshot steps.

```text
recording/   -> steps/                -> execution and script formats
    |               |
 write once   annotations editable
```
