import { recordingSchema, type Recording } from './recordingSchema.ts'

export { parseRecording }

function parseRecording(value: unknown): Recording {
  return recordingSchema.parse(value)
}
