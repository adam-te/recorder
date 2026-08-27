# Recorder UI

Provides the host-neutral recording editor shared by recorder applications.

Hosts provide explicit callbacks for persistence, clipboard access, and playback. The shared presenter coordinates recording and selection state through typed messages. The editor uses semantic `--recorder-*` design tokens so each host can supply its own theme.

## APIs

- `@te/recorder-ui/recording-editor` mounts the browser editor and exposes its typed protocol.
- `@te/recorder-ui/recording-editor/presenter` provides recording and selection presentation without browser dependencies.
