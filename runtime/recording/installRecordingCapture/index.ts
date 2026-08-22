import { captureBrowserNavigation } from '#recorder-runtime/recording/installRecordingCapture/captureBrowserNavigation.ts'
import { installPageInteractionBridge, type CapturedInteraction, type CapturedInteractionEvent, type CapturedSelector } from '#recorder-runtime/recording/installRecordingCapture/installPageInteractionBridge.ts'
import { installRecordingOverlay, type RecordingOverlay } from '#recorder-runtime/recording/installRecordingOverlay/index.ts'
import type { BrowserContext, Page } from 'playwright'

import type { RecordingDocument, RecordingSession } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

export { installRecordingCapture }
export type { CapturedInteraction, CapturedInteractionEvent, CapturedSelector, InstallRecordingCaptureArgs, RecordingCapture }

async function installRecordingCapture(args: InstallRecordingCaptureArgs): Promise<RecordingCapture> {
  const pageInteractionBridge = await installPageInteractionBridge({ context: args.context, onInteraction: args.onInteraction })
  let recordingOverlay: RecordingOverlay | undefined
  const browserNavigationCapture = await tryTo(
    async () => {
      recordingOverlay = await installRecordingOverlay({ context: args.context, onStopRequested: args.onStopRequested, page: args.page })
      const capture = await captureBrowserNavigation({ onDocumentChanged: args.onDocumentChanged, page: args.page, recordingSession: args.recordingSession })

      if (args.startUrl) {
        await args.page.goto(args.startUrl)
        await capture.flush()
      }

      return capture
    },
    async error => {
      await recordingOverlay?.dispose()
      await pageInteractionBridge.dispose()
      throw error
    },
  )

  return { dispose }

  async function dispose(): Promise<void> {
    await browserNavigationCapture.dispose()
    await recordingOverlay?.dispose()
    await pageInteractionBridge.dispose()
  }
}

interface InstallRecordingCaptureArgs {
  context: BrowserContext
  onDocumentChanged?: (document: RecordingDocument) => Promise<void> | void
  onInteraction: (interaction: CapturedInteraction) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  page: Page
  recordingSession: RecordingSession
  startUrl?: string
}

interface RecordingCapture {
  dispose: () => Promise<void>
}
