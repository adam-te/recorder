import { recordingSchema, type Recording } from './recordingSchema.ts'

export { serializeRecording }

function serializeRecording(recording: Recording): string {
  return `${JSON.stringify(recordingSchema.parse(recording), undefined, 2)}\n`
}
