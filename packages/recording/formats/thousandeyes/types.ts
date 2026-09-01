import type { Recording } from '#recording/recording/recordingSchema.ts'

export type { ThousandEyesTransactionConverter, ThousandEyesTransactionScript }

interface ThousandEyesTransactionConverter {
  generate: (recording: Recording) => ThousandEyesTransactionScript | Promise<ThousandEyesTransactionScript>
  parse: (script: ThousandEyesTransactionScript) => Recording | Promise<Recording>
}

interface ThousandEyesTransactionScript {
  language: string
  source: string
}
