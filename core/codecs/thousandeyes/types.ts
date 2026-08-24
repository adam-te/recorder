import type { RecordingDocument } from '#core/document/recordingDocumentSchema.ts'

export type { ThousandEyesTransactionCodec, ThousandEyesTransactionScript }

interface ThousandEyesTransactionCodec {
  generate: (document: RecordingDocument) => ThousandEyesTransactionScript | Promise<ThousandEyesTransactionScript>
  parse: (script: ThousandEyesTransactionScript) => RecordingDocument | Promise<RecordingDocument>
}

interface ThousandEyesTransactionScript {
  language: string
  source: string
}
