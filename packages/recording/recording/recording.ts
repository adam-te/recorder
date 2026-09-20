import { recordingSchema, type Recording } from './recordingSchema.ts'

export { createRecording, parseRecording, serializeRecording }

function createRecording(args: CreateRecordingArgs): Recording {
  return recordingSchema.parse({
    title: args.title,
    startUrl: args.startUrl,
    createdAt: (args.createdAt ?? new Date()).toISOString(),
    events: [],
  })
}

function parseRecording(value: unknown): Recording {
  return recordingSchema.parse(value)
}

function serializeRecording(recording: Recording): string {
  return `${JSON.stringify(recordingSchema.parse(recording), undefined, 2)}\n`
}

interface CreateRecordingArgs {
  createdAt?: Date
  startUrl: string
  title: string
}
