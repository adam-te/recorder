import { recordingDocumentSchema, type RecordingDocument } from './recordingDocumentSchema.ts'

export { serializeRecordingDocument }

function serializeRecordingDocument(document: RecordingDocument): string {
  return `${JSON.stringify(recordingDocumentSchema.parse(document), undefined, 2)}\n`
}
