import { captureBrowserNavigation, type CapturedBrowserNavigation } from '#runtime/recording/capture/captureBrowserNavigation.ts'
import type { CapturedInteraction } from '#runtime/recording/capture/types.ts'
import { attachRecordingPageRuntime } from '#runtime/recording/injection/attachRecordingPageRuntime.ts'
import type { BrowserContext, Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { installRecordingInstruments }
export type { InstallRecordingInstrumentsArgs, RecordingInstruments }

async function installRecordingInstruments(args: InstallRecordingInstrumentsArgs): Promise<RecordingInstruments> {
  const recordingPageRuntime = await attachRecordingPageRuntime({ context: args.context, onInteraction: args.onInteraction, onStopRequested: args.onStopRequested, page: args.page })
  const navigationCapture = await tryTo(
    () => captureBrowserNavigation({ onNavigation: args.onNavigation, page: args.page }),
    async error => {
      await recordingPageRuntime.dispose()
      throw error
    },
  )

  return { dispose, flush: navigationCapture.flush }

  async function dispose(): Promise<void> {
    await navigationCapture.dispose()
    await recordingPageRuntime.dispose()
  }
}

interface InstallRecordingInstrumentsArgs {
  context: BrowserContext
  onInteraction: (interaction: CapturedInteraction) => Promise<void> | void
  onNavigation?: (navigation: CapturedBrowserNavigation) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  page: Page
}

interface RecordingInstruments {
  dispose: () => Promise<void>
  flush: () => Promise<void>
}
