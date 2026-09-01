# ThousandEyes Recorder CLI

Record, inspect, and replay browser transactions stored in `.recording` directories.

## Record

Open a browser and capture a transaction. Press Enter or choose **Stop recording** in the browser to save it and open the editor.

```text
npx te record <url> [recording-directory]
```

## Play

Replay a recording in a browser.

```text
npx te play <recording-directory>
```

## Inspect

Open a recording in the standalone editor.

```text
npx te ui <recording-directory>
```
