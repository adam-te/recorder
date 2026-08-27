import type { RecordingEditorHostMessage, RecordingEditorUiMessage } from '../protocol.ts'

export interface CreateRecordingEditorArgs {
  root: HTMLElement
  send: (message: RecordingEditorUiMessage) => void
}

export interface RecordingEditorCallbacks {
  onCopy: (text: string) => void
  onDiscard: () => void
  onOpenJson: () => void
  onPlay: () => void
  onReady: () => void
  onSave: () => void
  onSelectAction: (actionIndex: number) => void
}

export interface RecordingEditor {
  ready: () => void
  receive: (message: RecordingEditorHostMessage) => void
}

export interface SnapshotState {
  error?: string
  loading?: boolean
  targetLine?: number
  yaml?: string
}
