import type { Recording } from '#core/recording/recordingSchema.ts'

export type { ThousandEyesTransactionCodec, ThousandEyesTransactionScript }

interface ThousandEyesTransactionCodec {
  generate: (recording: Recording) => ThousandEyesTransactionScript | Promise<ThousandEyesTransactionScript>
  parse: (script: ThousandEyesTransactionScript) => Recording | Promise<Recording>
}

interface ThousandEyesTransactionScript {
  language: string
  source: string
}
