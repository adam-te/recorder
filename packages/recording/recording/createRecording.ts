import { recordingSchema, type Recording } from './recordingSchema.ts'

export { createRecording }

function createRecording(args: CreateRecordingArgs): Recording {
  return recordingSchema.parse({
    title: args.title,
    startUrl: args.startUrl,
    createdAt: (args.createdAt ?? new Date()).toISOString(),
    actions: [],
  })
}

interface CreateRecordingArgs {
  createdAt?: Date
  startUrl: string
  title: string
}
