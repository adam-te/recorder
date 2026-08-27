# Recorder UI

Provides the host-neutral recording editor and browser overlay shared by recorder applications.

Hosts communicate with the UI through typed messages and callbacks while retaining responsibility for persistence, clipboard access, and playback. The editor uses semantic `--recorder-*` design tokens so each host can supply its own theme.

## APIs

- `@te/recorder-ui/recording-editor` mounts the browser editor and exposes its typed protocol.
- `@te/recorder-ui/recording-editor/host` provides host coordination and snapshot presentation without browser dependencies.
- `@te/recorder-ui/recording-overlay` mounts the browser recording controls and element highlight.
