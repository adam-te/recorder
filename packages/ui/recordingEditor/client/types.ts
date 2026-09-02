import type { RecordingEditorHostMessage, RecordingEditorUiMessage } from '#ui/recordingEditor/protocol.ts'

import type { Recording } from '@te/recorder-recording'

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
  onSaveThousandEyes: (source: string, suggestedFileName: string) => void
  onSelectAction: (actionIndex: number) => void
  onUpdateThousandEyes: (thousandEyes: Recording['thousandEyes']) => void
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

export interface ScreenshotState {
  loading?: boolean
  url?: string
}
