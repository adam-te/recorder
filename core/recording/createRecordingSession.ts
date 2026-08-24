import { createRecordingDocument } from '#core/document/createRecordingDocument.ts'
import { recordingDocumentSchema, type RecordedAction, type RecordingDocument } from '#core/document/recordingDocumentSchema.ts'

export { createRecordingSession }
export type { RecordingSession }

function createRecordingSession(args: CreateRecordingSessionArgs): RecordingSession {
  let document = createRecordingDocument(args)

  return { append, replaceLast, snapshot }

  function append(action: RecordedAction): RecordingDocument {
    document = recordingDocumentSchema.parse({ ...document, actions: [...document.actions, action] })

    return document
  }

  function replaceLast(action: RecordedAction): RecordingDocument {
    if (!document.actions.length) {
      throw new Error('Cannot replace an action in an empty recording session.')
    }

    document = recordingDocumentSchema.parse({ ...document, actions: [...document.actions.slice(0, -1), action] })

    return document
  }

  function snapshot(): RecordingDocument {
    return document
  }
}

interface CreateRecordingSessionArgs {
  createdAt?: Date
  startUrl: string
  title: string
}

interface RecordingSession {
  append: (action: RecordedAction) => RecordingDocument
  replaceLast: (action: RecordedAction) => RecordingDocument
  snapshot: () => RecordingDocument
}
