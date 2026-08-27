import type { Recording } from '@te/recorder-core'

export type RecordingEditorCommandResult = { type: 'decisionCancelled' }

export type RecordingEditorPresenterMessage = { message: string; type: 'error' } | { recording: Recording; pending: boolean; selectedActionIndex: number; type: 'recording' } | { actionIndex: number; error?: string; targetLine?: number; type: 'snapshot'; yaml?: string }

export type RecordingEditorHostMessage = RecordingEditorCommandResult | RecordingEditorPresenterMessage

export type RecordingEditorCommand = { type: 'copy'; text: string } | { type: 'discard' | 'openJson' | 'play' | 'save' }

export type RecordingEditorPresenterEvent = { type: 'ready' } | { type: 'selectAction'; actionIndex: number }

export type RecordingEditorUiMessage = RecordingEditorCommand | RecordingEditorPresenterEvent
