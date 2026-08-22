import { recordingDocumentSchema, type RecordingDocument } from './recordingDocumentSchema.ts'

export { createRecordingDocument }

function createRecordingDocument(args: CreateRecordingDocumentArgs): RecordingDocument {
  return recordingDocumentSchema.parse({
    title: args.title,
    startUrl: args.startUrl,
    createdAt: (args.createdAt ?? new Date()).toISOString(),
    actions: [],
  })
}

interface CreateRecordingDocumentArgs {
  createdAt?: Date
  startUrl: string
  title: string
}
