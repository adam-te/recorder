import { createRecording } from '#core/recording/createRecording.ts'
import { recordingSchema, type RecordedAction, type Recording } from '#core/recording/recordingSchema.ts'

export { createRecordingSession }
export type { RecordingSession }

function createRecordingSession(args: CreateRecordingSessionArgs): RecordingSession {
  let recording = createRecording(args)

  return { append, replaceLast, snapshot }

  function append(action: RecordedAction): Recording {
    recording = recordingSchema.parse({ ...recording, actions: [...recording.actions, action] })

    return recording
  }

  function replaceLast(action: RecordedAction): Recording {
    if (!recording.actions.length) {
      throw new Error('Cannot replace an action in an empty recording session.')
    }

    recording = recordingSchema.parse({ ...recording, actions: [...recording.actions.slice(0, -1), action] })

    return recording
  }

  function snapshot(): Recording {
    return recording
  }
}

interface CreateRecordingSessionArgs {
  createdAt?: Date
  startUrl: string
  title: string
}

interface RecordingSession {
  append: (action: RecordedAction) => Recording
  replaceLast: (action: RecordedAction) => Recording
  snapshot: () => Recording
}
