import { installRecordingInstruments } from '#runtime/recording/capture/installRecordingInstruments.ts'
import type { CapturedInteraction } from '#runtime/recording/capture/types.ts'
import type { BrowserContext, Page } from 'playwright'

import type { Recording, RecordingSession } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

export { installRecordingCapture }
export type { InstallRecordingCaptureArgs, RecordingCapture }

async function installRecordingCapture(args: InstallRecordingCaptureArgs): Promise<RecordingCapture> {
  const instruments = await installRecordingInstruments({
    context: args.context,
    onInteraction: args.onInteraction,
    onNavigation: async navigation => {
      const recording = args.recordingSession.append({ kind: 'goto', ...navigation })

      await args.onRecordingChanged?.(recording)
    },
    onStopRequested: args.onStopRequested,
    page: args.page,
  })
  await tryTo(
    async () => {
      await args.page.goto(args.startUrl)
      await instruments.flush()
    },
    async error => {
      await instruments.dispose()
      throw error
    },
  )

  return { dispose }

  async function dispose(): Promise<void> {
    await instruments.dispose()
  }
}

interface InstallRecordingCaptureArgs {
  context: BrowserContext
  onRecordingChanged?: (recording: Recording) => Promise<void> | void
  onInteraction: (interaction: CapturedInteraction) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  page: Page
  recordingSession: RecordingSession
  startUrl: string
}

interface RecordingCapture {
  dispose: () => Promise<void>
}
