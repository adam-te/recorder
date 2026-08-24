# ThousandEyes Recorder CLI

Provides the `te` command-line interface for recording, playing, and inspecting browser transactions stored in `.recording` directories.

```text
te record <url> [recording-directory]
te play <directory>
te ui <directory>
```

Recording opens a browser and saves the recording directory when Enter is pressed, then opens it in the standalone editor. When the recording directory is omitted, the CLI creates a hostname-based directory in the current directory, such as `example.recording`; existing names receive a numeric suffix rather than being overwritten. An explicitly supplied recording directory is used as the exact destination.

Playback loads a recording directory and plays it in a browser.

`te ui` opens the shared recording editor in a dedicated browser window. It serves files only on a tokenized, loopback-only URL; closing the window stops the local server. The standalone editor can inspect snapshots, copy values, open the source JSON, and play the recording without VS Code.
