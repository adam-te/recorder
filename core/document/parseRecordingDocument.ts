import { recordingDocumentSchema, type RecordingDocument } from './recordingDocumentSchema.ts'

export { parseRecordingDocument }

function parseRecordingDocument(value: unknown): RecordingDocument {
  return recordingDocumentSchema.parse(value)
}
