import type { BrowserSession } from '#runtime/browser/createBrowserSession.ts'
import { executeRecordedAction } from '#runtime/playback/executeRecordedAction.ts'

import type { RecordedAction, Recording } from '@te/recorder-core'

export { playRecording }
export type { PlaybackObserver, PlaybackResult, PlayRecordingArgs }

async function playRecording(args: PlayRecordingArgs): Promise<PlaybackResult> {
  for (const [index, action] of args.recording.actions.entries()) {
    await args.observer?.onActionStarted?.({ action, index })
    await executeRecordedAction({ action, page: args.session.page, resolveSecret: args.resolveSecret })
    await args.observer?.onActionCompleted?.({ action, index })
  }

  return { completedActions: args.recording.actions.length }
}

interface PlayRecordingArgs {
  recording: Recording
  observer?: PlaybackObserver
  resolveSecret?: ResolveSecret
  session: BrowserSession
}

interface PlaybackObserver {
  onActionCompleted?: (args: { action: RecordedAction; index: number }) => void | Promise<void>
  onActionStarted?: (args: { action: RecordedAction; index: number }) => void | Promise<void>
}

interface PlaybackResult {
  completedActions: number
}

type ResolveSecret = (name: string) => Promise<string> | string
