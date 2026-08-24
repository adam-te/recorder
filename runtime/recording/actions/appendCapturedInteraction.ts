import { createRecordedAction } from '#recorder-runtime/recording/actions/createRecordedAction.ts'
import type { CapturedInteraction } from '#recorder-runtime/recording/capture/types.ts'

import type { RecordedAriaSnapshot, RecordingDocument, RecordingSession } from '@te/recorder-core'

export { appendCapturedInteraction }

async function appendCapturedInteraction(args: AppendCapturedInteractionArgs): Promise<AppendedInteraction | undefined> {
  const interaction = await createRecordedAction(args.interaction)

  if (!interaction) {
    return undefined
  }

  const document = args.recordingSession.append(interaction.action)

  return { actionIndex: document.actions.length - 1, ariaSnapshot: interaction.ariaSnapshot, document }
}

interface AppendCapturedInteractionArgs {
  interaction: CapturedInteraction
  recordingSession: RecordingSession
}

interface AppendedInteraction {
  actionIndex: number
  ariaSnapshot: RecordedAriaSnapshot
  document: RecordingDocument
}
