import { appendCapturedInteraction } from '#runtime/recording/actions/appendCapturedInteraction.ts'
import { installRecordingInstruments } from '#runtime/recording/capture/installRecordingInstruments.ts'
import type { CapturedInteraction } from '#runtime/recording/capture/types.ts'
import type { BrowserContext, Page } from 'playwright'

import { createRecordingSession, type RecordedAriaSnapshot, type Recording } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

export { createRecordingCapture }
export type { CreateRecordingCaptureArgs, RecordingCapture }

async function createRecordingCapture(args: CreateRecordingCaptureArgs): Promise<RecordingCapture> {
  const startUrl = new URL(args.startUrl)
  const recordingSession = createRecordingSession({ startUrl: args.startUrl, title: startUrl.hostname || args.startUrl })
  let disposed = false
  let pendingRecordingChange = Promise.resolve()
  const instruments = await installRecordingInstruments({
    context: args.context,
    onInteraction: async interaction => {
      await args.onInteraction?.(interaction)

      const appendedInteraction = await appendCapturedInteraction({ interaction, recordingSession })

      if (!appendedInteraction) return
      await args.onSnapshotCaptured?.({ actionIndex: appendedInteraction.actionIndex, ariaSnapshot: appendedInteraction.ariaSnapshot })
      await notifyRecordingChanged(appendedInteraction.recording)
    },
    onNavigation: navigation => notifyRecordingChanged(recordingSession.append({ kind: 'goto', ...navigation })),
    onStopRequested: args.onStopRequested,
    page: args.page,
  })

  return { dispose, snapshot: recordingSession.snapshot, start }

  async function start(): Promise<void> {
    await tryTo(
      async () => {
        await args.page.goto(args.startUrl)
        await instruments.flush()
      },
      async error => {
        await dispose()
        throw error
      },
    )
  }

  async function dispose(): Promise<void> {
    if (disposed) return
    disposed = true
    await instruments.dispose()
  }

  function notifyRecordingChanged(recording: Recording): Promise<void> {
    pendingRecordingChange = pendingRecordingChange.then(() => args.onRecordingChanged?.(recording))

    return pendingRecordingChange
  }
}

interface CreateRecordingCaptureArgs {
  context: BrowserContext
  onInteraction?: (interaction: CapturedInteraction) => Promise<void> | void
  onRecordingChanged?: (recording: Recording) => Promise<void> | void
  onSnapshotCaptured?: (snapshot: CapturedSnapshot) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  page: Page
  startUrl: string
}

interface CapturedSnapshot {
  actionIndex: number
  ariaSnapshot: RecordedAriaSnapshot
}

interface RecordingCapture {
  dispose: () => Promise<void>
  snapshot: () => Recording
  start: () => Promise<void>
}
