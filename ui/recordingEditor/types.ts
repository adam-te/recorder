import type { Recording } from '@te/recorder-core'

export interface CreateRecordingEditorArgs {
  root: HTMLElement
  sendMessage: (message: RecordingEditorUiMessage) => void
}

export interface RecordingEditor {
  ready: () => void
  receive: (message: RecordingEditorHostMessage) => void
}

export type RecordingEditorHostMessage = { type: 'decisionCancelled' } | { message: string; type: 'error' } | { recording: Recording; pending: boolean; selectedActionIndex: number; type: 'recording' } | { actionIndex: number; error?: string; targetLine?: number; type: 'snapshot'; yaml?: string }

export type RecordingEditorUiMessage = { type: 'copy'; text: string } | { type: 'discard' | 'openJson' | 'play' | 'ready' | 'save' } | { type: 'selectAction'; actionIndex: number }

export interface SnapshotState {
  error?: string
  loading?: boolean
  targetLine?: number
  yaml?: string
}
