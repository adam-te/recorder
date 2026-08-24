import type { BrowserSession } from '#runtime/browser/createBrowserSession.ts'
import { executeRecordedAction } from '#runtime/playback/executeRecordedAction.ts'

import type { PlaybackObserver, PlaybackResult, RecordingDocument } from '@te/recorder-core'

export { playRecording }
export type { PlayRecordingArgs }

async function playRecording(args: PlayRecordingArgs): Promise<PlaybackResult> {
  for (const [index, action] of args.document.actions.entries()) {
    await args.observer?.onActionStarted?.({ action, index })
    await executeRecordedAction({ action, page: args.session.page, resolveSecret: args.resolveSecret })
    await args.observer?.onActionCompleted?.({ action, index })
  }

  return { completedActions: args.document.actions.length }
}

interface PlayRecordingArgs {
  document: RecordingDocument
  observer?: PlaybackObserver
  resolveSecret?: ResolveSecret
  session: BrowserSession
}

type ResolveSecret = (name: string) => Promise<string> | string
