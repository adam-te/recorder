import { installRecordingInstruments } from '#recorder-runtime/recording/capture/installRecordingInstruments.ts'
import type { CapturedInteraction } from '#recorder-runtime/recording/capture/types.ts'
import { installRecordingOverlay, type RecordingOverlay } from '#recorder-runtime/recording/overlay/installRecordingOverlay.ts'
import type { BrowserContext, Page } from 'playwright'

import type { RecordingDocument, RecordingSession } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

export { installRecordingCapture }
export type { InstallRecordingCaptureArgs, RecordingCapture }

async function installRecordingCapture(args: InstallRecordingCaptureArgs): Promise<RecordingCapture> {
  const instruments = await installRecordingInstruments({
    context: args.context,
    onInteraction: args.onInteraction,
    onNavigation: async navigation => {
      const document = args.recordingSession.append({ kind: 'goto', ...navigation })

      await args.onDocumentChanged?.(document)
    },
    page: args.page,
  })
  let recordingOverlay: RecordingOverlay | undefined
  await tryTo(
    async () => {
      recordingOverlay = await installRecordingOverlay({ context: args.context, onStopRequested: args.onStopRequested, page: args.page })

      await args.page.goto(args.startUrl)
      await instruments.flush()
    },
    async error => {
      await recordingOverlay?.dispose()
      await instruments.dispose()
      throw error
    },
  )

  return { dispose }

  async function dispose(): Promise<void> {
    await recordingOverlay?.dispose()
    await instruments.dispose()
  }
}

interface InstallRecordingCaptureArgs {
  context: BrowserContext
  onDocumentChanged?: (document: RecordingDocument) => Promise<void> | void
  onInteraction: (interaction: CapturedInteraction) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  page: Page
  recordingSession: RecordingSession
  startUrl: string
}

interface RecordingCapture {
  dispose: () => Promise<void>
}
