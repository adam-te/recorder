# Recorder UI

Provides the host-neutral recording editor and browser overlay shared by recorder applications.

Hosts communicate with the UI through typed messages and callbacks while retaining responsibility for persistence, clipboard access, and playback. The editor uses semantic `--recorder-*` design tokens so each host can supply its own theme.

## APIs

- `@te/recorder-ui/recording-editor` mounts the transaction editor and exposes its typed protocol.
- `@te/recorder-ui/recording-editor-host` coordinates recording selection and snapshots.
- `@te/recorder-ui/recording-overlay` mounts the browser recording controls and element highlight.
- `@te/recorder-ui/render-recording-snapshot` prepares ARIA snapshots for presentation.
