import { executeRecordedAction } from '#execution/executeRecordedAction.ts'

import type { RecordedAction, Recording } from '@te/recorder-recording'
import { tryTo } from '@te/recorder-utils'
import { createBrowserSession, type BrowserSession } from '@te/recorder-utils/playwright'

export { runRecording }
export type { ExecutionObserver, ExecutionResult, RunRecordingArgs }

async function runRecording(args: RunRecordingArgs): Promise<ExecutionResult> {
  const session = await (args.createBrowserSession ?? createBrowserSession)()

  return await tryTo(
    async () => {
      for (const [index, action] of args.recording.actions.entries()) {
        await args.observer?.onActionStarted?.({ action, index })
        await executeRecordedAction({ action, page: session.page, resolveSecret: args.resolveSecret })
        await args.observer?.onActionCompleted?.({ action, index })
      }

      return { completedActions: args.recording.actions.length }
    },
    undefined,
    session.close,
  )
}

interface RunRecordingArgs {
  createBrowserSession?: () => Promise<BrowserSession>
  recording: Recording
  observer?: ExecutionObserver
  resolveSecret?: ResolveSecret
}

interface ExecutionObserver {
  onActionCompleted?: (args: { action: RecordedAction; index: number }) => void | Promise<void>
  onActionStarted?: (args: { action: RecordedAction; index: number }) => void | Promise<void>
}

interface ExecutionResult {
  completedActions: number
}

type ResolveSecret = (name: string) => Promise<string> | string
