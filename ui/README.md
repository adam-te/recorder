# Recorder UI

Provides the host-neutral Svelte 5 recording editor used by environment-specific integrations.

The editor owns components and local interaction state, communicates through typed host and UI messages, and styles itself with semantic `--recorder-*` design tokens. It does not import VS Code, Node.js, filesystem, or recorder runtime APIs; hosts supply document updates, snapshots, persistence decisions, clipboard access, and playback behavior through an adapter.
