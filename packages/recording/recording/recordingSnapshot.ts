import { recordedAriaSnapshotSchema, type RecordedAriaSnapshot } from './recordingSchema.ts'

export { getRecordingScreenshotFileName, getRecordingSnapshotFileName, parseRecordingSnapshot, serializeRecordingSnapshot }

function getRecordingScreenshotFileName(actionIndex: number): string {
  return `${formatActionIndex(actionIndex)}.png`
}

function getRecordingSnapshotFileName(actionIndex: number): string {
  return `${formatActionIndex(actionIndex)}.aria.json`
}

function formatActionIndex(actionIndex: number): string {
  if (!Number.isSafeInteger(actionIndex) || actionIndex < 0 || actionIndex > 9999) {
    throw new Error(`Invalid recording action index: ${actionIndex}`)
  }

  return actionIndex.toString().padStart(4, '0')
}

function parseRecordingSnapshot(value: unknown): RecordedAriaSnapshot {
  return recordedAriaSnapshotSchema.parse(value)
}

function serializeRecordingSnapshot(snapshot: RecordedAriaSnapshot): string {
  return `${JSON.stringify(recordedAriaSnapshotSchema.parse(snapshot), undefined, 2)}\n`
}
