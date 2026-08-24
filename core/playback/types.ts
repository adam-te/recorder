import type { RecordedAction } from '#core/document/recordingDocumentSchema.ts'

export type { PlaybackObserver, PlaybackResult }

interface PlaybackObserver {
  onActionCompleted?: (args: { action: RecordedAction; index: number }) => void | Promise<void>
  onActionStarted?: (args: { action: RecordedAction; index: number }) => void | Promise<void>
}

interface PlaybackResult {
  completedActions: number
}
