# Recorder UI

Provides the host-neutral recording editor shared by recorder applications.

Hosts exchange typed messages with the editor and provide persistence, clipboard access, and playback. The shared presenter coordinates recording and selection state. The editor uses semantic `--recorder-*` design tokens so each host can supply its own theme.

```text
Host presenter ──> protocol <──> browser client
```

The recording editor keeps host orchestration, its serializable protocol, and browser rendering in separate source directories.

## APIs

- `@te/recorder-ui/recording-editor` mounts the browser editor and exposes its typed protocol.
- `@te/recorder-ui/recording-editor/host` provides recording and selection presentation without browser dependencies.
