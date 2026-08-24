import { ariaRuntimeSource } from '#recorder-runtime/recording/injected/ariaRuntimeSource.ts'
import { RECORDER_UI_ATTRIBUTE } from '#recorder-runtime/recording/injected/constants.ts'
import { formatLocator } from '#recorder-runtime/recording/injected/formatLocator.ts'
import { generateLocatorCandidates } from '#recorder-runtime/recording/injected/generateLocatorCandidates.ts'
import { generateSelectorCandidates } from '#recorder-runtime/recording/injected/generateSelectorCandidates.ts'
import { RECORDING_OVERLAY_STYLES, showRecordingOverlay } from '#recorder-runtime/recording/injected/showRecordingOverlay.ts'
import type { BrowserContext, Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { installRecordingOverlay }
export type { RecordingOverlay }

const STOP_BINDING_NAME = '__thousandEyesRecorderStop'
const DISPOSE_FUNCTION_NAME = '__thousandEyesRecorderDisposeOverlay'

async function installRecordingOverlay(args: InstallRecordingOverlayArgs): Promise<RecordingOverlay> {
  const stopBinding = args.onStopRequested ? await args.context.exposeBinding(STOP_BINDING_NAME, args.onStopRequested) : undefined
  const source = createInjectedOverlaySource(Boolean(stopBinding))
  const initScript = await tryTo(
    () => args.context.addInitScript({ content: source }),
    async error => {
      await stopBinding?.dispose()
      throw error
    },
  )
  await tryTo(
    () => Promise.all(args.page.frames().map(frame => frame.evaluate(source))),
    async error => {
      await initScript.dispose()
      await stopBinding?.dispose()
      throw error
    },
  )

  return { dispose }

  async function dispose(): Promise<void> {
    await Promise.all(args.page.frames().map(frame => frame.evaluate(name => (globalThis as unknown as Record<string, (() => void) | undefined>)[name]?.(), DISPOSE_FUNCTION_NAME)))
    await Promise.all([initScript.dispose(), stopBinding?.dispose()])
  }
}

function createInjectedOverlaySource(showsControls: boolean): string {
  const injectedArgs = JSON.stringify({ disposeFunctionName: DISPOSE_FUNCTION_NAME, recorderUiAttribute: RECORDER_UI_ATTRIBUTE, stopBindingName: showsControls ? STOP_BINDING_NAME : undefined })

  return `(()=>{${ariaRuntimeSource};(${showRecordingOverlay.toString()})(${injectedArgs}, ${generateLocatorCandidates.toString()}, ${generateSelectorCandidates.toString()}, ariaRuntime, ${formatLocator.toString()}, ${JSON.stringify(RECORDING_OVERLAY_STYLES)})})()`
}

interface InstallRecordingOverlayArgs {
  context: BrowserContext
  onStopRequested?: () => Promise<void> | void
  page: Page
}

interface RecordingOverlay {
  dispose: () => Promise<void>
}
