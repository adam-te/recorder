import type { CapturedInteraction } from '#recorder-runtime/recording/installRecordingCapture/index.ts'
import { createRecordedAction } from '#recorder-runtime/recording/processing/createRecordedAction.ts'

import type { RecordingDocument, RecordingSession } from '@te/recorder-core'

export { appendCapturedInteraction }

async function appendCapturedInteraction(args: AppendCapturedInteractionArgs): Promise<RecordingDocument | undefined> {
  const action = await createRecordedAction(args.interaction)

  return action && args.recordingSession.append(action)
}

interface AppendCapturedInteractionArgs {
  interaction: CapturedInteraction
  recordingSession: RecordingSession
}
