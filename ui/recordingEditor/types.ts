import type { RecordingDocument } from '@te/recorder-core'

export interface CreateRecordingEditorArgs {
  root: HTMLElement
  sendMessage: (message: RecordingEditorUiMessage) => void
}

export interface RecordingEditor {
  ready: () => void
  receive: (message: RecordingEditorHostMessage) => void
}

export type RecordingEditorHostMessage = { type: 'decisionCancelled' } | { message: string; type: 'error' } | { document: RecordingDocument; pending: boolean; selectedActionIndex: number; type: 'document' } | { actionIndex: number; error?: string; targetLine?: number; type: 'snapshot'; yaml?: string }

export type RecordingEditorUiMessage = { type: 'copy'; text: string } | { type: 'discard' | 'openJson' | 'play' | 'ready' | 'save' } | { type: 'selectAction'; actionIndex: number }

export interface SnapshotState {
  error?: string
  loading?: boolean
  targetLine?: number
  yaml?: string
}
