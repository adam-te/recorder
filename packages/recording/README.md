# Recording

Defines the platform-independent recording model and transformations shared by capture, execution, and UI.

It provides recording artifact storage, validation, serialization, recording sessions, and Playwright and ThousandEyes script generation.

Recording performs no browser automation, filesystem access, editor integration, or ThousandEyes API calls.

## ThousandEyes annotations

Markers span recorded actions and screenshots target the boundaries between them:

```json
{
  "thousandEyes": {
    "markers": [{ "name": "Sign in", "start": 1, "end": 3 }],
    "screenshots": [{ "at": 3 }]
  }
}
```

Positions run from `0` before the first action through `actions.length` after the last. Screenshots requested at the start of or inside markers are emitted after all adjacent or overlapping markers stop.
