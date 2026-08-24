import { ariaRuntimeSource } from '#recorder-runtime/injected/generated/ariaRuntimeSource.generated.ts'
import { recordingCaptureSource } from '#recorder-runtime/injected/generated/recordingCaptureSource.generated.ts'
import { INTERACTION_BINDING_NAME } from '#recorder-runtime/injected/protocol.ts'
import type { SerializedInteraction } from '#recorder-runtime/injected/protocol.ts'
import type { CapturedInteraction } from '#recorder-runtime/recording/capture/types.ts'
import type { BrowserContext, Frame, Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { installPageInteractionBridge }
export type { InstallPageInteractionBridgeArgs, PageInteractionBridge }

async function installPageInteractionBridge(args: InstallPageInteractionBridgeArgs): Promise<PageInteractionBridge> {
  const pendingInteractions = new Set<Promise<void>>()
  const binding = await args.context.exposeBinding(INTERACTION_BINDING_NAME, receiveInteraction)
  const initScript = await tryTo(
    () => args.context.addInitScript({ content: `${ariaRuntimeSource};${recordingCaptureSource}` }),
    async error => {
      await binding.dispose()
      throw error
    },
  )

  return { dispose }

  function receiveInteraction(source: { frame: Frame; page: Page }, value: SerializedInteraction): Promise<void> {
    const interaction = Promise.resolve(args.onInteraction({ ...value, frame: source.frame, pageUrl: source.page.url() }))
    const trackedInteraction = interaction.finally(() => pendingInteractions.delete(trackedInteraction))

    pendingInteractions.add(trackedInteraction)
    return trackedInteraction
  }

  async function dispose(): Promise<void> {
    await Promise.all([initScript.dispose(), binding.dispose()])
    await Promise.all(pendingInteractions)
  }
}

interface InstallPageInteractionBridgeArgs {
  context: BrowserContext
  onInteraction: (interaction: CapturedInteraction) => Promise<void> | void
}

interface PageInteractionBridge {
  dispose: () => Promise<void>
}
