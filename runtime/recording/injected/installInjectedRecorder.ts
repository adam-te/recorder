import { recordingRuntimeSource } from '#recorder-runtime/injected/generated/recordingRuntimeSource.generated.ts'
import { DISPOSE_OVERLAY_FUNCTION_NAME, INTERACTION_BINDING_NAME, OVERLAY_CONFIG_NAME, STOP_BINDING_NAME } from '#recorder-runtime/injected/protocol.ts'
import type { SerializedInteraction } from '#recorder-runtime/injected/protocol.ts'
import type { CapturedInteraction } from '#recorder-runtime/recording/capture/types.ts'
import type { BrowserContext, Frame, Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { installInjectedRecorder }
export type { InjectedRecorder, InstallInjectedRecorderArgs }

async function installInjectedRecorder(args: InstallInjectedRecorderArgs): Promise<InjectedRecorder> {
  const pendingInteractions = new Set<Promise<void>>()
  const interactionBinding = await args.context.exposeBinding(INTERACTION_BINDING_NAME, receiveInteraction)
  const stopBinding = await tryTo(
    () => (args.onStopRequested ? args.context.exposeBinding(STOP_BINDING_NAME, args.onStopRequested) : undefined),
    async error => {
      await interactionBinding.dispose()
      throw error
    },
  )
  const source = createInjectedRecorderSource(Boolean(stopBinding))
  const initScript = await tryTo(
    () => args.context.addInitScript({ content: source }),
    async error => {
      await Promise.all([interactionBinding.dispose(), stopBinding?.dispose()])
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
    await tryTo(
      () => Promise.all(args.page.frames().map(frame => frame.evaluate(name => (globalThis as unknown as Record<string, (() => Promise<void> | void) | undefined>)[name]?.(), DISPOSE_OVERLAY_FUNCTION_NAME))),
      undefined,
      async () => {
        await Promise.all([initScript.dispose(), interactionBinding.dispose(), stopBinding?.dispose()])
        await Promise.all(pendingInteractions)
      },
    )
  }
}

function createInjectedRecorderSource(showsControls: boolean): string {
  const configSource = `globalThis[${JSON.stringify(OVERLAY_CONFIG_NAME)}]=${JSON.stringify({ showsControls })}`

  return `${configSource};${recordingRuntimeSource}`
}

interface InstallInjectedRecorderArgs {
  context: BrowserContext
  onInteraction: (interaction: CapturedInteraction) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  page: Page
}

interface InjectedRecorder {
  dispose: () => Promise<void>
}
