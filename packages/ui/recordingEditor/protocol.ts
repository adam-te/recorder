import type { RecordingMetadata, RecordingSteps } from '@te/recorder-recording'

export type RecordingEditorCommandResult = { type: 'decisionCancelled' }

export type RecordingEditorPresenterMessage =
  | { message: string; type: 'error' }
  | { metadata: RecordingMetadata; steps: RecordingSteps; pending: boolean; selectedActionIndex: number; type: 'recording' }
  | { actionIndex: number; screenshotUrl?: string; snapshotError?: string; targetLine?: number; type: 'preview'; yaml?: string }

export type RecordingEditorHostMessage = RecordingEditorCommandResult | RecordingEditorPresenterMessage

export type RecordingEditorCommand = { type: 'copy'; text: string } | { source: string; suggestedFileName: string; type: 'saveThousandEyes' } | { steps: RecordingSteps; type: 'updateStepAnnotations' } | { type: 'discard' | 'openJson' | 'play' | 'save' }

export type RecordingEditorPresenterEvent = { type: 'ready' } | { type: 'selectAction'; actionIndex: number }

export type RecordingEditorUiMessage = RecordingEditorCommand | RecordingEditorPresenterEvent
