import { captureBrowserNavigation, type CapturedBrowserNavigation } from '#runtime/recording/capture/captureBrowserNavigation.ts'
import type { CapturedInteraction } from '#runtime/recording/capture/types.ts'
import { installInjectedRecorder } from '#runtime/recording/injected/installInjectedRecorder.ts'
import type { BrowserContext, Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { installRecordingInstruments }
export type { InstallRecordingInstrumentsArgs, RecordingInstruments }

async function installRecordingInstruments(args: InstallRecordingInstrumentsArgs): Promise<RecordingInstruments> {
  const injectedRecorder = await installInjectedRecorder({ context: args.context, onInteraction: args.onInteraction, onStopRequested: args.onStopRequested, page: args.page })
  const navigationCapture = await tryTo(
    () => captureBrowserNavigation({ onNavigation: args.onNavigation, page: args.page }),
    async error => {
      await injectedRecorder.dispose()
      throw error
    },
  )

  return { dispose, flush: navigationCapture.flush }

  async function dispose(): Promise<void> {
    await navigationCapture.dispose()
    await injectedRecorder.dispose()
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
