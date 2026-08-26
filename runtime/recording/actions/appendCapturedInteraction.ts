import { createRecordedAction } from '#runtime/recording/actions/createRecordedAction.ts'
import type { CapturedInteraction } from '#runtime/recording/capture/types.ts'

import type { RecordedAriaSnapshot, Recording, RecordingSession } from '@te/recorder-core'

export { appendCapturedInteraction }

async function appendCapturedInteraction(args: AppendCapturedInteractionArgs): Promise<AppendedInteraction | undefined> {
  const interaction = await createRecordedAction(args.interaction)

  if (!interaction) {
    return undefined
  }

  const recording = args.recordingSession.append(interaction.action)

  return { actionIndex: recording.actions.length - 1, ariaSnapshot: interaction.ariaSnapshot, recording }
}

interface AppendCapturedInteractionArgs {
  interaction: CapturedInteraction
  recordingSession: RecordingSession
}

interface AppendedInteraction {
  actionIndex: number
  ariaSnapshot: RecordedAriaSnapshot
  recording: Recording
}
