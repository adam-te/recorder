import { executeActionStep } from '#execution/executeActionStep.ts'

import { getActionSteps, type ActionStep, type RecordingSteps } from '@te/recorder-recording'
import { tryTo } from '@te/recorder-utils'
import { createBrowserSession, type BrowserSession } from '@te/recorder-utils/playwright'

export { runRecording }
export type { ExecutionObserver, ExecutionResult, RunRecordingArgs }

async function runRecording(args: RunRecordingArgs): Promise<ExecutionResult> {
  const session = await (args.createBrowserSession ?? createBrowserSession)()
  const actions = getActionSteps(args.steps)

  return await tryTo(
    async () => {
      for (const [index, action] of actions.entries()) {
        await args.observer?.onActionStarted?.({ action, index })
        await executeActionStep({ page: session.page, resolveSecret: args.resolveSecret, step: action })
        await args.observer?.onActionCompleted?.({ action, index })
      }

      return { completedActions: actions.length }
    },
    undefined,
    session.close,
  )
}

interface RunRecordingArgs {
  createBrowserSession?: () => Promise<BrowserSession>
  steps: RecordingSteps
  observer?: ExecutionObserver
  resolveSecret?: ResolveSecret
}

interface ExecutionObserver {
  onActionCompleted?: (args: { action: ActionStep; index: number }) => void | Promise<void>
  onActionStarted?: (args: { action: ActionStep; index: number }) => void | Promise<void>
}

interface ExecutionResult {
  completedActions: number
}

type ResolveSecret = (name: string) => Promise<string> | string
