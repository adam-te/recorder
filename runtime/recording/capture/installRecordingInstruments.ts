import { captureBrowserNavigation, type CapturedBrowserNavigation } from '#recorder-runtime/recording/capture/captureBrowserNavigation.ts'
import { installPageInteractionBridge } from '#recorder-runtime/recording/capture/installPageInteractionBridge.ts'
import type { CapturedInteraction } from '#recorder-runtime/recording/capture/types.ts'
import type { BrowserContext, Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { installRecordingInstruments }
export type { InstallRecordingInstrumentsArgs, RecordingInstruments }

async function installRecordingInstruments(args: InstallRecordingInstrumentsArgs): Promise<RecordingInstruments> {
  const interactionCapture = await installPageInteractionBridge({ context: args.context, onInteraction: args.onInteraction })
  const navigationCapture = await tryTo(
    () => captureBrowserNavigation({ onNavigation: args.onNavigation, page: args.page }),
    async error => {
      await interactionCapture.dispose()
      throw error
    },
  )

  return { dispose, flush: navigationCapture.flush }

  async function dispose(): Promise<void> {
    await navigationCapture.dispose()
    await interactionCapture.dispose()
  }
}

interface InstallRecordingInstrumentsArgs {
  context: BrowserContext
  onInteraction: (interaction: CapturedInteraction) => Promise<void> | void
  onNavigation?: (navigation: CapturedBrowserNavigation) => Promise<void> | void
  page: Page
}

interface RecordingInstruments {
  dispose: () => Promise<void>
  flush: () => Promise<void>
}
