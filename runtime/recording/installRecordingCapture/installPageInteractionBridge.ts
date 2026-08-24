import { ariaRuntimeSource } from '#recorder-runtime/recording/injected/ariaRuntimeSource.ts'
import { RECORDER_UI_ATTRIBUTE } from '#recorder-runtime/recording/injected/constants.ts'
import { generateSelectorCandidates, SELECTOR_GENERATOR_NAME } from '#recorder-runtime/recording/injected/generateSelectorCandidates.ts'
import { recordPageInteractions } from '#recorder-runtime/recording/injected/recordPageInteractions.ts'
import type { CapturedInteractionEvent, CapturedSelector, SerializedInteraction } from '#recorder-runtime/recording/injected/types.ts'
import type { AriaSnapshot } from '@te/aria'
import type { BrowserContext, Frame, Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { installPageInteractionBridge }
export type { CapturedInteraction, CapturedInteractionEvent, CapturedSelector, InstallPageInteractionBridgeArgs, PageInteractionBridge }

const INTERACTION_BINDING_NAME = '__thousandEyesRecorderCaptureInteraction'

async function installPageInteractionBridge(args: InstallPageInteractionBridgeArgs): Promise<PageInteractionBridge> {
  const pendingInteractions = new Set<Promise<void>>()
  const binding = await args.context.exposeBinding(INTERACTION_BINDING_NAME, receiveInteraction)
  const initScript = await tryTo(
    () => args.context.addInitScript({ content: createInjectedRecorderSource() }),
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

function createInjectedRecorderSource(): string {
  const injectedArgs = JSON.stringify({ bindingName: INTERACTION_BINDING_NAME, recorderUiAttribute: RECORDER_UI_ATTRIBUTE, selectorGeneratorName: SELECTOR_GENERATOR_NAME })

  return `(()=>{${ariaRuntimeSource};(${recordPageInteractions.toString()})(${injectedArgs}, ${generateSelectorCandidates.toString()}, ariaRuntime)})()`
}

interface CapturedInteraction {
  ariaSnapshot: AriaSnapshot
  event: CapturedInteractionEvent
  frame: Frame
  pageUrl: string
  selectors: CapturedSelector[]
}

interface InstallPageInteractionBridgeArgs {
  context: BrowserContext
  onInteraction: (interaction: CapturedInteraction) => Promise<void> | void
}

interface PageInteractionBridge {
  dispose: () => Promise<void>
}
