import type { Recording } from '@te/recorder-core'

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

export type RecordingEditorCommandResult = { type: 'decisionCancelled' }

export type RecordingEditorPresenterMessage = { message: string; type: 'error' } | { recording: Recording; pending: boolean; selectedActionIndex: number; type: 'recording' } | { actionIndex: number; error?: string; targetLine?: number; type: 'snapshot'; yaml?: string }

export type RecordingEditorHostMessage = RecordingEditorCommandResult | RecordingEditorPresenterMessage

export type RecordingEditorCommand = { type: 'copy'; text: string } | { type: 'discard' | 'openJson' | 'play' | 'save' }

export type RecordingEditorPresenterEvent = { type: 'ready' } | { type: 'selectAction'; actionIndex: number }

export type RecordingEditorUiMessage = RecordingEditorCommand | RecordingEditorPresenterEvent

export interface SnapshotState {
  error?: string
  loading?: boolean
  targetLine?: number
  yaml?: string
}
